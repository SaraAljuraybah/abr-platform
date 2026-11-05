import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, type InitialEntry, RouterProvider } from 'react-router';
import type { AuthState } from '@/features/auth/auth-context';
import { routes } from '@/test/routes';
import { authStore } from './auth-store';
import { MutableAuth } from './MutableAuth';
import { signedOut } from './render-route';

/** The real route table at `entry` (a path or { pathname, hash, state }) with a mutable auth state. */
export function renderWithAuthStore(entry: InitialEntry, initial: AuthState = signedOut) {
  authStore.set(initial);
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MutableAuth>
        <RouterProvider router={router} />
      </MutableAuth>
    </QueryClientProvider>,
  );
  return router;
}
