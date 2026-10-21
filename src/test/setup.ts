import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Node-environment tests (e.g. tests/tooling) have no DOM; only initialise i18n where one exists.
if (typeof document !== 'undefined') {
  await import('@/lib/i18n');

  // React Router's data router builds a Node (undici) Request with jsdom's AbortSignal, which
  // undici rejects ("Expected signal to be an instance of AbortSignal"). Tests never abort
  // navigations, so drop the foreign signal. Test environment only; the browser is unaffected.
  const NodeRequest = globalThis.Request;
  globalThis.Request = class extends NodeRequest {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(input, init ? { ...init, signal: null } : init);
    }
  };
}

afterEach(() => {
  cleanup();
});
