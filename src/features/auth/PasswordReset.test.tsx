import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { routes } from '@/test/routes';

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const SLOW = { timeout: 5_000 };
const GOOD_PASSWORD = 'Correct-pass1';

/** A controllable Supabase Auth: whether a (recovery) session exists, and what each call answers. */
const auth = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string; email_confirmed_at: string } },
  listener: null as null | ((event: string, session: unknown) => void),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      initialize: () => Promise.resolve({ error: null }),
      getSession: () => Promise.resolve({ data: { session: auth.session }, error: null }),
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        auth.listener = callback;
        return { data: { subscription: { unsubscribe: () => undefined } } };
      },
      resetPasswordForEmail: auth.resetPasswordForEmail,
      updateUser: auth.updateUser,
      signOut: (options: unknown) => {
        auth.signOut(options);
        auth.session = null;
        auth.listener?.('SIGNED_OUT', null);
        return Promise.resolve({ error: null });
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                role: 'student',
                verification_status: 'verified',
                onboarding_completed: true,
                full_name: 'Sara Student',
              },
              error: null,
            }),
        }),
      }),
    }),
  },
}));

async function load(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 }, SLOW);
  return router;
}

type Copy = (typeof copy)[Language];
const setupUser = () => userEvent.setup({ delay: null });

beforeAll(async () => {
  await import('@/features/auth/ForgotPasswordPage');
  await import('@/features/auth/ResetPasswordPage');
});

beforeEach(() => {
  auth.session = null;
  auth.listener = null;
  auth.resetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  auth.updateUser.mockReset().mockResolvedValue({ data: { user: {} }, error: null });
  auth.signOut.mockReset();
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('/forgot-password (%s)', (language) => {
  const t: Copy = copy[language];
  const f = t.auth.forgot;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('sends a reset link to /reset-password and shows the same answer for any address', async () => {
    const user = setupUser();
    await load('/forgot-password');
    expect(screen.getByRole('heading', { level: 1, name: f.title })).toBeInTheDocument();
    expect(screen.getByText(f.intro)).toBeInTheDocument();
    const email = screen.getByLabelText(t.auth.signIn.email);
    expect(email).toHaveAttribute('dir', 'ltr');

    await user.click(screen.getByRole('button', { name: f.submit }));
    expect(await screen.findByText(t.validation.required)).toBeInTheDocument();
    expect(auth.resetPasswordForEmail).not.toHaveBeenCalled();

    await user.type(email, '  nobody@example.com ');
    await user.click(screen.getByRole('button', { name: f.submit }));
    const heading = await screen.findByRole('heading', { level: 1, name: f.sentTitle });
    await waitFor(() => {
      expect(heading).toHaveFocus();
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('nobody@example.com', {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Says "if an account exists": the same words for an address with or without one.
    expect(heading.parentElement).toHaveTextContent(
      f.sentBody.replace(/<\/?email>/g, '').replace('{{email}}', 'nobody@example.com'),
    );
    // Same cooldown as the confirmation resend: starts right away.
    expect(screen.getByRole('button', { name: /\d:\d\d/ })).toBeDisabled();
    expect(screen.getByRole('link', { name: f.backToSignIn })).toHaveAttribute('href', '/sign-in');
  });

  it('send again works after the cooldown', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ delay: null, advanceTimers: vi.advanceTimersByTime });
    await load('/forgot-password');
    await user.type(screen.getByLabelText(t.auth.signIn.email), 'sara@ksu.edu.sa');
    await user.click(screen.getByRole('button', { name: f.submit }));
    await screen.findByRole('heading', { level: 1, name: f.sentTitle });
    act(() => {
      vi.advanceTimersByTime(61_000);
    });
    const again = await screen.findByRole('button', { name: t.auth.resend.action });
    await user.click(again);
    await waitFor(() => {
      expect(auth.resetPasswordForEmail).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(t.auth.resend.sent)).toBeInTheDocument();
  });

  it.each([
    [
      'a rate limit',
      () => new AuthApiError('Too many', 429, 'over_email_send_rate_limit'),
      'rateLimited',
    ],
    ['a network error', () => new AuthRetryableFetchError('Failed to fetch', 0), 'network'],
  ] as const)(
    '%s is explained, and nothing says whether the account exists',
    async (_name, error, kind) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      auth.resetPasswordForEmail.mockResolvedValue({ data: null, error: error() });
      const user = setupUser();
      await load('/forgot-password');
      await user.type(screen.getByLabelText(t.auth.signIn.email), 'sara@ksu.edu.sa');
      await user.click(screen.getByRole('button', { name: f.submit }));
      const message = await screen.findByText(t.auth.errors[kind]);
      await waitFor(() => {
        expect(message.closest('[tabindex="-1"]')).toHaveFocus();
      });
      expect(screen.getByRole('heading', { level: 1, name: f.title })).toBeInTheDocument();
    },
  );

  it(
    'axe: the form and the sent state have no violations',
    async () => {
      const user = setupUser();
      await load('/forgot-password');
      expect(await axeViolations()).toEqual([]);
      await user.type(screen.getByLabelText(t.auth.signIn.email), 'sara@ksu.edu.sa');
      await user.click(screen.getByRole('button', { name: f.submit }));
      await screen.findByRole('heading', { level: 1, name: f.sentTitle });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('/reset-password (%s)', (language) => {
  const t: Copy = copy[language];
  const r = t.auth.reset;
  const signedInByLink = () => {
    auth.session = {
      user: {
        id: '00000000-0000-0000-0000-00000000000a',
        email: 'sara@ksu.edu.sa',
        email_confirmed_at: '2026-11-01',
      },
    };
  };

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('no session (expired, used or opened directly): ask for a new link', async () => {
    await load('/reset-password');
    expect(
      await screen.findByRole('heading', { level: 1, name: r.failedTitle }, SLOW),
    ).toBeInTheDocument();
    expect(screen.getByText(r.failedBody)).toBeInTheDocument();
    expect(screen.getByLabelText(t.auth.signIn.email)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.auth.forgot.backToSignIn })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('the recovery link: the tokens leave the address bar, then the new-password form', async () => {
    signedInByLink();
    const router = await load('/reset-password#access_token=secret&type=recovery');
    expect(
      await screen.findByRole('heading', { level: 1, name: r.title }, SLOW),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.hash).toBe('');
    });
    expect(screen.getByLabelText(r.password)).toHaveAttribute('autocomplete', 'new-password');
    // The same strength checklist as sign-up.
    expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('validates the strength and the confirmation, then saves, signs out and offers sign-in', async () => {
    signedInByLink();
    const user = setupUser();
    await load('/reset-password');
    await screen.findByRole('heading', { level: 1, name: r.title }, SLOW);

    await user.type(screen.getByLabelText(r.password), 'alllowercase1');
    await user.type(screen.getByLabelText(r.confirm), 'alllowercase1');
    await user.click(screen.getByRole('button', { name: r.submit }));
    expect(await screen.findByText(t.auth.signUp.passwordNotMet)).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(r.password));
    await user.type(screen.getByLabelText(r.password), GOOD_PASSWORD);
    await user.clear(screen.getByLabelText(r.confirm));
    await user.type(screen.getByLabelText(r.confirm), 'Correct-pass2');
    await user.click(screen.getByRole('button', { name: r.submit }));
    expect(await screen.findByText(r.mismatch)).toBeInTheDocument();
    expect(auth.updateUser).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(r.confirm));
    await user.type(screen.getByLabelText(r.confirm), GOOD_PASSWORD);
    await user.click(screen.getByRole('button', { name: r.submit }));
    const done = await screen.findByRole('heading', { level: 1, name: r.doneTitle }, SLOW);
    await waitFor(() => {
      expect(done).toHaveFocus();
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: GOOD_PASSWORD });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(screen.getByRole('link', { name: r.signIn })).toHaveAttribute('href', '/sign-in');
  });

  it.each([
    ['same_password', () => new AuthApiError('Same', 422, 'same_password'), 'samePassword'],
    ['weak_password', () => new AuthWeakPasswordError('Weak', 422, ['pwned']), 'weakPassword'],
    [
      'an expired session',
      () => new AuthApiError('Expired', 401, 'session_not_found'),
      'resetLinkInvalid',
    ],
  ] as const)('%s is explained', async (_name, error, kind) => {
    signedInByLink();
    auth.updateUser.mockResolvedValue({ data: { user: null }, error: error() });
    const user = setupUser();
    await load('/reset-password');
    await screen.findByRole('heading', { level: 1, name: r.title }, SLOW);
    await user.type(screen.getByLabelText(r.password), GOOD_PASSWORD);
    await user.type(screen.getByLabelText(r.confirm), GOOD_PASSWORD);
    await user.click(screen.getByRole('button', { name: r.submit }));
    expect(await screen.findByText(t.auth.errors[kind])).toBeInTheDocument();
    expect(auth.signOut).not.toHaveBeenCalled();
    if (kind === 'resetLinkInvalid') {
      expect(screen.getByRole('link', { name: r.requestNew })).toHaveAttribute(
        'href',
        '/forgot-password',
      );
    }
  });

  it(
    'axe: the form, the result and the expired link have no violations',
    async () => {
      signedInByLink();
      const user = setupUser();
      await load('/reset-password');
      await screen.findByRole('heading', { level: 1, name: r.title }, SLOW);
      expect(await axeViolations()).toEqual([]);
      await user.type(screen.getByLabelText(r.password), GOOD_PASSWORD);
      await user.type(screen.getByLabelText(r.confirm), GOOD_PASSWORD);
      await user.click(screen.getByRole('button', { name: r.submit }));
      await screen.findByRole('heading', { level: 1, name: r.doneTitle }, SLOW);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the expired-link state has no violations',
    async () => {
      await load('/reset-password');
      await screen.findByRole('heading', { level: 1, name: r.failedTitle }, SLOW);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
