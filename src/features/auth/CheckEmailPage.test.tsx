import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { renderWithAuthStore } from '@/test/render-with-auth-store';
import { axeViolations } from '@/test/axe';
import { formatCountdown } from './use-cooldown';

const auth = vi.hoisted(() => ({ resend: vi.fn(), initialize: vi.fn(), getSession: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const EMAIL = 'student@uni.example';

async function renderCheckEmail(state?: unknown) {
  const router = renderWithAuthStore({ pathname: '/check-email', state });
  await screen.findByRole('heading', { level: 1 });
  return router;
}

/** Moves the faked clock and lets the cooldown's interval run. */
function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  auth.resend.mockReset();
  // Only the cooldown's clock is faked; promises, lazy routes and user-event keep real timers.
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
});

afterEach(async () => {
  vi.useRealTimers();
  await changeLanguage('en');
});

describe('formatCountdown', () => {
  it.each([
    [60, '1:00'],
    [42, '0:42'],
    [5, '0:05'],
    [0, '0:00'],
  ])('%i → %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text);
  });
});

describe.each(['en', 'ar'] as const)('check-email page (%s)', (language) => {
  const t = copy[language];
  const cooldown = (time: string) => t.auth.resend.cooldown.replace('{{time}}', time);

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('with the address from router state: bold LTR email, tip, resend and links', async () => {
    await renderCheckEmail({ email: EMAIL });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.auth.checkEmail.title);

    const address = screen.getByText(EMAIL);
    expect(address.tagName).toBe('STRONG');
    expect(address).toHaveAttribute('dir', 'ltr');
    expect(address.parentElement).toHaveTextContent(
      t.auth.checkEmail.bodyWithEmail.replace(/<\/?email>/g, '').replace('{{email}}', EMAIL),
    );
    expect(screen.getByText(t.auth.checkEmail.tip)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: cooldown('1:00') })).toBeDisabled();

    expect(screen.getByRole('link', { name: t.auth.checkEmail.signUpAgain })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.getByRole('link', { name: t.auth.checkEmail.signIn })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it.each([
    ['no state (refresh or direct visit)', undefined],
    ['an empty email', { email: '  ' }],
    ['a non-string email', { email: 42 }],
  ])('with %s: the generic text, no address and no resend button', async (_case, state) => {
    await renderCheckEmail(state);
    expect(screen.getByText(t.auth.checkEmail.body)).toBeInTheDocument();
    expect(screen.queryByText(t.auth.checkEmail.tip)).toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
    expect(document.querySelector('strong')).toBeNull();
    expect(screen.getByRole('link', { name: t.auth.checkEmail.signUpAgain })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.auth.checkEmail.signIn })).toBeInTheDocument();
  });

  it('ignores an email in the URL', async () => {
    renderWithAuthStore(`/check-email?email=${encodeURIComponent(EMAIL)}`);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(EMAIL)).toBeNull();
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
  });

  it('counts down from page load, then resends, announces it and starts again', async () => {
    const user = userEvent.setup();
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await renderCheckEmail({ email: EMAIL });

    advance(18_000);
    expect(screen.getByRole('button', { name: cooldown('0:42') })).toBeDisabled();
    advance(41_000);
    expect(screen.getByRole('button', { name: cooldown('0:01') })).toBeDisabled();
    advance(1_000);
    const button = screen.getByRole('button', { name: t.auth.resend.action });
    expect(button).toBeEnabled();

    await user.click(button);
    expect(auth.resend).toHaveBeenCalledTimes(1);
    expect(auth.resend).toHaveBeenCalledWith({
      type: 'signup',
      email: EMAIL,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    });

    const status = await screen.findByText(t.auth.resend.sent);
    expect(status.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    expect(await screen.findByRole('button', { name: cooldown('1:00') })).toBeDisabled();
  });

  it.each([
    [
      'rateLimited',
      () => new AuthApiError('Too many', 429, 'over_email_send_rate_limit'),
      t.auth.errors.rateLimited,
    ],
    ['network', () => new AuthRetryableFetchError('Failed to fetch', 0), t.auth.errors.network],
    ['unexpected', () => new AuthRetryableFetchError('Bad gateway', 502), t.auth.errors.unexpected],
  ])(
    'a %s resend error is shown as an alert and keeps the button usable',
    async (_kind, error, message) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const user = userEvent.setup();
      auth.resend.mockResolvedValue({ data: {}, error: error() });
      await renderCheckEmail({ email: EMAIL });
      advance(60_000);

      await user.click(screen.getByRole('button', { name: t.auth.resend.action }));
      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(screen.queryByText(t.auth.resend.sent)).toBeNull();
      // A failed send does not restart the cooldown.
      expect(screen.getByRole('button', { name: t.auth.resend.action })).toBeEnabled();
    },
  );

  it(
    'axe: with and without an address, and after a resend',
    async () => {
      const user = userEvent.setup();
      auth.resend.mockResolvedValue({ data: {}, error: null });
      await renderCheckEmail({ email: EMAIL });
      expect(await axeViolations()).toEqual([]);

      advance(60_000);
      await user.click(screen.getByRole('button', { name: t.auth.resend.action }));
      await screen.findByText(t.auth.resend.sent);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the generic version',
    async () => {
      await renderCheckEmail();
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
