import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
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

  // jsdom has no ResizeObserver; Radix (RadioGroup) measures with it. Nothing in tests resizes.
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    };
  }
}

// Lazy routes (sign-in, sign-up) can take over the default 1 s to load on a busy machine with
// the local Supabase stack running; findBy* waits up to 5 s instead.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
