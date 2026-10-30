import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { routes } from '@/routes/routes';

export const signedOut: AuthState = {
  status: 'ready',
  session: null,
  role: null,
  onboarded: false,
};

/** Renders the real route table at `path` with a given auth state and a fresh query client. */
export function renderRoute(path: string, auth: AuthState = signedOut) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  );
  return { router, ...view };
}
