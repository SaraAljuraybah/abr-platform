import { describe, expect, it } from 'vitest';
import { axeViolations } from './axe';

describe('axeViolations helper', () => {
  it('reports real violations (proves the check is not a no-op)', async () => {
    // Built with DOM APIs: jsx-a11y would (rightly) reject this markup in JSX.
    const container = document.createElement('main');
    container.append(document.createElement('img'), document.createElement('button'));
    container.querySelector('img')?.setAttribute('src', '/brand/abr-logo.png');
    document.body.append(container);
    try {
      const violations = await axeViolations(container);
      expect(violations.some((v) => v.startsWith('image-alt'))).toBe(true);
      expect(violations.some((v) => v.startsWith('button-name'))).toBe(true);
    } finally {
      container.remove();
    }
  }, 60_000);
});
