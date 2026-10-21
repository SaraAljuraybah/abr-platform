// @ts-check
/**
 * RTL guard (CLAUDE.md rule 5, ADR-0008): physical-direction Tailwind classes
 * break the Arabic layout. Use the logical equivalents instead.
 */
// A Tailwind value: 4, 0.5, px, auto, 1/2, [12px], (--var). Hyphenated words such as
// "left-to-right" are prose, not classes. Empty is allowed for `ml-${x}` template parts.
const VALUE = String.raw`(?:[\w.%/]+|\[[^\]]*\]|\([^)]*\))?$`;
/** @param {string} prefix */
const spacing = (prefix) => new RegExp(`^-?${prefix}-${VALUE}`);

const PHYSICAL_CLASS_HINTS = [
  [spacing('m[lr]'), 'ms-* / me-*'],
  [spacing('p[lr]'), 'ps-* / pe-*'],
  [spacing('(?:left|right)'), 'start-* / end-*'],
  [spacing('inset-[lr]'), 'start-* / end-*'],
  [spacing('scroll-m[lr]'), 'scroll-ms-* / scroll-me-*'],
  [spacing('scroll-p[lr]'), 'scroll-ps-* / scroll-pe-*'],
  [/^rounded-[lr](-|$)/, 'rounded-s* / rounded-e*'],
  [/^rounded-[tb][lr](-|$)/, 'rounded-ss* / rounded-se* / rounded-es* / rounded-ee*'],
  [/^border-[lr](-|$)/, 'border-s* / border-e*'],
  [/^text-(left|right)$/, 'text-start / text-end'],
  [/^float-(left|right)$/, 'float-start / float-end'],
  [/^clear-(left|right)$/, 'clear-start / clear-end'],
];

/** @param {string} token */
function physicalHint(token) {
  // Strip variant prefixes (md:, hover:, rtl:, [&>svg]:) and the important modifier.
  const utility = token.slice(token.lastIndexOf(':') + 1).replace(/^!/, '');
  for (const [pattern, hint] of PHYSICAL_CLASS_HINTS) {
    if (/** @type {RegExp} */ (pattern).test(utility)) return /** @type {string} */ (hint);
  }
  return null;
}

/** @type {import('eslint').ESLint.Plugin} */
const abrPlugin = {
  rules: {
    'no-physical-direction-classes': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow physical left/right Tailwind classes; use logical ones for RTL.',
        },
        messages: {
          physical: '"{{token}}" is a physical-direction class and breaks RTL. Use {{hint}}.',
        },
        schema: [],
      },
      create(context) {
        /** @param {import('estree').Node} node @param {string} text */
        function check(node, text) {
          for (const token of text.split(/\s+/)) {
            if (!token) continue;
            const hint = physicalHint(token);
            if (hint) context.report({ node, messageId: 'physical', data: { token, hint } });
          }
        }
        return {
          Literal(node) {
            if (typeof node.value === 'string') check(node, node.value);
          },
          TemplateElement(node) {
            check(node, node.value.cooked ?? node.value.raw);
          },
        };
      },
    },
  },
};

export default abrPlugin;
