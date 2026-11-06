import { readFileSync } from 'node:fs';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render-route';
import { PRIVACY_LAST_UPDATED } from './notice';

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

async function renderAt(path: string, language: Language) {
  await changeLanguage(language);
  const view = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('/privacy (%s)', (language) => {
  const t = copy[language];
  const p = t.privacy;

  it('one h1, the sections in order, the date and the contact email', async () => {
    await renderAt('/privacy', language);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(p.title);
    // Named "Privacy Policy" like the sign-up checkbox (SCRUM-38), in the tab title too.
    expect(p.title).toBe(t.nav.privacy);
    await waitFor(() => {
      expect(document.title).toBe(p.metaTitle);
    });
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      p.responsible.title,
      p.collect.title,
      p.why.title,
      p.visibility.title,
      p.processors.title,
      p.browser.title,
      p.retention.title,
      p.rights.title,
      p.changes.title,
    ]);
    // One constant drives the date; Gregorian with Latin digits in both languages.
    expect(PRIVACY_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const [year, , day] = PRIVACY_LAST_UPDATED.split('-');
    const updated = screen.getByText(p.updated.split('{{')[0] ?? '', { exact: false });
    expect(updated.textContent).toContain(String(Number(day)));
    expect(updated.textContent).toContain(year);
    expect(updated.textContent).toMatch(language === 'en' ? /November/ : /نوفمبر/);

    const emails = screen.getAllByRole('link', { name: 'try0abr@gmail.com' });
    expect(emails).toHaveLength(2);
    for (const link of emails) expect(link).toHaveAttribute('href', 'mailto:try0abr@gmail.com');
  });

  it('states the CTO decisions: Frankfurt, processing outside Saudi Arabia, interest retention, 18+', async () => {
    await renderAt('/privacy', language);
    expect(screen.getByText(p.processors.items.supabase)).toBeInTheDocument();
    expect(screen.getByText(p.processors.transfer)).toBeInTheDocument();
    expect(screen.getByText(p.retention.items.interest)).toBeInTheDocument();
    expect(screen.getByText(p.responsible.age)).toBeInTheDocument();
    expect(screen.getByText(p.collect.account.items.password)).toBeInTheDocument();
  });

  it("states what SCRUM-38 added: consent records and the students' mobile number", async () => {
    await renderAt('/privacy', language);
    expect(screen.getByText(p.collect.account.items.consent)).toBeInTheDocument();
    expect(screen.getByText(p.collect.contact.body)).toBeInTheDocument();
  });

  it('development builds show the five open points', async () => {
    await renderAt('/privacy', language);
    expect(
      Array.from(document.querySelectorAll('[data-todo]')).map((el) =>
        el.getAttribute('data-todo'),
      ),
    ).toEqual(['legalReview', 'legalName', 'minors', 'securityRetention', 'replyTime']);
  });

  it('production builds show no TODO', async () => {
    vi.stubEnv('DEV', false);
    await renderAt('/privacy', language);
    expect(document.querySelectorAll('[data-todo]')).toHaveLength(0);
    expect(screen.queryByText(p.todoLabel)).toBeNull();
    for (const text of Object.values(p.todo)) expect(screen.queryByText(text)).toBeNull();
  });

  it('the site footer links to /privacy', async () => {
    await renderAt('/', language);
    expect(
      within(screen.getByRole('contentinfo')).getByRole('link', { name: t.nav.privacy }),
    ).toHaveAttribute('href', '/privacy');
  });

  it('the interest form links to /privacy in its consent line and under the form', async () => {
    await renderAt('/forms/interest', language);
    const consent = document.querySelector<HTMLInputElement>('input[name="consent"]');
    const inLabel = consent?.labels?.[0]?.querySelector('a');
    expect(inLabel).toHaveAttribute('href', '/privacy');
    expect(inLabel).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: t.nav.privacy })).toHaveAttribute('href', '/privacy');
  });

  it(
    'axe: no violations',
    async () => {
      await renderAt('/privacy', language);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('/register', () => {
  it('redirects to the interest form in the client router', async () => {
    const { router } = renderRoute('/register');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/forms/interest');
    });
  });

  it('is redirected by vercel.json before the SPA rewrite', () => {
    const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
      redirects?: { source: string; destination: string }[];
    };
    expect(config.redirects).toContainEqual(
      expect.objectContaining({ source: '/register', destination: '/forms/interest' }),
    );
  });
});
