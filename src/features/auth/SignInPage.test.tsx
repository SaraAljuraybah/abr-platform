import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type ReactNode, useSyncExternalStore } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { routes } from '@/routes/routes';
import { axeViolations } from '@/test/axe';
import { signedOut } from '@/test/render-route';

const auth = vi.hoisted(() => ({ signInWithPassword: vi.fn(), resend: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));

const session = { user: { id: '00000000-0000-0000-0000-000000000001' } } as unknown as Session;
const signedIn: AuthState = { status: 'ready', session, role: 'student', onboarded: true };
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

/** Stands in for AuthProvider: tests flip the session the way onAuthStateChange would. */
const authStore = (() => {
  let state = signedOut;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set: (next: AuthState) => {
      state = next;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();

function MutableAuth({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(authStore.subscribe, authStore.get);
  return <AuthContext value={state}>{children}</AuthContext>;
}

async function renderSignIn(path = '/sign-in', initial: AuthState = signedOut) {
  authStore.set(initial);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MutableAuth>
        <RouterProvider router={router} />
      </MutableAuth>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

type Copy = (typeof copy)[Language];

async function submit(
  user: ReturnType<typeof userEvent.setup>,
  t: Copy,
  email: string,
  password: string,
) {
  if (email) await user.type(screen.getByLabelText(t.auth.signIn.email), email);
  if (password) await user.type(screen.getByLabelText(t.auth.signIn.password), password);
  await user.click(screen.getByRole('button', { name: t.auth.signIn.submit }));
}

const credentialsError = () => ({
  data: {},
  error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
});
const unconfirmedError = () => ({
  data: {},
  error: new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'),
});

beforeEach(() => {
  auth.signInWithPassword.mockReset();
  auth.resend.mockReset();
});

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('sign-in page (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('renders the title, fields with autocomplete, and links', async () => {
    await renderSignIn();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t.auth.signIn.title);
    expect(screen.getByText(t.auth.signIn.subtitle)).toBeInTheDocument();

    const email = screen.getByLabelText(t.auth.signIn.email);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    const password = screen.getByLabelText(t.auth.signIn.password);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');

    expect(screen.getByRole('link', { name: t.auth.signIn.forgotPassword })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: t.auth.signIn.createAccount })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('shows localized validation errors and does not call Supabase', async () => {
    const user = userEvent.setup();
    await renderSignIn();
    await submit(user, t, '', '');

    const email = screen.getByLabelText(t.auth.signIn.email);
    const password = screen.getByLabelText(t.auth.signIn.password);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(t.validation.required);
    expect(password).toHaveAccessibleDescription(t.validation.required);
    expect(email).toHaveFocus();

    await user.type(email, 'not-an-email');
    await user.click(screen.getByRole('button', { name: t.auth.signIn.submit }));
    expect(email).toHaveAccessibleDescription(t.validation.email);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('submits with Enter', async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue(credentialsError());
    await renderSignIn();
    await user.type(screen.getByLabelText(t.auth.signIn.email), 'student@uni.example');
    await user.type(screen.getByLabelText(t.auth.signIn.password), 'Password1{Enter}');
    await waitFor(() => {
      expect(auth.signInWithPassword).toHaveBeenCalledTimes(1);
    });
  });

  it('toggles password visibility with a changing accessible name', async () => {
    const user = userEvent.setup();
    await renderSignIn();
    const password = screen.getByLabelText(t.auth.signIn.password);

    const toggle = screen.getByRole('button', { name: t.passwordField.show });
    expect(toggle).not.toHaveAttribute('aria-pressed');
    await user.click(toggle);
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: t.passwordField.hide }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('shows the generic credentials error, focused, without a live region', async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue(credentialsError());
    await renderSignIn();
    await submit(user, t, 'student@uni.example', 'wrong-password');

    const message = await screen.findByText(t.auth.errors.invalidCredentials);
    const callout = message.closest('[tabindex="-1"]');
    await waitFor(() => {
      expect(callout).toHaveFocus();
    });
    expect(callout).not.toHaveAttribute('role');
    expect(callout).not.toHaveAttribute('aria-live');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'student@uni.example',
      password: 'wrong-password',
    });
  });

  it('shows the unconfirmed-email message and resends the link', async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue(unconfirmedError());
    auth.resend.mockResolvedValue({ data: {}, error: null });
    await renderSignIn();
    await submit(user, t, '  new@uni.example ', 'Correct-pass1');

    const expected = t.auth.errors.emailNotConfirmed.replace('{{email}}', '⁨new@uni.example⁩');
    expect(await screen.findByText(expected)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.auth.resend.action }));
    expect(auth.resend).toHaveBeenCalledWith({ type: 'signup', email: 'new@uni.example' });
    expect(await screen.findByRole('status')).toHaveTextContent(t.auth.resend.sent);
  });

  it('announces a rate-limited resend', async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue(unconfirmedError());
    auth.resend.mockResolvedValue({
      data: {},
      error: new AuthApiError('Too many', 429, 'over_email_send_rate_limit'),
    });
    await renderSignIn();
    await submit(user, t, 'new@uni.example', 'Correct-pass1');
    await user.click(await screen.findByRole('button', { name: t.auth.resend.action }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.auth.errors.rateLimited);
  });

  it.each([
    [
      'rate-limited',
      () => new AuthApiError('Too many', 429, 'over_request_rate_limit'),
      'rateLimited',
    ],
    ['network', () => new AuthRetryableFetchError('Failed to fetch', 0), 'network'],
  ] as const)('shows the %s message', async (_name, makeError, key) => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: makeError() });
    await renderSignIn();
    await submit(user, t, 'student@uni.example', 'Password1');
    const message = await screen.findByText(t.auth.errors[key]);
    await waitFor(() => {
      expect(message.closest('[tabindex="-1"]')).toHaveFocus();
    });
  });

  it('shows the loading state while signing in', async () => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockReturnValue(new Promise(() => undefined));
    await renderSignIn();
    await submit(user, t, 'student@uni.example', 'Password1');

    const button = await screen.findByRole('button', { name: t.auth.signIn.submitting });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it(
    'axe: empty form, validation errors and the error message have no violations',
    async () => {
      const user = userEvent.setup();
      auth.signInWithPassword.mockResolvedValue(credentialsError());
      await renderSignIn();
      expect(await axeViolations()).toEqual([]);

      await submit(user, t, '', '');
      expect(await axeViolations()).toEqual([]);

      await submit(user, t, 'student@uni.example', 'wrong-password');
      await screen.findByText(t.auth.errors.invalidCredentials);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('sign-in messages follow the language', () => {
  it('re-renders validation errors when the language changes', async () => {
    const user = userEvent.setup();
    await renderSignIn();
    await submit(user, en, '', '');
    expect(screen.getAllByText(en.validation.required)).toHaveLength(2);

    await act(() => changeLanguage('ar'));
    expect(screen.getAllByText(ar.validation.required)).toHaveLength(2);
  });
});

describe('sign-in redirects', () => {
  it.each([
    ['/sign-in', '/app'],
    ['/sign-in?next=%2F%2Fevil.com', '/app'],
    ['/sign-in?next=https%3A%2F%2Fevil.com', '/app'],
    ['/sign-in?next=%2Fadmin', '/admin'],
  ])('after success at %s goes to %s', async (path, expected) => {
    const user = userEvent.setup();
    auth.signInWithPassword.mockImplementation(() => {
      act(() => {
        authStore.set({ ...signedIn, role: 'admin' });
      });
      return Promise.resolve({ data: {}, error: null });
    });
    const router = await renderSignIn(path);
    await submit(user, en, 'student@uni.example', 'Password1');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(expected);
    });
    expect(router.state.location.search).toBe('');
  });

  it.each(['/sign-in', '/sign-in?next=%2F%2Fevil.com', '/sign-in?next=https%3A%2F%2Fevil.com'])(
    'sends an already signed-in visitor at %s to /app',
    async (path) => {
      const router = await renderSignIn(path, signedIn);
      expect(router.state.location.pathname).toBe('/app');
      expect(router.state.historyAction).toBe('REPLACE');
      expect(auth.signInWithPassword).not.toHaveBeenCalled();
    },
  );
});
