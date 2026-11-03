// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { clientIp, hmacHex } from '../_shared/client-ip.ts';
import { validateInterest } from '../_shared/interest-validate.ts';
import {
  createConfiguredHandler,
  createSubmitInterestHandler,
  MIN_IP_SECRET_LENGTH,
  type SubmitInterestDeps,
} from './handler.ts';

const ORIGIN = 'http://127.0.0.1:5173';
const SECRET = 'test-secret-of-at-least-32-characters!!';

const student = {
  role: 'student',
  full_name: '  Sara Student ',
  email: 'sara@student.test',
  university_code: 'king_saud',
  field_of_study: 'cs',
  graduation_year: '2027_or_later',
  project_stage: 'idea',
  heard_from: 'linkedin',
  consent_contact: true,
  locale: 'ar',
  website: '',
};
const organization = {
  role: 'organization',
  full_name: 'Omar Org',
  email: 'omar@org.test',
  organization_name: 'Org Labs',
  sector: 'technology',
  looking_for: ['hire_talent', 'offer_mentoring'],
  org_size: '51_500',
  heard_from: 'event',
  consent_contact: true,
  locale: 'en',
};
const mentor = {
  role: 'mentor',
  full_name: 'Mona Mentor',
  email: 'mona@mentor.test',
  expertise: 'software_data',
  experience: '8_15',
  heard_from: 'friend',
  heard_from_other: '',
  consent_contact: true,
  locale: 'en',
};

/** Handler with an in-memory rate limiter (5 per key) and a store keyed by lower(email). */
function setup(overrides: Partial<SubmitInterestDeps> = {}) {
  const attempts = new Map<string, number>();
  const rows = new Map<string, { count: number }>();
  const deps: SubmitInterestDeps = {
    allowedOrigins: new Set([ORIGIN]),
    hashIp: (ip) => hmacHex(SECRET, ip),
    consumeRateLimit: vi.fn((key: string) => {
      const used = attempts.get(key) ?? 0;
      if (used >= 5) return Promise.resolve(false);
      attempts.set(key, used + 1);
      return Promise.resolve(true);
    }),
    submit: vi.fn((submission) => {
      const key = submission.email.toLowerCase();
      rows.set(key, { count: (rows.get(key)?.count ?? 0) + 1 });
      return Promise.resolve();
    }),
    logError: vi.fn(),
    ...overrides,
  };
  return { handler: createSubmitInterestHandler(deps), deps, attempts, rows };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/functions/v1/submit-interest', {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      'x-forwarded-for': '198.51.100.20',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('submit-interest: validation', () => {
  it.each([
    ['student', student],
    ['organization', organization],
    ['mentor', mentor],
  ])('accepts a valid %s and saves it once', async (_role, body) => {
    const { handler, deps } = setup();
    const response = await handler(post(body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(deps.submit).toHaveBeenCalledTimes(1);
  });

  it('trims text and fills other roles’ fields with null', () => {
    expect(validateInterest(student)).toMatchObject({
      full_name: 'Sara Student',
      university_other: null,
      organization_name: null,
      looking_for: null,
      expertise: null,
    });
    expect(validateInterest(mentor)?.heard_from_other).toBeNull();
  });

  it.each([
    ['university', { university_code: 'other', university_other: ' Unlisted University ' }],
    ['field of study', { field_of_study: 'other', field_of_study_other: ' Robotics ' }],
    ['heard from', { heard_from: 'other', heard_from_other: ' A podcast ' }],
  ])('accepts "Other" %s with its text, trimmed', (_name, changes) => {
    const result = validateInterest({ ...student, ...changes });
    const [key, value] = Object.entries(changes)[1] ?? [];
    expect(result).not.toBeNull();
    expect(result?.[key as keyof typeof result]).toBe(value?.trim());
  });

  it.each([
    ['role admin', { ...mentor, role: 'admin' }],
    ['unknown option', { ...student, field_of_study: 'cs_it' }],
    ['region (removed)', { ...mentor, region: 'riyadh' }],
    ['unknown heard_from', { ...mentor, heard_from: 'tv' }],
    ['the old channel key', { ...mentor, channel: 'x' }],
    ['heard_from other with empty text', { ...mentor, heard_from: 'other' }],
    ['heard_from other with blank text', { ...mentor, heard_from: 'other', heard_from_other: ' ' }],
    [
      'heard_from other text too long',
      { ...mentor, heard_from: 'other', heard_from_other: 'x'.repeat(101) },
    ],
    ['heard_from text without other', { ...mentor, heard_from_other: 'A podcast' }],
    ['university other without text', { ...student, university_code: 'other' }],
    [
      'university other text too short',
      { ...student, university_code: 'other', university_other: 'A' },
    ],
    ['university text without other', { ...student, university_other: 'Another' }],
    ['field other without text', { ...student, field_of_study: 'other' }],
    [
      'field other text too long',
      { ...student, field_of_study: 'other', field_of_study_other: 'x'.repeat(101) },
    ],
    ['field text without other', { ...student, field_of_study_other: 'Robotics' }],
    ['unknown university', { ...student, university_code: 'mit' }],
    [
      'a university uuid (old shape)',
      { ...student, university_code: 'aaaaaaaa-0000-4000-8000-0000000000a1' },
    ],
    [
      'the old university_id key',
      { ...student, university_id: 'aaaaaaaa-0000-4000-8000-0000000000a1' },
    ],
    ['graduation year outside the list', { ...student, graduation_year: '1999' }],
    ['old project stage', { ...student, project_stage: 'have_idea' }],
    ['empty looking_for', { ...organization, looking_for: [] }],
    ['unknown looking_for item', { ...organization, looking_for: ['hire_talent', 'buy_data'] }],
    ['repeated looking_for item', { ...organization, looking_for: ['hire_talent', 'hire_talent'] }],
    ['consent not given', { ...mentor, consent_contact: false }],
    ['consent as a string', { ...mentor, consent_contact: 'true' }],
    ['no university', { ...student, university_code: '' }],
    ['another role’s field', { ...mentor, sector: 'technology' }],
    ['an unknown key', { ...mentor, phone: '0500000000' }],
    ['a national id', { ...student, national_id: '1000000000' }],
    ['short name', { ...mentor, full_name: ' A ' }],
    ['long name', { ...mentor, full_name: 'x'.repeat(121) }],
    ['bad email', { ...mentor, email: 'mona@mentor' }],
    ['unknown locale', { ...mentor, locale: 'fr' }],
    ['not an object', ['mentor']],
  ])('refuses %s with 400 and saves nothing', async (_name, body) => {
    const { handler, deps } = setup();
    const response = await handler(post(body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid' });
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('refuses malformed JSON and oversized bodies', async () => {
    const { handler } = setup();
    expect((await handler(post('{"role":'))).status).toBe(400);
    expect((await handler(post({ ...mentor, full_name: 'x'.repeat(9_000) }))).status).toBe(400);
  });
});

describe('submit-interest: spam trap', () => {
  it('answers like a real submission and saves nothing', async () => {
    const { handler, deps } = setup();
    const real = await handler(post(mentor));
    const trapped = await handler(post({ ...mentor, website: 'https://spam.example' }));
    expect(trapped.status).toBe(real.status);
    expect(await trapped.text()).toBe(JSON.stringify({ ok: true }));
    expect(deps.submit).toHaveBeenCalledTimes(1);
  });

  it('counts a trapped request against the rate limit', async () => {
    const { handler, deps } = setup();
    await handler(post({ ...mentor, website: 'x' }));
    expect(deps.consumeRateLimit).toHaveBeenCalledTimes(1);
  });
});

describe('submit-interest: no enumeration', () => {
  it('gives a new and a repeat email the same answer, and keeps one row', async () => {
    const { handler, rows } = setup();
    const first = await handler(post(organization));
    const again = await handler(post({ ...organization, email: 'OMAR@org.test' }));
    expect(again.status).toBe(first.status);
    expect(await again.text()).toBe(await first.text());
    expect([...first.headers]).toEqual([...again.headers]);
    expect(rows.size).toBe(1);
    expect(rows.get('omar@org.test')?.count).toBe(2);
  });
});

describe('submit-interest: rate limit', () => {
  it('refuses the sixth attempt from one address with 429, valid or not', async () => {
    const { handler, deps } = setup();
    const statuses = [];
    for (const body of [mentor, mentor, { ...mentor, role: 'x' }, mentor, mentor, mentor]) {
      statuses.push((await handler(post(body))).status);
    }
    expect(statuses).toEqual([200, 200, 400, 200, 200, 429]);
    expect(deps.submit).toHaveBeenCalledTimes(4);
  });

  it('a spoofed leading x-forwarded-for value does not change the key', async () => {
    const { handler, deps } = setup();
    for (const spoofed of ['1.1.1.1', '2.2.2.2', '3.3.3.3, 4.4.4.4']) {
      await handler(post(mentor, { 'x-forwarded-for': `${spoofed}, 203.0.113.9` }));
    }
    const keys = vi.mocked(deps.consumeRateLimit).mock.calls.map(([key]) => key);
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(await hmacHex(SECRET, '203.0.113.9'));
  });

  it('prefers cf-connecting-ip over any x-forwarded-for', async () => {
    const { handler, deps } = setup();
    await handler(post(mentor, { 'cf-connecting-ip': '192.0.2.44', 'x-forwarded-for': '5.5.5.5' }));
    await handler(post(mentor, { 'cf-connecting-ip': '192.0.2.44', 'x-forwarded-for': '6.6.6.6' }));
    const keys = vi.mocked(deps.consumeRateLimit).mock.calls.map(([key]) => key);
    expect(keys).toEqual([
      await hmacHex(SECRET, '192.0.2.44'),
      await hmacHex(SECRET, '192.0.2.44'),
    ]);
  });

  it('uses one shared "unknown" bucket when there is no usable address', async () => {
    const { handler, deps } = setup();
    await handler(post(mentor, { 'x-forwarded-for': '' }));
    await handler(post(mentor, { 'x-forwarded-for': 'not-an-ip' }));
    const keys = vi.mocked(deps.consumeRateLimit).mock.calls.map(([key]) => key);
    expect(keys).toEqual(['unknown', 'unknown']);
  });

  it('never passes the raw address on: the key is a 64-character HMAC', async () => {
    const { handler, deps } = setup();
    await handler(post(mentor, { 'x-forwarded-for': '198.51.100.77' }));
    const [key] = vi.mocked(deps.consumeRateLimit).mock.calls[0] ?? [];
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain('198.51.100.77');
  });

  it('reads the client address the same way in isolation', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': 'evil, 203.0.113.9 ' }))).toBe('203.0.113.9');
    expect(clientIp(new Headers({ 'x-forwarded-for': '203.0.113.9, evil' }))).toBeNull();
    expect(clientIp(new Headers({ 'x-forwarded-for': '2001:db8::1' }))).toBe('2001:db8::1');
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe('submit-interest: CORS and methods', () => {
  it('answers the preflight from an allowed origin', async () => {
    const { handler } = setup();
    const response = await handler(
      new Request('http://localhost', { method: 'OPTIONS', headers: { origin: ORIGIN } }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(ORIGIN);
  });

  it('refuses another origin without CORS headers and without counting or saving', async () => {
    const { handler, deps } = setup();
    const response = await handler(post(mentor, { origin: 'https://evil.example' }));
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(deps.consumeRateLimit).not.toHaveBeenCalled();
    expect(deps.submit).not.toHaveBeenCalled();
  });

  it('refuses methods other than POST', async () => {
    const { handler } = setup();
    const response = await handler(
      new Request('http://localhost', { method: 'GET', headers: { origin: ORIGIN } }),
    );
    expect(response.status).toBe(405);
  });
});

describe('submit-interest: failures', () => {
  it('answers 500 without detail and logs only the error code', async () => {
    const failure = Object.assign(new Error('duplicate key value violates … sara@student.test'), {
      code: '23505',
    });
    const { handler, deps } = setup({ submit: vi.fn(() => Promise.reject(failure)) });
    const response = await handler(post(student));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'failed' });
    expect(deps.logError).toHaveBeenCalledWith('submit-interest failed', { code: '23505' });
  });
});

describe('submit-interest: configuration', () => {
  const env = { supabaseUrl: 'http://localhost:54321', serviceKey: 'service-key-for-tests' };
  const configured = (ipSecret: string | undefined) => {
    const logError = vi.fn();
    const build = vi.fn(() => setup().handler);
    return {
      handler: createConfiguredHandler({ ...env, ipSecret }, build, logError),
      build,
      logError,
    };
  };

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['blank', ' '.repeat(40)],
    ['short (31 characters)', 'x'.repeat(MIN_IP_SECRET_LENGTH - 1)],
  ])(
    'IP hash secret %s: generic 500 for every request, reason logged, secret never',
    async (_name, secret) => {
      const { handler, build, logError } = configured(secret);
      expect(build).not.toHaveBeenCalled();
      for (const request of [post(mentor), post(mentor, { origin: 'https://evil.example' })]) {
        const response = await handler(request);
        expect(response.status).toBe(500);
        expect(await response.text()).toBe('{"error":"failed"}');
      }
      expect(logError).toHaveBeenCalledWith('misconfigured: IP hash secret', {});
      if (secret) expect(JSON.stringify(logError.mock.calls)).not.toContain(secret);
    },
  );

  it('a 32-character secret builds the real handler', async () => {
    const secret = 'y'.repeat(MIN_IP_SECRET_LENGTH);
    const { handler, build, logError } = configured(secret);
    expect(build).toHaveBeenCalledWith({ ...env, ipSecret: secret });
    expect((await handler(post(mentor))).status).toBe(200);
    expect(logError).not.toHaveBeenCalled();
  });

  it('no Supabase environment: generic 500', async () => {
    const logError = vi.fn();
    const handler = createConfiguredHandler(
      { ipSecret: SECRET, supabaseUrl: undefined, serviceKey: undefined },
      () => setup().handler,
      logError,
    );
    expect((await handler(post(mentor))).status).toBe(500);
    expect(logError).toHaveBeenCalledWith('misconfigured: Supabase environment', {});
  });
});
