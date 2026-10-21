import type { Session } from '@supabase/supabase-js';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { routes } from '@/routes/routes';

const session = { user: { id: '00000000-0000-0000-0000-000000000001' } } as unknown as Session;

const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };
// Signed in, but no profile yet: role and onboarding unknown.
const signedInNoProfile: AuthState = { status: 'ready', session, role: null, onboarded: false };
const onboardedStudent: AuthState = { status: 'ready', session, role: 'student', onboarded: true };
const onboardedAdmin: AuthState = { status: 'ready', session, role: 'admin', onboarded: true };

function renderAt(path: string, auth: AuthState) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <AuthContext value={auth}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  return router;
}

function heading() {
  return screen.getByRole('heading', { level: 1 });
}

describe('route guards (UX only)', () => {
  it.each(['/app', '/admin', '/onboarding'])(
    'sends a signed-out visitor from %s to sign-in with a return path',
    async (path) => {
      const router = renderAt(path, signedOut);
      expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/sign-in');
      expect(new URLSearchParams(router.state.location.search).get('next')).toBe(path);
    },
  );

  it.each(['/app', '/admin'])(
    'sends a signed-in user with null role and onboarding from %s to /onboarding without looping',
    async (path) => {
      const router = renderAt(path, signedInNoProfile);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Onboarding' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/onboarding');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    },
  );

  it('lets a signed-in user without a profile stay on /onboarding', async () => {
    const router = renderAt('/onboarding', signedInNoProfile);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Onboarding' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('lets an onboarded user into /app', async () => {
    const router = renderAt('/app', onboardedStudent);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('sends an onboarded non-admin from /admin to /app', async () => {
    const router = renderAt('/admin', onboardedStudent);
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('lets an onboarded admin into /admin', async () => {
    const router = renderAt('/admin', onboardedAdmin);
    expect(await screen.findByRole('heading', { level: 1, name: 'Admin' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('shows a loading state and does not redirect while the session is loading', async () => {
    const router = renderAt('/app', { ...signedOut, status: 'loading' });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…');
    expect(router.state.location.pathname).toBe('/app');
  });

  it('renders public pages without a session', async () => {
    renderAt('/', signedOut);
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Graduation projects deserve a life after graduation.',
    );
  });

  it('renders the 404 page for unknown paths', async () => {
    renderAt('/does-not-exist', signedOut);
    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(heading()).toHaveTextContent('Page not found');
  });
});
