#!/usr/bin/env node
// Secret scanner (Plan v2.0 §15, CLAUDE.md rule 8). No dependencies; runs on Windows, macOS, Linux.
//
// Scans the production bundle (dist/, if present) and every file git would commit
// (tracked + untracked-but-not-ignored). Fails with file:line and a masked value when it finds:
//   - a Supabase secret key (sb_secret_ followed by 10+ key characters; the bare prefix
//     appears inside supabase-js itself and is not a secret)
//   - a JWT whose payload role is service_role
//   - a PEM private key
//   - a non-empty SERVICE_ROLE_KEY= / SECRET_KEY= assignment
//   - any VITE_*SECRET* / VITE_*SERVICE* variable name (VITE_ values ship to the browser)
//
// Usage: node scripts/check-secrets.mjs [--dist <dir>] [--no-repo]

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const SELF = relative(ROOT, fileURLToPath(import.meta.url))
  .split(sep)
  .join('/');

const args = process.argv.slice(2);
const distArg = args.indexOf('--dist');
const DIST = resolve(ROOT, distArg >= 0 ? (args[distArg + 1] ?? 'dist') : 'dist');
const SCAN_REPO = !args.includes('--no-repo');

/** @param {string} value */
function mask(value) {
  return value.length <= 12
    ? `${value.slice(0, 4)}…`
    : `${value.slice(0, 10)}…(${value.length} chars)`;
}

/** @param {string} segment */
function jwtRole(segment) {
  try {
    const json = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
    return typeof json?.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/**
 * @typedef {{ rule: string, match: string }} Hit
 * @type {Array<{ rule: string, find: (line: string) => Hit[] }>}
 */
const RULES = [
  {
    rule: 'supabase-secret-key',
    find: (line) =>
      [...line.matchAll(/sb_secret_[A-Za-z0-9_-]{10,}/g)].map((m) => ({
        rule: 'supabase-secret-key',
        match: m[0],
      })),
  },
  {
    rule: 'service-role-jwt',
    find: (line) =>
      [...line.matchAll(/eyJ[A-Za-z0-9_-]{5,}\.(eyJ[A-Za-z0-9_-]{5,})\.[A-Za-z0-9_-]*/g)]
        .filter((m) => m[1] !== undefined && jwtRole(m[1]) === 'service_role')
        .map((m) => ({ rule: 'service-role-jwt', match: m[0] })),
  },
  {
    rule: 'private-key',
    find: (line) =>
      [...line.matchAll(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g)].map((m) => ({
        rule: 'private-key',
        match: m[0],
      })),
  },
  {
    rule: 'secret-assignment',
    find: (line) =>
      [
        ...line.matchAll(
          /\b([A-Z0-9_]*(?:SERVICE_ROLE_KEY|SECRET_KEY))\s*[=:]\s*["']?([^\s"'#,;]+)/g,
        ),
      ]
        // References such as ${{ secrets.X }} or $VAR are not values.
        .filter((m) => m[2] !== undefined && !m[2].startsWith('$'))
        .map((m) => ({ rule: 'secret-assignment', match: `${m[1]}=${m[2]}` })),
  },
  {
    rule: 'vite-secret-variable',
    find: (line) =>
      [...line.matchAll(/\bVITE_[A-Z0-9_]*(?:SECRET|SERVICE)[A-Z0-9_]*\b/g)].map((m) => ({
        rule: 'vite-secret-variable',
        match: m[0],
      })),
  },
];

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

function repoFiles() {
  const stdout = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return stdout
    .split('\0')
    .filter(Boolean)
    .map((file) => join(ROOT, file))
    .filter((file) => existsSync(file) && statSync(file).isFile());
}

/** @param {Buffer} buffer */
function isBinary(buffer) {
  return buffer.subarray(0, 8000).includes(0);
}

/** @type {Array<{ file: string, line: number, rule: string, value: string }>} */
const findings = [];
/** @type {Set<string>} */
const scanned = new Set();

/** @param {string} file */
function scanFile(file) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (rel === SELF || scanned.has(rel)) return;
  scanned.add(rel);

  const buffer = readFileSync(file);
  if (isBinary(buffer)) return;

  const lines = buffer.toString('utf8').split(/\r?\n/);
  lines.forEach((text, index) => {
    for (const { find } of RULES) {
      for (const hit of find(text)) {
        findings.push({ file: rel, line: index + 1, rule: hit.rule, value: mask(hit.match) });
      }
    }
  });
}

if (existsSync(DIST) && statSync(DIST).isDirectory()) {
  for (const file of walk(DIST)) scanFile(file);
}
if (SCAN_REPO) {
  for (const file of repoFiles()) scanFile(file);
}

if (findings.length > 0) {
  console.error(
    `check-secrets: ${findings.length} finding(s). Remove the value and rotate the key.\n`,
  );
  for (const f of findings) console.error(`  ${f.file}:${f.line}  ${f.rule}  ${f.value}`);
  process.exit(1);
}

console.log(`check-secrets: scanned ${scanned.size} files, no secrets found.`);
