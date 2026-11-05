import type { RouteObject } from 'react-router';
import { beforeAll } from 'vitest';
import { routes } from '@/routes/routes';

/**
 * Tests import the route table from here, never from '@/routes/routes'. Importing this module
 * registers a beforeAll that loads every lazy route once, so a test's findBy waits on rendering
 * only, never on code-splitting (which can take seconds on a busy machine). Production keeps its
 * lazy loading: this file only calls the same `lazy` functions the router calls.
 *
 * The hook runs after the test file is collected, so the file's vi.mock() calls (for example the
 * Supabase client) already apply to the modules loaded here.
 */
async function preloadLazyRoutes(list: readonly RouteObject[]): Promise<void> {
  await Promise.all(
    list.map(async (route) => {
      if (typeof route.lazy === 'function') await route.lazy();
      if (route.children) await preloadLazyRoutes(route.children);
    }),
  );
}

// Generous on purpose: it bounds one-off module loading, not any test's waiting.
beforeAll(() => preloadLazyRoutes(routes), 120_000);

export { routes };
