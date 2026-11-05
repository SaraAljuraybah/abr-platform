import { AuthError, type Session } from '@supabase/supabase-js';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type AppRole,
  type AuthState,
  type VerificationStatus,
} from '@/features/auth/auth-context';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { authStore } from '@/test/auth-store';
import { renderWithAuthStore } from '@/test/render-with-auth-store';
import { axeViolations } from '@/test/axe';
import { signedOut } from '@/test/render-route';

const auth = vi.hoisted(() => ({ resend: vi.fn(), initialize: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const TOKEN_HASH = '#access_token=header.payload.sig&refresh_token=r1&expires_in=3600&type=signup';
const EXPIRED_HASH =
  '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';

function sessionFor(confirmed: boolean) {
  return {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email_confirmed_at: confirmed ? '2026-11-05T09:00:00Z' : undefined,
    },
  } as unknown as Session;
}

function signedIn(
  role: AppRole,
  verificationStatus: VerificationStatus,
  confirmed = true,
): AuthState {
  return {
    status: 'ready',
    session: sessionFor(confirmed),
    role,
    verificationStatus,
    onboarded: false,
  };
}

/** What supabase-js reports after reading the link: initialize() result, then the session. */
function linkWorked() {
  auth.initialize.mockResolvedValue({ error: null });
  auth.getSession.mockResolvedValue({ data: { session: sessionFor(true) }, error: null });
}
function linkFailed() {
  auth.initialize.mockResolvedValue({
    error: new AuthError('Email link is invalid or has expired', undefined, 'otp_expired'),
  });
  auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
}

beforeEach(() => {
  auth.resend.mockReset();
  auth.initialize.mockReset();
  auth.getSession.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('auth/confirmed page (%s)', (language) => {
  const t = copy[language];
  const cooldown = (time: string) => t.auth.resend.cooldown.replace('{{time}}', time);

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('shows the verifying state while supabase-js processes the link', async () => {
    auth.initialize.mockReturnValue(new Promise(() => undefined));
    const router = renderWithAuthStore(`/auth/confirmed${TOKEN_HASH}`);
    expect(await screen.findByRole('status')).toHaveTextContent(t.auth.confirmed.verifying);
    // Not processed yet: the tokens must stay for supabase-js.
    expect(router.state.location.hash).toBe(TOKEN_HASH);
  });

  it.each([
    ['student', 'verified', t.auth.confirmed.student],
    ['organization', 'pending', t.auth.confirmed.reviewed],
    ['mentor', 'pending', t.auth.confirmed.reviewed],
  ] as const)(
    'success for a %s (%s), with Continue to /onboarding and the tokens removed',
    async (role, status, message) => {
      linkWorked();
      const router = renderWithAuthStore(`/auth/confirmed${TOKEN_HASH}`, signedIn(role, status));

      const heading = await screen.findByRole('heading', {
        level: 1,
        name: t.auth.confirmed.title,
      });
      expect(heading).toHaveFocus();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: t.auth.confirmed.continue })).toHaveAttribute(
        'href',
        '/onboarding',
      );
      await waitFor(() => {
        expect(router.state.location.hash).toBe('');
      });
      expect(router.state.location.pathname).toBe('/auth/confirmed');
      expect(router.state.historyAction).toBe('REPLACE');
    },
  );

  it('waits for the session to reach AuthProvider instead of flashing the error', async () => {
    linkWorked();
    renderWithAuthStore(`/auth/confirmed${TOKEN_HASH}`, signedOut);
    expect(await screen.findByRole('status')).toHaveTextContent(t.auth.confirmed.verifying);
    expect(screen.queryByRole('heading', { name: t.auth.confirmed.failed })).toBeNull();

    act(() => {
      authStore.set(signedIn('student', 'verified'));
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.title }),
    ).toBeInTheDocument();
  });

  it('a student whose profile is not verified gets the generic next step', async () => {
    linkWorked();
    renderWithAuthStore('/auth/confirmed', signedIn('student', 'unverified'));
    await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.title });
    expect(screen.getByText(t.auth.confirmed.reviewed)).toBeInTheDocument();
  });

  it.each([
    ['fragment', EXPIRED_HASH, ''],
    ['query', '', '?error=access_denied&error_code=otp_expired'],
  ])(
    'expired or used link (error in the %s): error state, resend form, params removed',
    async (_where, hash, search) => {
      linkFailed();
      const router = renderWithAuthStore(`/auth/confirmed${search}${hash}`);

      const heading = await screen.findByRole('heading', {
        level: 1,
        name: t.auth.confirmed.failed,
      });
      expect(heading).toHaveFocus();
      expect(screen.getByLabelText(t.auth.signIn.email)).toHaveAttribute('type', 'email');
      expect(screen.getByRole('button', { name: cooldown('1:00') })).toBeDisabled();
      expect(screen.getByRole('link', { name: t.auth.confirmed.signIn })).toHaveAttribute(
        'href',
        '/sign-in',
      );
      expect(screen.queryByRole('link', { name: t.auth.confirmed.continue })).toBeNull();
      await waitFor(() => {
        expect(router.state.location.hash).toBe('');
      });
      expect(router.state.location.search).toBe('');
    },
  );

  it('a signed-in user with a confirmed email sees success even when the link failed', async () => {
    linkFailed();
    renderWithAuthStore(`/auth/confirmed${EXPIRED_HASH}`, signedIn('student', 'verified'));
    expect(
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.auth.confirmed.failed)).toBeNull();
  });

  it('a signed-in user without a confirmed email sees the error state', async () => {
    linkFailed();
    renderWithAuthStore(`/auth/confirmed${EXPIRED_HASH}`, signedIn('student', 'unverified', false));
    expect(
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.failed }),
    ).toBeInTheDocument();
  });

  it('a direct visit without a link, signed out, shows the error state', async () => {
    auth.initialize.mockResolvedValue({ error: null });
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    renderWithAuthStore('/auth/confirmed');
    expect(
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.failed }),
    ).toBeInTheDocument();
  });

  it('the error state validates the email and resends after the cooldown', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    const user = userEvent.setup();
    linkFailed();
    auth.resend.mockResolvedValue({ data: {}, error: null });
    renderWithAuthStore(`/auth/confirmed${EXPIRED_HASH}`);
    await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.failed });

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const email = screen.getByLabelText(t.auth.signIn.email);
    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: t.auth.resend.action }));
    expect(email).toHaveAccessibleDescription(t.validation.email);
    expect(auth.resend).not.toHaveBeenCalled();

    await user.clear(email);
    await user.type(email, '  student@uni.example ');
    await user.click(screen.getByRole('button', { name: t.auth.resend.action }));
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'student@uni.example',
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    });
    expect(await screen.findByText(t.auth.resend.sent)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: cooldown('1:00') })).toBeDisabled();
  });

  it(
    'axe: success state',
    async () => {
      linkWorked();
      renderWithAuthStore('/auth/confirmed', signedIn('student', 'verified'));
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.title });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: error state',
    async () => {
      linkFailed();
      renderWithAuthStore(`/auth/confirmed${EXPIRED_HASH}`);
      await screen.findByRole('heading', { level: 1, name: t.auth.confirmed.failed });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
