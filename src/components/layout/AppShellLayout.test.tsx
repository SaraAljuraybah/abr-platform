import type { Session } from '@supabase/supabase-js';
import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '@/features/auth/auth-context';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render-route';

vi.mock('@/lib/supabase', () => {
  const none = { data: null, error: null };
  const builder = {
    eq: () => builder,
    maybeSingle: () => Promise.resolve(none),
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
      from: () => ({ select: () => builder }),
    },
  };
});

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const auth = (role: AuthState['role']): AuthState => ({
  status: 'ready',
  session: { user: { id: '00000000-0000-0000-0000-0000000000aa' } } as unknown as Session,
  role,
  verificationStatus: 'verified',
  onboarded: true,
});

async function header(role: AuthState['role'] = 'student') {
  renderRoute('/app/profile', auth(role));
  const banner = await screen.findByRole('banner');
  const row = must(banner.firstElementChild);
  return { banner, row };
}

/** An element that must exist (the test fails clearly if it does not). */
function must(element: Element | null | undefined): HTMLElement {
  if (!(element instanceof HTMLElement)) throw new Error('missing element');
  return element;
}

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('app shell header (%s)', (language) => {
  const t = copy[language];

  it('three parts: logo at the start, page links centred, actions at the end', async () => {
    await changeLanguage(language);
    const { row } = await header();
    // A 1fr auto 1fr grid from md, so the middle column is centred whatever the sides measure.
    expect(row).toHaveClass('md:grid', 'md:grid-cols-[1fr_auto_1fr]');
    const [start, middle, end] = Array.from(row.children) as HTMLElement[];
    expect(row.children).toHaveLength(3);
    expect(start).toHaveAccessibleName(t.shell.homeLink);
    expect(start).toHaveClass('justify-self-start');
    expect(middle?.tagName).toBe('NAV');
    expect(middle).toHaveAccessibleName(t.shell.nav);
    expect(middle).toHaveClass('justify-self-center', 'hidden', 'md:flex');
    expect(
      within(must(middle))
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([t.shell.dashboard, t.shell.explore]);
    expect(end).toHaveClass('justify-self-end');
    expect(
      within(must(end)).getByRole('button', { name: t.shell.accountMenu }),
    ).toBeInTheDocument();
    // The grid follows the document direction: Arabic mirrors it with no extra classes.
    expect(document.documentElement).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
  });

  it('an admin gets Admin and Explore projects in the centre', async () => {
    await changeLanguage(language);
    const { row } = await header('admin');
    const nav = must(row.children[1]);
    expect(
      within(nav)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([t.shell.admin, t.shell.explore]);
  });

  it('below md the links stay in the mobile menu', async () => {
    await changeLanguage(language);
    const { row } = await header();
    const menu = within(must(row.children[2])).getByRole('button', {
      name: t.nav.menu,
    });
    expect(menu.closest('.md\\:hidden')).not.toBeNull();
  });

  it('the current page link keeps its active style', async () => {
    await changeLanguage(language);
    renderRoute('/projects', { ...auth('student'), verificationStatus: 'pending' });
    const banner = await screen.findByRole('banner');
    const nav = within(banner).getAllByRole('navigation', { name: t.shell.nav })[0];
    const active = within(must(nav)).getByRole('link', { name: t.shell.explore });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('bg-primary/10', 'text-primary', 'underline');
  });

  it(
    'has no axe violations',
    async () => {
      await changeLanguage(language);
      await header();
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
