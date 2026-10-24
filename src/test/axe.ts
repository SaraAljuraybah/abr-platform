import axe from 'axe-core';

/**
 * Runs axe-core (WCAG 2.0–2.2 A/AA + best practices) and returns a readable list of violations.
 * jsdom cannot compute rendered colours, so color-contrast is disabled here; contrast is verified
 * with Lighthouse and sampled ratios on the real build instead.
 */
export async function axeViolations(context: Element | Document = document): Promise<string[]> {
  const results = await axe.run(context, {
    runOnly: {
      type: 'tag',
      values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
    },
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
}
