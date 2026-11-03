import type { Session } from '@supabase/supabase-js';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { type AuthState } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render-route';

const session = { user: { id: '00000000-0000-0000-0000-000000000001' } } as unknown as Session;
const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };
const signedIn: AuthState = { status: 'ready', session, role: null, onboarded: false };

// A full-page axe scan in jsdom takes several seconds, more when cold or under load.
const AXE_TIMEOUT = 60_000;

async function renderAt(path: string, language: Language, auth: AuthState = signedOut) {
  await changeLanguage(language);
  renderRoute(path, auth);
  await screen.findByRole('heading', { level: 1 });
}

describe.each(['en', 'ar'] as const)('accessibility (axe, %s)', (language) => {
  afterEach(async () => {
    await changeLanguage('en');
  });

  it(
    'landing page, signed out: no violations',
    async () => {
      await renderAt('/', language);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'landing page, signed in: no violations',
    async () => {
      await renderAt('/', language, signedIn);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'landing page with the mobile menu and an FAQ entry open: no violations',
    async () => {
      const user = userEvent.setup();
      await renderAt('/', language);
      await user.click(
        screen.getByRole('button', { name: language === 'en' ? 'Menu' : 'القائمة' }),
      );
      const firstSummary = document.querySelector('details > summary');
      if (firstSummary) await user.click(firstSummary);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'compact header page (404): no violations',
    async () => {
      await renderAt('/does-not-exist', language);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
