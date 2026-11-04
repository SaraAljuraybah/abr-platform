import {
  INTEREST_CONSENT_VERSION,
  INTEREST_OPTIONS,
  INTEREST_UNIVERSITY_GROUPS,
} from '@shared/interest-options';
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

const supabase = vi.hoisted(() => ({
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}));
vi.mock('@/lib/supabase', () => ({ supabase }));

const copy = { en, ar } as const;
type Copy = (typeof copy)[Language];
const AXE_TIMEOUT = 60_000;

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
const queryField = (label: string) =>
  screen.queryByLabelText(label, { normalizer: (text) => text.replace(/^\d{2}/, '').trim() });

const optionTexts = (select: HTMLElement) =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);

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

async function fillEnd(user: User, t: Copy, { heardOther = false } = {}) {
  const f = t.forms.interest;
  await user.selectOptions(field(f.heardFrom), heardOther ? 'other' : 'linkedin');
  if (heardOther) await enter(user, field(f.heardFromOther), 'A podcast');
  await user.click(consentBox());
}

interface StudentChoices {
  universityOther?: boolean;
  fieldOther?: boolean;
  heardOther?: boolean;
  /** Choose "Other" but leave its text empty. */
  blank?: 'universityOther' | 'fieldOfStudyOther' | 'heardFromOther';
}

async function fillStudent(user: User, t: Copy, choices: StudentChoices = {}) {
  const f = t.forms.interest;
  const other = (flag: boolean | undefined, key: StudentChoices['blank']) =>
    flag === true || choices.blank === key;
  await fillCommon(user, t, 'sara@example.com');
  const universityOther = other(choices.universityOther, 'universityOther');
  await user.selectOptions(field(f.university), universityOther ? 'other' : 'king_saud');
  if (choices.universityOther) await enter(user, field(f.universityOther), 'Unlisted University');
  const fieldOther = other(choices.fieldOther, 'fieldOfStudyOther');
  await user.selectOptions(field(f.fieldOfStudy), fieldOther ? 'other' : 'cs');
  if (choices.fieldOther) await enter(user, field(f.fieldOfStudyOther), 'Robotics');
  await user.selectOptions(field(f.graduationYear), '2027_or_later');
  await user.click(screen.getByRole('radio', { name: f.options.project_stage.idea }));
  if (choices.blank === 'heardFromOther') {
    await user.selectOptions(field(f.heardFrom), 'other');
    await user.click(consentBox());
  } else {
    await fillEnd(user, t, { heardOther: choices.heardOther });
  }
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
  supabase.functions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
});

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('interest form (%s)', (language) => {
  const t = copy[language];
  const f = t.forms.interest;
  const o = f.options;

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
      `07${f.heardFrom}`,
    ]);
    expect(field(f.email)).toHaveAttribute('dir', 'ltr');
    expect(field(f.email)).toHaveAccessibleDescription(f.emailHint);

    const panel = screen.getByRole('complementary');
    expect(within(panel).getByText(f.panel.statement).tagName).toBe('P');
    expect(within(panel).queryByRole('list')).toBeNull();
    // No phone, student ID, national ID or region field.
    expect(screen.queryByRole('textbox', { name: /phone|هاتف|جوال|ID|هوية/i })).toBeNull();
    expect(screen.queryByRole('combobox', { name: /region|المنطقة/i })).toBeNull();
    // The form's own university list: it never reads the sign-up universities table.
    expect(supabase.from).not.toHaveBeenCalled();
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
      `07${f.heardFrom}`,
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
      `05${f.heardFrom}`,
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

  it('university: public and private groups, each alphabetical, Other last', async () => {
    await renderForm();
    const select = field(f.university);
    const groups = Array.from(select.querySelectorAll('optgroup'));
    expect(groups.map((group) => group.label)).toEqual([
      f.universityGroups.public,
      f.universityGroups.private,
    ]);
    // Every code in the group, sorted by its label in this language.
    const collator = new Intl.Collator(language);
    const labels = (codes: readonly string[]) =>
      codes
        .map((code) => o.university_code[code as keyof typeof o.university_code])
        .sort((a, b) => collator.compare(a, b));
    expect(
      within(groups[0] as HTMLElement)
        .getAllByRole('option')
        .map((x) => x.textContent),
    ).toEqual(labels(INTEREST_UNIVERSITY_GROUPS.public));
    expect(
      within(groups[1] as HTMLElement)
        .getAllByRole('option')
        .map((x) => x.textContent),
    ).toEqual(labels(INTEREST_UNIVERSITY_GROUPS.private));
    expect(optionTexts(select).at(-1)).toBe(o.university_code.other);
    if (language === 'en') {
      const publicLabels = within(groups[0] as HTMLElement)
        .getAllByRole('option')
        .map((x) => x.textContent);
      expect(publicLabels[0]).toBe('Al-Baha University');
      expect(publicLabels.at(-1)).toBe('University of Tabuk');
    }
    expect(INTEREST_UNIVERSITY_GROUPS.public).toHaveLength(29);
    expect(INTEREST_UNIVERSITY_GROUPS.private).toHaveLength(14);
  });

  it('field of study: the tech list, Other last', async () => {
    await renderForm();
    expect(optionTexts(field(f.fieldOfStudy))).toEqual([
      t.forms.common.selectPlaceholder,
      ...INTEREST_OPTIONS.field_of_study.map((code) => o.field_of_study[code]),
    ]);
  });

  it('graduation year: "2027 or later" first, then 2026 down to 2000', async () => {
    await renderForm();
    const years = Array.from({ length: 27 }, (_, i) => String(2026 - i));
    expect(optionTexts(field(f.graduationYear))).toEqual([
      t.forms.common.selectPlaceholder,
      o.graduation_year['2027_or_later'],
      ...years,
    ]);
  });

  it('project stage: five options as a vertical radio list', async () => {
    await renderForm();
    const group = screen.getByRole('radiogroup', { name: f.projectStage });
    expect(group).toHaveAttribute('aria-orientation', 'vertical');
    expect(
      within(group)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual([
      o.project_stage.not_started,
      o.project_stage.idea,
      o.project_stage.in_progress,
      o.project_stage.finished,
      o.project_stage.business,
    ]);
  });

  it.each([
    ['university', 'universityOther', 150, 2],
    ['fieldOfStudy', 'fieldOfStudyOther', 100, 3],
    ['heardFrom', 'heardFromOther', 100, 6],
  ] as const)(
    'Other on %s reveals %s right after it and renumbers',
    async (choice, text, max, at) => {
      const user = setupUser();
      await renderForm();
      expect(queryField(f[text])).toBeNull();
      await user.selectOptions(field(f[choice]), 'other');
      expect(numbered()[at + 1]).toBe(`${String(at + 2).padStart(2, '0')}${f[text]}`);
      expect(numbered()).toHaveLength(8);
      expect(field(f[text])).toHaveAttribute('maxlength', String(max));
      // Choosing something else hides it again.
      const other = { university: 'king_saud', fieldOfStudy: 'cs', heardFrom: 'x' }[choice];
      await user.selectOptions(field(f[choice]), other);
      expect(queryField(f[text])).toBeNull();
      expect(numbered()).toHaveLength(7);
    },
  );

  it.each(['universityOther', 'fieldOfStudyOther', 'heardFromOther'] as const)(
    'Other without its text: %s is required and nothing is sent',
    async (blank) => {
      const user = setupUser();
      await renderForm();
      await fillStudent(user, t, { blank });
      await submit(user, t);
      await waitFor(() => {
        expect(field(f[blank])).toHaveAccessibleDescription(
          expect.stringContaining(t.validation.required),
        );
      });
      expect(field(f[blank])).toHaveAttribute('aria-invalid', 'true');
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    },
  );

  it('Other text too short shows the length message', async () => {
    const user = setupUser();
    await renderForm('/forms/interest?role=mentor');
    await fillMentor(user, t);
    await user.selectOptions(field(f.heardFrom), 'other');
    await enter(user, field(f.heardFromOther), 'A');
    await submit(user, t);
    expect(
      await screen.findByText(t.validation.tooShort.replace('{{min}}', '2')),
    ).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('empty submit: required errors, consent error, nothing sent', async () => {
    const user = setupUser();
    await renderForm();
    await submit(user, t);
    expect((await screen.findAllByText(t.validation.required)).length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText(f.consentRequired)).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('organization: at least one need is required', async () => {
    const user = setupUser();
    await renderForm('/forms/interest?role=organization');
    await fillOrganization(user, t);
    await user.click(screen.getByRole('checkbox', { name: o.looking_for.hire_talent }));
    await submit(user, t);
    expect(await screen.findByText(t.forms.common.chooseAtLeastOne)).toBeInTheDocument();
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('consent: the current text with the privacy link', async () => {
    await renderForm();
    // Everything before the privacy link, as the label shows it.
    const text = f.consent.split('<privacyLink>')[0] ?? '';
    expect(consentBox().labels?.[0]?.textContent).toContain(text);
    expect(within(consentBox().labels?.[0] as HTMLElement).getByRole('link')).toBeInTheDocument();
    expect(text).toMatch(
      language === 'en' ? /unsubscribe at any time/ : /إلغاء الاشتراك في أي وقت/,
    );
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
      expect(payload).toMatchObject({
        role,
        locale: language,
        consent_contact: true,
        website: '',
        heard_from: 'linkedin',
        heard_from_other: null,
        consent_version: INTEREST_CONSENT_VERSION,
      });
      expect(payload).not.toHaveProperty('region');
      // The shared validator (same as the function) accepts exactly what the form sends.
      expect(validateInterest(payload)).not.toBeNull();
    },
  );

  it('student: codes, and each "Other" text only with Other', async () => {
    const user = setupUser();
    await renderForm();
    await fillStudent(user, t);
    await submit(user, t);
    await screen.findByRole('heading', { level: 1, name: f.success.title });
    expect(sentPayload()).toMatchObject({
      university_code: 'king_saud',
      university_other: null,
      field_of_study: 'cs',
      field_of_study_other: null,
      graduation_year: '2027_or_later',
      project_stage: 'idea',
    });
  });

  it('student with Other everywhere sends the three texts', async () => {
    const user = setupUser();
    await renderForm();
    await fillStudent(user, t, { universityOther: true, fieldOther: true, heardOther: true });
    await submit(user, t);
    await screen.findByRole('heading', { level: 1, name: f.success.title });
    expect(sentPayload()).toMatchObject({
      university_code: 'other',
      university_other: 'Unlisted University',
      field_of_study: 'other',
      field_of_study_other: 'Robotics',
      heard_from: 'other',
      heard_from_other: 'A podcast',
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
    'axe: every role, the "Other" fields, validation errors and the success screen',
    async () => {
      const user = setupUser();
      await renderForm();
      expect(await axeViolations()).toEqual([]);
      await user.selectOptions(field(f.university), 'other');
      await user.selectOptions(field(f.fieldOfStudy), 'other');
      await user.selectOptions(field(f.heardFrom), 'other');
      await user.click(screen.getByRole('radio', { name: o.project_stage.finished }));
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
      await user.selectOptions(field(f.heardFrom), 'x');
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
