import type { Session } from '@supabase/supabase-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AuthState } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { renderRoute, signedOut } from '@/test/render-route';

// Phase 1 launch mode: VITE_AUTH_ENABLED=false (tryabr.com). The default (true) is covered by
// the other route and landing tests; the cases below check both values side by side.

const session = { user: { id: '00000000-0000-0000-0000-000000000001' } } as unknown as Session;
const signedIn: AuthState = {
  status: 'ready',
  session,
  role: 'admin',
  verificationStatus: 'verified',
  onboarded: true,
};
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const ROLES = [
  ['students', 'student'],
  ['organizations', 'organization'],
  ['mentors', 'mentor'],
] as const;

async function renderAt(path: string, language: Language, auth: AuthState = signedOut) {
  await changeLanguage(language);
  const view = renderRoute(path, auth);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

/** Every link on the page that leads to an account screen. */
const accountLinks = () =>
  Array.from(document.querySelectorAll('a[href]')).filter((a) =>
    /^\/(sign-in|sign-up)/.test(a.getAttribute('href') ?? ''),
  );

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('VITE_AUTH_ENABLED=false (%s)', (language) => {
  const t = copy[language];

  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'false');
  });

  it.each([
    '/sign-in',
    '/sign-up',
    '/forms/request-access',
    '/forgot-password',
    '/check-email',
    '/auth/confirmed',
  ])('%s shows "Coming soon" with the interest form and home links', async (path) => {
    await renderAt(path, language);
    const main = screen.getByRole('main');
    expect(
      within(main).getByRole('heading', { level: 1, name: t.comingSoon.title }),
    ).toBeInTheDocument();
    expect(within(main).getByText(t.comingSoon.body)).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: t.comingSoon.cta })).toHaveAttribute(
      'href',
      '/forms/interest',
    );
    expect(within(main).getByRole('link', { name: t.comingSoon.backHome })).toHaveAttribute(
      'href',
      '/',
    );
    // The brand panel of FormLayout is there; no sign-in or sign-up form.
    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it.each([
    ['/app', signedOut],
    ['/onboarding', signedOut],
    ['/admin', signedOut],
    ['/app', signedIn],
    ['/admin', signedIn],
    ['/app/profile', signedOut],
    ['/app/projects/new', signedOut],
    ['/app/profile', signedIn],
    ['/app/projects/new', signedIn],
    ['/app/projects/p-1/edit', signedOut],
    ['/app/projects/p-1/edit', signedIn],
  ] as const)('%s redirects to the coming-soon page', async (path, auth) => {
    const { router } = await renderAt(path, language, auth);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: t.comingSoon.title }),
    ).toBeInTheDocument();
  });

  it.each([
    ['/terms', 'terms'],
    ['/privacy', 'privacy'],
  ] as const)('%s stays public in launch mode, with no account links', async (path, page) => {
    await renderAt(path, language);
    expect(screen.getByRole('heading', { level: 1, name: t[page].title })).toBeInTheDocument();
    expect(accountLinks()).toEqual([]);
  });

  it('landing: "Register your interest" everywhere, "How it works" on the bands, no account links', async () => {
    await renderAt('/', language);
    expect(accountLinks()).toEqual([]);

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: t.nav.registerInterest })).toHaveAttribute(
      'href',
      '/forms/interest',
    );

    for (const titleId of ['hero-title', 'cta-title']) {
      const band = document.getElementById(titleId)?.closest('section');
      if (!band) throw new Error(`no section for ${titleId}`);
      const links = within(band).getAllByRole('link');
      expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
        [t.nav.registerInterest, '/forms/interest'],
        [t.nav.howItWorks, '#how-it-works'],
      ]);
    }

    for (const [key, role] of ROLES) {
      expect(screen.getByRole('link', { name: t.landing.who[key].cta })).toHaveAttribute(
        'href',
        `/forms/interest?role=${role}`,
      );
    }

    expect(screen.getByText(t.landing.faq.items.university.answerInterest)).toBeInTheDocument();
    expect(screen.queryByText(t.landing.faq.items.university.answer)).toBeNull();
  });

  it('mobile menu: "Register your interest", no account links', async () => {
    const user = userEvent.setup();
    await renderAt('/', language);
    await user.click(screen.getByRole('button', { name: t.nav.menu }));
    const menu = document.getElementById(
      screen.getByRole('button', { name: t.nav.menu }).getAttribute('aria-controls') ?? '',
    );
    if (!menu) throw new Error('menu panel not found');
    expect(within(menu).getByRole('link', { name: t.nav.registerInterest })).toHaveAttribute(
      'href',
      '/forms/interest',
    );
    expect(within(menu).queryByRole('link', { name: t.nav.signIn })).toBeNull();
    expect(within(menu).queryByRole('link', { name: t.nav.createAccount })).toBeNull();
  });

  it(
    'axe: the coming-soon page has no violations',
    async () => {
      await renderAt('/sign-up', language);
      await screen.findByRole('heading', { level: 1, name: t.comingSoon.title });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('VITE_AUTH_ENABLED=true (%s)', (language) => {
  const t = copy[language];

  beforeEach(() => {
    vi.stubEnv('VITE_AUTH_ENABLED', 'true');
  });

  it.each([
    ['/forgot-password', () => t.placeholder.pages.forgotPassword],
    ['/check-email', () => t.auth.checkEmail.title],
    // Signed out, no link in the URL: the expired-link state.
    ['/auth/confirmed', () => t.auth.confirmed.failed],
  ] as const)('%s keeps its own page', async (path, title) => {
    await changeLanguage(language);
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: title() })).toBeInTheDocument();
    expect(screen.queryByText(t.comingSoon.body)).toBeNull();
  });

  it('/sign-in is the sign-in form', async () => {
    await renderAt('/sign-in', language);
    expect(
      await screen.findByRole('heading', { level: 1, name: t.auth.signIn.title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(t.comingSoon.body)).toBeNull();
  });

  it('/app signed out still goes to sign-in with next=', async () => {
    const { router } = await renderAt('/app', language);
    await waitFor(() => {
      expect(router.state.location.search).toBe('?next=%2Fapp');
    });
  });

  it('landing keeps the account links and the sign-up FAQ answer', async () => {
    await renderAt('/', language);
    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: t.nav.signIn })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(within(header).getByRole('link', { name: t.nav.createAccount })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.queryByRole('link', { name: t.nav.registerInterest })).toBeNull();
    for (const [key, role] of ROLES) {
      expect(screen.getByRole('link', { name: t.landing.who[key].cta })).toHaveAttribute(
        'href',
        `/sign-up?role=${role}`,
      );
    }
    expect(screen.getByText(t.landing.faq.items.university.answer)).toBeInTheDocument();
    expect(screen.queryByText(t.landing.faq.items.university.answerInterest)).toBeNull();
  });
});
