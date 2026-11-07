import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { routes } from '@/test/routes';
import { type AuthState, useAuth } from './auth-context';
import { AuthProvider } from './AuthProvider';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const session = { user: { id: USER_ID } } as unknown as Session;

/** The parts of supabase-js that AuthProvider touches: the session and its own profile row. */
const mock = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  maybeSingle: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: mock.getSession, onAuthStateChange: mock.onAuthStateChange },
    from: mock.from,
  },
}));

function withSession(value: Session | null) {
  mock.getSession.mockResolvedValue({ data: { session: value }, error: null });
}
function profileRow(row: Record<string, unknown> | null) {
  mock.maybeSingle.mockResolvedValue({ data: row, error: null });
}

let seen: AuthState[] = [];
function Probe() {
  const state = useAuth();
  seen.push(state);
  return (
    <output data-testid="auth">
      {JSON.stringify({ ...state, session: state.session ? 'yes' : null })}
    </output>
  );
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderProvider() {
  render(
    <QueryClientProvider client={newQueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

async function settled(): Promise<Record<string, unknown>> {
  let parsed: Record<string, unknown> = {};
  await waitFor(() => {
    parsed = JSON.parse(screen.getByTestId('auth').textContent) as Record<string, unknown>;
    expect(parsed.status).toBe('ready');
  });
  return parsed;
}

beforeEach(() => {
  seen = [];
  Object.values(mock).forEach((fn) => fn.mockReset());
  mock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  mock.from.mockReturnValue({ select: mock.select });
  mock.select.mockReturnValue({ eq: mock.eq });
  mock.eq.mockReturnValue({ maybeSingle: mock.maybeSingle });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthProvider profile', () => {
  it('signed out: ready with no role, and the profile is never queried', async () => {
    withSession(null);
    renderProvider();
    expect(await settled()).toEqual({
      status: 'ready',
      session: null,
      role: null,
      verificationStatus: null,
      onboarded: false,
    });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it('signed in: stays loading until the profile arrives, then exposes it', async () => {
    withSession(session);
    let resolve: (value: unknown) => void = () => undefined;
    mock.maybeSingle.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderProvider();

    await waitFor(() => {
      expect(mock.maybeSingle).toHaveBeenCalled();
    });
    expect(seen.at(-1)?.status).toBe('loading');
    // The session must never be "ready" without its profile, or guards would redirect too early.
    expect(seen.some((state) => state.session && state.status === 'ready')).toBe(false);

    resolve({
      data: { role: 'student', verification_status: 'verified', onboarding_completed: false },
      error: null,
    });
    expect(await settled()).toEqual({
      status: 'ready',
      session: 'yes',
      role: 'student',
      verificationStatus: 'verified',
      onboarded: false,
    });
    expect(mock.from).toHaveBeenCalledWith('profiles');
    expect(mock.select).toHaveBeenCalledWith(
      'role, verification_status, onboarding_completed, full_name',
    );
    expect(mock.eq).toHaveBeenCalledWith('id', USER_ID);
  });

  it.each([
    ['organization', 'pending', true],
    ['mentor', 'rejected', false],
    ['admin', 'verified', true],
  ])('maps a %s / %s / onboarded=%s profile', async (role, status, onboarded) => {
    withSession(session);
    profileRow({ role, verification_status: status, onboarding_completed: onboarded });
    renderProvider();
    expect(await settled()).toMatchObject({ role, verificationStatus: status, onboarded });
  });

  it('no profile row: ready, role null, not onboarded', async () => {
    withSession(session);
    profileRow(null);
    renderProvider();
    expect(await settled()).toMatchObject({ session: 'yes', role: null, onboarded: false });
  });

  it('a failed profile request: ready, role null, logged without detail on screen', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    withSession(session);
    mock.maybeSingle.mockResolvedValue({ data: null, error: { code: '500', message: 'boom' } });
    renderProvider();
    expect(await settled()).toMatchObject({ session: 'yes', role: null, onboarded: false });
    expect(log).toHaveBeenCalledWith('Profile failed to load', expect.anything());
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});

describe('AuthProvider + route guards (real profile)', () => {
  function renderAt(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });
    render(
      <QueryClientProvider client={newQueryClient()}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    return router;
  }

  it('a new student (not onboarded) is sent from /app to /onboarding', async () => {
    withSession(session);
    profileRow({ role: 'student', verification_status: 'verified', onboarding_completed: false });
    const router = renderAt('/app');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Set up your profile' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/onboarding');
  });

  it('an onboarded student reaches /app but is sent from /admin to /app', async () => {
    withSession(session);
    profileRow({ role: 'student', verification_status: 'verified', onboarding_completed: true });
    const router = renderAt('/admin');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app');
  });

  it('an onboarded admin reaches /admin', async () => {
    withSession(session);
    profileRow({ role: 'admin', verification_status: 'verified', onboarding_completed: true });
    const router = renderAt('/admin');
    // The admin overview (SCRUM-19) replaced the placeholder.
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin');
  });

  it('does not redirect while the profile is loading', async () => {
    withSession(session);
    mock.maybeSingle.mockReturnValue(new Promise(() => undefined));
    const router = renderAt('/app');
    await waitFor(() => {
      expect(mock.maybeSingle).toHaveBeenCalled();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(router.state.location.pathname).toBe('/app');
  });
});
