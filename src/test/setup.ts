import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node-environment tests (e.g. tests/tooling) have no DOM; only initialise i18n where one exists.
if (typeof document !== 'undefined') {
  await import('@/lib/i18n');
}

afterEach(() => {
  cleanup();
});
