import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render-route';
import { TERMS_LAST_UPDATED } from './terms';

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

async function renderAt(path: string, language: Language) {
  await changeLanguage(language);
  const view = renderRoute(path);
  await screen.findByRole('heading', { level: 1 });
  return view;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('/terms (%s)', (language) => {
  const t = copy[language];
  const p = t.terms;

  it('one h1, the sections in order, the date, the document title and the contact email', async () => {
    await renderAt('/terms', language);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(p.title);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      p.who.title,
      p.eligibility.title,
      p.account.title,
      p.use.title,
      p.projects.title,
      p.connections.title,
      p.suspension.title,
      p.liability.title,
      p.changes.title,
      p.law.title,
      p.contact.title,
    ]);
    // Set in an effect, which can run after the first heading appears.
    await waitFor(() => {
      expect(document.title).toBe(p.metaTitle);
    });
    expect(TERMS_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText(p.updated.split('{{')[0] ?? '', { exact: false })).toHaveTextContent(
      TERMS_LAST_UPDATED.slice(0, 4),
    );
    expect(screen.getByRole('link', { name: 'try0abr@gmail.com' })).toHaveAttribute(
      'href',
      'mailto:try0abr@gmail.com',
    );
  });

  it('states the agreed points: 18+, ownership, display licence, no right to use, Saudi law', async () => {
    await renderAt('/terms', language);
    for (const text of [
      p.eligibility.items.age,
      p.projects.items.ownership,
      p.projects.items.licence,
      p.projects.items.noRights,
      p.use.items.contactDetails,
      p.law.body,
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('development builds show the open legal points', async () => {
    await renderAt('/terms', language);
    expect(
      Array.from(document.querySelectorAll('[data-todo]')).map((el) =>
        el.getAttribute('data-todo'),
      ),
    ).toEqual([
      'legalReview',
      'legalName',
      'age',
      'universityIp',
      'licence',
      'liability',
      'changesNotice',
      'law',
    ]);
  });

  it('production builds show no TODO', async () => {
    vi.stubEnv('DEV', false);
    await renderAt('/terms', language);
    expect(document.querySelectorAll('[data-todo]')).toHaveLength(0);
    expect(screen.queryByText(p.todoLabel)).toBeNull();
  });

  it('the site footer links to /terms and /privacy', async () => {
    await renderAt('/', language);
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByRole('link', { name: t.nav.terms })).toHaveAttribute('href', '/terms');
    expect(footer.getByRole('link', { name: t.nav.privacy })).toHaveAttribute('href', '/privacy');
  });

  it(
    'axe: no violations',
    async () => {
      await renderAt('/terms', language);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
