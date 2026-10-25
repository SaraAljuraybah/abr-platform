import type { Session } from '@supabase/supabase-js';
import { render, screen, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import { routes } from '@/routes/routes';

const session = { user: { id: '00000000-0000-0000-0000-000000000001' } } as unknown as Session;
const signedOut: AuthState = { status: 'ready', session: null, role: null, onboarded: false };
const signedIn: AuthState = { status: 'ready', session, role: null, onboarded: false };

async function renderLanding(language: Language, auth: AuthState = signedOut) {
  await changeLanguage(language);
  const router = createMemoryRouter(routes, { initialEntries: ['/'] });
  render(
    <AuthContext value={auth}>
      <RouterProvider router={router} />
    </AuthContext>,
  );
  await screen.findByRole('heading', { level: 1 });
}

const COPY = {
  en: {
    h1: 'Graduation projects deserve a life after graduation.',
    regions: [
      'Graduation projects deserve a life after graduation.',
      'How it works',
      'Built for everyone around a graduation project',
      'Trust is built in, not added later',
      'Frequently asked questions',
      'Give your project the audience it deserves.',
    ],
    create: 'Create an account',
    signIn: 'Sign in',
    dashboard: 'Go to dashboard',
    badges: { private: 'Contact private', shared: 'Contact shared' },
    join: ['Join as a student', 'Join as an organization', 'Join as a mentor'],
    headers: [
      ['The process', 'Five steps, and your contact details stay private until you say yes.'],
      ["Who it's for", 'One platform, three roles, each with its own verified path.'],
      [
        'Trust & privacy',
        'Every safeguard is enforced by the platform itself, not left to chance.',
      ],
      ['FAQ', 'The essentials, in short.'],
    ],
  },
  ar: {
    h1: 'مشاريع التخرج تستحق حياة بعد التخرج.',
    regions: [
      'مشاريع التخرج تستحق حياة بعد التخرج.',
      'كيف تعمل المنصة',
      'لكل من يرتبط بمشروع التخرج',
      'الثقة جزء من التصميم، لا إضافة لاحقة',
      'الأسئلة الشائعة',
      'امنح مشروعك الجمهور الذي يستحقه.',
    ],
    create: 'إنشاء حساب',
    signIn: 'تسجيل الدخول',
    dashboard: 'الانتقال إلى لوحة التحكم',
    badges: { private: 'التواصل خاص', shared: 'تمت مشاركة التواصل' },
    join: ['انضم كطالب', 'انضم كجهة', 'انضم كمرشد'],
    headers: [
      ['آلية العمل', 'خمس خطوات، وتبقى بيانات تواصلك خاصة حتى توافق.'],
      ['لمن المنصة', 'منصة واحدة وثلاثة أدوار، لكل منها مسار موثّق.'],
      ['الثقة والخصوصية', 'كل ضمانة تفرضها المنصة نفسها، ولا تُترك للصدفة.'],
      ['الأسئلة الشائعة', 'أهم ما تحتاج معرفته باختصار.'],
    ],
  },
} as const;

describe.each(['en', 'ar'] as const)('landing page (%s)', (language) => {
  const copy = COPY[language];

  afterEach(async () => {
    await changeLanguage('en');
  });

  it('has exactly one h1', async () => {
    await renderLanding(language);
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(copy.h1);
  });

  it('renders every section as a region labelled by its heading, plus header and footer', async () => {
    await renderLanding(language);
    for (const name of copy.regions) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(5);
  });

  it('marks the consent moment: contact private in steps 1-2, shared at step 5', async () => {
    await renderLanding(language);
    const how = screen.getByRole('region', { name: copy.regions[1] });
    const [first, second, , , fifth] = within(how).getAllByRole('listitem');
    if (!first || !second || !fifth) throw new Error('expected five steps');
    expect(within(first).getByText(copy.badges.private)).toBeInTheDocument();
    expect(within(second).getByText(copy.badges.private)).toBeInTheDocument();
    expect(within(fifth).getByText(copy.badges.shared)).toBeInTheDocument();
    expect(within(how).getAllByText(copy.badges.private)).toHaveLength(2);
    expect(within(how).getAllByText(copy.badges.shared)).toHaveLength(1);
  });

  it('gives each section after the hero an eyebrow and a one-line intro', async () => {
    await renderLanding(language);
    copy.headers.forEach(([eyebrow, intro], index) => {
      const region = screen.getByRole('region', { name: copy.regions[index + 1] });
      expect(within(region).getByText(eyebrow, { selector: 'p' })).toBeInTheDocument();
      expect(within(region).getByText(intro)).toBeInTheDocument();
    });
  });

  it('has five steps, three audience cards, four trust items and four FAQ entries', async () => {
    await renderLanding(language);
    const steps = within(screen.getByRole('region', { name: copy.regions[1] })).getAllByRole(
      'heading',
      { level: 3 },
    );
    expect(steps).toHaveLength(5);
    const cards = within(screen.getByRole('region', { name: copy.regions[2] })).getAllByRole(
      'heading',
      { level: 3 },
    );
    expect(cards).toHaveLength(3);
    const trust = within(screen.getByRole('region', { name: copy.regions[3] })).getAllByRole(
      'heading',
      { level: 3 },
    );
    expect(trust).toHaveLength(4);
    const faq = screen.getByRole('region', { name: copy.regions[4] });
    expect(faq.querySelectorAll('details > summary')).toHaveLength(4);
  });

  it('hides the decorative project card from assistive technology', async () => {
    await renderLanding(language);
    const hero = screen.getByRole('region', { name: copy.h1 });
    const cardText = within(hero).getByText(/^(Request to connect|طلب تواصل)$/);
    const hiddenContainer = cardText.closest('[aria-hidden="true"]');
    expect(hiddenContainer).not.toBeNull();
    expect(hiddenContainer).toHaveAttribute('inert');
    // Not exposed as an interactive control: it is a styled span, not a button or link.
    expect(within(hero).queryByRole('button')).toBeNull();
  });

  it('signed out: header, hero and final CTA offer Sign in and Create an account', async () => {
    await renderLanding(language);
    const header = screen.getByRole('banner');
    const hero = screen.getByRole('region', { name: copy.h1 });
    const band = screen.getByRole('region', { name: copy.regions[5] });

    for (const area of [header, hero, band]) {
      expect(within(area).getByRole('link', { name: copy.create })).toHaveAttribute(
        'href',
        '/sign-up',
      );
      expect(within(area).getByRole('link', { name: copy.signIn })).toHaveAttribute(
        'href',
        '/sign-in',
      );
      expect(within(area).queryByRole('link', { name: copy.dashboard })).toBeNull();
    }
  });

  it('signed in: header, hero and final CTA offer only Go to dashboard', async () => {
    await renderLanding(language, signedIn);
    const header = screen.getByRole('banner');
    const hero = screen.getByRole('region', { name: copy.h1 });
    const band = screen.getByRole('region', { name: copy.regions[5] });

    for (const area of [header, hero, band]) {
      expect(within(area).getByRole('link', { name: copy.dashboard })).toHaveAttribute(
        'href',
        '/app',
      );
      expect(within(area).queryByRole('link', { name: copy.signIn })).toBeNull();
      expect(within(area).queryByRole('link', { name: copy.create })).toBeNull();
    }
  });

  it('lays the FAQ out as a header column followed by the accordion column', async () => {
    await renderLanding(language);
    const faq = screen.getByRole('region', { name: copy.regions[4] });
    const intro = faq.querySelector('[data-faq-intro]');
    const list = faq.querySelector('[data-faq-list]');
    if (!(intro instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      throw new Error('FAQ columns not found');
    }
    expect(within(intro).getByRole('heading', { level: 2 })).toHaveTextContent(copy.regions[4]);
    expect(within(intro).getByText(copy.headers[3][1])).toBeInTheDocument();
    expect(list.querySelectorAll(':scope > details')).toHaveLength(4);
    expect(intro.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(intro.className).toMatch(/lg:sticky/);
  });

  it('audience cards offer role-specific join links when signed out', async () => {
    await renderLanding(language);
    const cards = screen.getByRole('region', { name: copy.regions[2] });
    const roles = ['student', 'organization', 'mentor'];
    copy.join.forEach((name, index) => {
      expect(within(cards).getByRole('link', { name })).toHaveAttribute(
        'href',
        `/sign-up?role=${roles[index] ?? ''}`,
      );
    });
    expect(within(cards).getAllByRole('link')).toHaveLength(3);
    expect(within(cards).queryByRole('link', { name: copy.create })).toBeNull();
  });

  it('audience cards show no sign-up link when signed in', async () => {
    await renderLanding(language, signedIn);
    const cards = screen.getByRole('region', { name: copy.regions[2] });
    expect(within(cards).queryAllByRole('link')).toHaveLength(0);
  });

  it('links the section anchors to existing sections', async () => {
    await renderLanding(language);
    const footerNav = within(screen.getByRole('contentinfo')).getByRole('navigation');
    const anchors = within(footerNav).getAllByRole('link');
    expect(anchors).toHaveLength(4);
    for (const anchor of anchors) {
      const id = anchor.getAttribute('href')?.slice(1) ?? '';
      expect(document.getElementById(id)).toHaveAttribute('aria-labelledby');
    }
  });
});
