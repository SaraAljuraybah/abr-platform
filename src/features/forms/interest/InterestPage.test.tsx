import { validateInterest } from '@shared/interest-validate';
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { routes } from '@/routes/routes';
import { axeViolations } from '@/test/axe';
import { signedOut } from '@/test/render-route';

const KSU = '0a7f7f0e-5d2c-4c8e-9b1a-000000000001';
const UNIVERSITIES = [
  { id: KSU, name_ar: 'جامعة الملك سعود', name_en: 'King Saud University' },
  { id: '0a7f7f0e-5d2c-4c8e-9b1a-000000000002', name_ar: 'جامعة الفيصل', name_en: 'Alfaisal' },
];

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}));
vi.mock('@/lib/supabase', () => ({ supabase }));

const copy = { en, ar } as const;
type Copy = (typeof copy)[Language];
const AXE_TIMEOUT = 60_000;

function mockUniversities() {
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => Promise.resolve({ data: UNIVERSITIES, error: null }) }),
  }));
}

async function renderForm(path = '/forms/interest') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={signedOut}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

const setupUser = () => userEvent.setup({ delay: null });
type User = ReturnType<typeof setupUser>;

/** The numbered field labels, badge included ("01Full name"), in order. */
const numbered = () =>
  Array.from(document.querySelectorAll('main [data-numbered-label]')).map((el) => el.textContent);

// Label text includes the decorative number badge; the accessible name does not.
const field = (label: string) =>
  screen.getByLabelText(label, { normalizer: (text) => text.replace(/^\d{2}/, '').trim() });

async function enter(user: User, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

const consentBox = () => {
  const box = document.querySelector<HTMLInputElement>('input[name="consent"]');
  if (!box) throw new Error('consent checkbox not found');
  return box;
};

async function fillCommon(user: User, t: Copy, email: string) {
  const f = t.forms.interest;
  await enter(user, field(f.fullName), 'Sara Test');
  await enter(user, field(f.email), email);
}

async function fillEnd(user: User, t: Copy) {
  const f = t.forms.interest;
  await user.selectOptions(field(f.region), 'riyadh');
  await user.selectOptions(field(f.channel), 'linkedin');
  await user.click(consentBox());
}

async function fillStudent(user: User, t: Copy, { unlisted = false } = {}) {
  const f = t.forms.interest;
  await fillCommon(user, t, 'sara@example.com');
  await waitFor(() => {
    expect(within(field(f.university)).getAllByRole('option').length).toBeGreaterThan(2);
  });
  await user.selectOptions(field(f.university), unlisted ? 'not_listed' : KSU);
  if (unlisted) await enter(user, field(f.universityOther), 'Unlisted University');
  await user.selectOptions(field(f.fieldOfStudy), 'cs_it');
  await user.click(screen.getByRole('radio', { name: f.options.graduation_year['2027'] }));
  await user.click(screen.getByRole('radio', { name: f.options.project_stage.have_idea }));
  await fillEnd(user, t);
}

async function fillOrganization(user: User, t: Copy) {
  const f = t.forms.interest;
  await fillCommon(user, t, 'omar@org.example');
  await enter(user, field(f.organizationName), 'Org Labs');
  await user.selectOptions(field(f.sector), 'technology');
  await user.click(screen.getByRole('checkbox', { name: f.options.looking_for.hire_talent }));
  await user.click(screen.getByRole('radio', { name: f.options.org_size['51_500'] }));
  await fillEnd(user, t);
}

async function fillMentor(user: User, t: Copy) {
  const f = t.forms.interest;
  await fillCommon(user, t, 'mona@mentor.example');
  await user.selectOptions(field(f.expertise), 'health');
  await user.click(screen.getByRole('radio', { name: f.options.experience['4_7'] }));
  await fillEnd(user, t);
}

const submit = (user: User, t: Copy) =>
  user.click(screen.getByRole('button', { name: t.forms.interest.submit }));

const sentPayload = () =>
  (supabase.functions.invoke.mock.calls[0]?.[1] as { body: Record<string, unknown> }).body;

beforeAll(async () => {
  await import('./InterestPage');
});

beforeEach(() => {
  mockUniversities();
  supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('interest form (%s)', (language) => {
  const t = copy[language];
  const f = t.forms.interest;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('student (default): title, intro, numbered fields in order and the interest panel', async () => {
    await renderForm();
    expect(screen.getByRole('heading', { level: 1, name: f.title })).toBeInTheDocument();
    expect(screen.getByText(f.intro)).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', { name: f.roleLabel })).toBeInTheDocument();
    expect(numbered()).toEqual([
      `01${f.fullName}`,
      `02${f.email}`,
      `03${f.university}`,
      `04${f.fieldOfStudy}`,
      `05${f.graduationYear}`,
      `06${f.projectStage}`,
      `07${f.region}`,
      `08${f.channel}`,
    ]);
    expect(field(f.email)).toHaveAttribute('dir', 'ltr');
    expect(field(f.email)).toHaveAccessibleDescription(f.emailHint);

    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText(f.panel.statement).tagName).toBe('P');
    expect(
      within(panel)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([f.panel.minute, f.panel.noAccount, f.panel.emailOnly]);
    // No phone, student ID or national ID field.
    expect(screen.queryByRole('textbox', { name: /phone|هاتف|جوال|ID|هوية/i })).toBeNull();
  });

  it('organization (?role=organization): its fields, numbered', async () => {
    await renderForm('/forms/interest?role=organization');
    expect(
      screen.getByRole('radio', { name: new RegExp(t.auth.signUp.roles.organization.title) }),
    ).toBeChecked();
    expect(numbered()).toEqual([
      `01${f.fullName}`,
      `02${f.email}`,
      `03${f.organizationName}`,
      `04${f.sector}`,
      `05${f.lookingFor}`,
      `06${f.orgSize}`,
      `07${f.region}`,
      `08${f.channel}`,
    ]);
    expect(screen.getAllByRole('checkbox')).toHaveLength(5); // four needs + consent
  });

  it('mentor (?role=mentor): its fields, numbered', async () => {
    await renderForm('/forms/interest?role=mentor');
    expect(numbered()).toEqual([
      `01${f.fullName}`,
      `02${f.email}`,
      `03${f.expertise}`,
      `04${f.experience}`,
      `05${f.region}`,
      `06${f.channel}`,
    ]);
  });

  it.each(['/forms/interest?role=admin', '/forms/interest?role='])(
    '%s pre-selects Student',
    async (path) => {
      await renderForm(path);
      expect(
        screen.getByRole('radio', { name: new RegExp(t.auth.signUp.roles.student.title) }),
      ).toBeChecked();
    },
  );

  it('"My university isn\'t listed" reveals University name and renumbers', async () => {
    const user = setupUser();
    await renderForm();
    await waitFor(() => {
      expect(
        within(field(f.university)).getByRole('option', { name: f.universityNotListed }),
      ).toBeInTheDocument();
    });
    // It is the last option.
    expect(within(field(f.university)).getAllByRole('option').at(-1)).toHaveTextContent(
      f.universityNotListed,
    );
    await user.selectOptions(field(f.university), 'not_listed');
    expect(numbered().slice(2, 6)).toEqual([
      `03${f.university}`,
      `04${f.universityOther}`,
      `05${f.fieldOfStudy}`,
      `06${f.graduationYear}`,
    ]);
    expect(field(f.universityOther)).toHaveAttribute('maxlength', '150');
  });

  it('empty submit: required errors, consent error, nothing sent', async () => {
    const user = setupUser();
    await renderForm();
    await submit(user, t);
    expect((await screen.findAllByText(t.validation.required)).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(f.consentRequired)).toBeInTheDocument();
    // Region is the only optional field.
    expect(field(f.region)).not.toHaveAttribute('aria-invalid');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('organization: at least one need is required', async () => {
    const user = setupUser();
    await renderForm('/forms/interest?role=organization');
    await fillOrganization(user, t);
    await user.click(screen.getByRole('checkbox', { name: f.options.looking_for.hire_talent }));
    await submit(user, t);
    expect(await screen.findByText(t.forms.common.chooseAtLeastOne)).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('consent is required even when everything else is filled', async () => {
    const user = setupUser();
    await renderForm('/forms/interest?role=mentor');
    await fillMentor(user, t);
    await user.click(consentBox());
    await submit(user, t);
    expect(await screen.findByText(f.consentRequired)).toBeInTheDocument();
    expect(consentBox()).toHaveAccessibleDescription(f.consentRequired);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ['student', fillStudent, '/forms/interest'],
    ['organization', fillOrganization, '/forms/interest?role=organization'],
    ['mentor', fillMentor, '/forms/interest?role=mentor'],
  ] as const)(
    '%s: sends a payload the Edge Function accepts, then shows the success screen',
    async (role, fill, path) => {
      const user = setupUser();
      await renderForm(path);
      await fill(user, t);
      await submit(user, t);
      const title = await screen.findByRole('heading', { level: 1, name: f.success.title });
      await waitFor(() => {
        expect(title).toHaveFocus();
      });
      expect(screen.getByText(f.success.body)).toBeInTheDocument();
      expect(
        within(screen.getByRole('main')).getByRole('link', { name: f.success.home }),
      ).toHaveAttribute('href', '/');

      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
      expect(supabase.functions.invoke.mock.calls[0]?.[0]).toBe('submit-interest');
      const payload = sentPayload();
      expect(payload).toMatchObject({ role, locale: language, consent_contact: true, website: '' });
      // The shared validator (same as the function) accepts exactly what the form sends.
      expect(validateInterest(payload)).not.toBeNull();
    },
  );

  it('student with an unlisted university sends the free-text name only', async () => {
    const user = setupUser();
    await renderForm();
    await fillStudent(user, t, { unlisted: true });
    await submit(user, t);
    await screen.findByRole('heading', { level: 1, name: f.success.title });
    expect(sentPayload()).toMatchObject({
      university_id: null,
      university_other: 'Unlisted University',
    });
    expect(validateInterest(sentPayload())).not.toBeNull();
  });

  it('a filled spam trap shows the success screen and sends nothing', async () => {
    const user = setupUser();
    await renderForm('/forms/interest?role=mentor');
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
    if (trap) await enter(user, trap, 'https://spam.example');
    await fillMentor(user, t);
    await submit(user, t);
    expect(await screen.findByRole('heading', { level: 1, name: f.success.title })).toBeVisible();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ['rateLimited', () => new FunctionsHttpError(new Response('{}', { status: 429 }))],
    ['network', () => new FunctionsFetchError(new TypeError('Failed to fetch'))],
    ['unexpected', () => new FunctionsHttpError(new Response('{}', { status: 500 }))],
  ] as const)('shows the %s message, focused, and keeps the form', async (kind, makeError) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    supabase.functions.invoke.mockResolvedValue({ data: null, error: makeError() });
    const user = setupUser();
    await renderForm('/forms/interest?role=mentor');
    await fillMentor(user, t);
    await submit(user, t);
    const message = await screen.findByText(t.forms.errors[kind]);
    await waitFor(() => {
      expect(message.closest('[tabindex="-1"]')).toHaveFocus();
    });
    expect(screen.getByRole('heading', { level: 1, name: f.title })).toBeInTheDocument();
  });

  it(
    'axe: every role, validation errors and the success screen have no violations',
    async () => {
      const user = setupUser();
      await renderForm();
      expect(await axeViolations()).toEqual([]);
      await submit(user, t);
      await screen.findByText(f.consentRequired);
      expect(await axeViolations()).toEqual([]);

      await user.click(
        screen.getByRole('radio', { name: new RegExp(t.auth.signUp.roles.organization.title) }),
      );
      await submit(user, t);
      await screen.findByText(t.forms.common.chooseAtLeastOne);
      expect(await axeViolations()).toEqual([]);

      await user.click(
        screen.getByRole('radio', { name: new RegExp(t.auth.signUp.roles.mentor.title) }),
      );
      expect(await axeViolations()).toEqual([]);
      await fillMentor(user, t);
      await submit(user, t);
      await screen.findByRole('heading', { level: 1, name: f.success.title });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('forms routes', () => {
  it('an unknown form slug is a 404', async () => {
    await renderForm('/forms/nope');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(en.notFound.title);
  });

  it('/forms/request-access is the SCRUM-14 placeholder and /request-access redirects to it', async () => {
    const router = await renderForm('/request-access');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/forms/request-access');
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      en.placeholder.pages.requestAccess,
    );
  });
});
