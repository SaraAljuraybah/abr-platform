import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthWeakPasswordError,
  type Session,
} from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthState } from '@/features/auth/auth-context';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { routes } from '@/routes/routes';
import { axeViolations } from '@/test/axe';
import { signedOut } from '@/test/render-route';

const KSU = '0a7f7f0e-5d2c-4c8e-9b1a-000000000001';
const KFUPM = '0a7f7f0e-5d2c-4c8e-9b1a-000000000002';
const ALFAISAL = '0a7f7f0e-5d2c-4c8e-9b1a-000000000004';
const UNIVERSITIES = [
  { id: KSU, name_ar: 'جامعة الملك سعود', name_en: 'King Saud University' },
  { id: KFUPM, name_ar: 'جامعة الملك فهد للبترول والمعادن', name_en: 'King Fahd University' },
  { id: ALFAISAL, name_ar: 'جامعة الفيصل', name_en: 'Alfaisal University' },
];
const DOMAINS: Record<string, string> = { [KSU]: 'ksu.edu.sa', [KFUPM]: 'kfupm.edu.sa' };

const supabase = vi.hoisted(() => ({
  auth: { signUp: vi.fn() },
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock('@/lib/supabase', () => ({ supabase }));

const copy = { en, ar } as const;
type Copy = (typeof copy)[Language];
const AXE_TIMEOUT = 60_000;
const GOOD_PASSWORD = 'Correct-pass1';

/** check_student_email(): exact domain of the selected university, like the database. */
function mockRpc() {
  supabase.rpc.mockImplementation(
    (_fn: string, args: { p_university_id: string; p_email: string }) =>
      Promise.resolve({
        data: args.p_email.toLowerCase().endsWith(`@${DOMAINS[args.p_university_id] ?? '-'}`),
        error: null,
      }),
  );
}

function mockUniversities(
  result: { data: unknown; error: unknown } = { data: UNIVERSITIES, error: null },
) {
  supabase.from.mockImplementation(() => ({
    select: () => ({ eq: () => Promise.resolve(result) }),
  }));
}

const created = () => ({
  data: { user: { id: 'u1', identities: [{ id: 'i1' }] }, session: null },
  error: null,
});
// What Supabase returns for an email that already has an account (confirmations on).
const obfuscated = () => ({
  data: { user: { id: 'fake', identities: [] }, session: null },
  error: null,
});

async function renderSignUp(path = '/sign-up', auth: AuthState = signedOut) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext value={auth}>
        <RouterProvider router={router} />
      </AuthContext>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

// Label text includes the decorative number badge ("01"); the accessible name does not.
const field = (label: string) =>
  screen.getByLabelText(label, { normalizer: (text) => text.replace(/^\d{2}/, '').trim() });
const fieldLabels = () =>
  Array.from(document.querySelectorAll('form label'))
    .map((label) => label.textContent)
    .filter(
      (text) => text !== en.forms.common.honeypotLabel && text !== ar.forms.common.honeypotLabel,
    );

async function waitForUniversities() {
  await waitFor(() => {
    expect(screen.getAllByRole('option').length).toBeGreaterThan(1);
  });
}

async function fillStudent(
  user: ReturnType<typeof userEvent.setup>,
  t: Copy,
  { email = 'sara@ksu.edu.sa', university = KSU, password = GOOD_PASSWORD } = {},
) {
  await waitForUniversities();
  await enter(user, field(t.auth.signUp.fullName), 'Sara Test');
  await user.selectOptions(field(t.auth.signUp.university), university);
  await enter(user, field(t.auth.signUp.universityEmail), email);
  await enter(user, field(t.auth.signUp.password), password);
}

// No delay between keystrokes: each one re-renders the whole form, which is slow in jsdom.
const setupUser = () => userEvent.setup({ delay: null });

/** Focus the field, then paste: one input event instead of one per character (keeps CI fast). */
async function enter(user: ReturnType<typeof userEvent.setup>, element: HTMLElement, text: string) {
  await user.click(element);
  await user.paste(text);
}

const submit = (user: ReturnType<typeof userEvent.setup>, t: Copy) =>
  user.click(screen.getByRole('button', { name: t.auth.signUp.submit }));

beforeAll(async () => {
  // Load the lazy route once so the first test does not spend its findBy budget compiling it.
  await import('@/features/auth/SignUpPage');
});

beforeEach(() => {
  mockUniversities();
  mockRpc();
  supabase.auth.signUp.mockResolvedValue(created());
});

afterEach(async () => {
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('sign-up page (%s)', (language) => {
  const t = copy[language];
  const s = t.auth.signUp;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('student (default): title, intro, roles, numbered fields and links', async () => {
    await renderSignUp();
    expect(screen.getByRole('heading', { level: 1, name: s.title })).toBeInTheDocument();
    expect(screen.getByText(s.intro)).toBeInTheDocument();

    const group = screen.getByRole('radiogroup', { name: s.roleLabel });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(
      within(group).getByRole('radio', { name: new RegExp(s.roles.student.title) }),
    ).toBeChecked();

    expect(fieldLabels()).toEqual([
      `01${s.fullName}`,
      `02${s.university}`,
      `03${s.universityEmail}`,
      `04${s.password}`,
    ]);
    // No "01—04" progress label; the per-field badges stay.
    expect(screen.queryByText(/^\d{2}—\d{2}$/)).toBeNull();

    expect(screen.getByText(s.universityEmailHint)).toBeInTheDocument();
    const cantFind = screen.getByRole('link', { name: s.cantFindUniversity });
    expect(cantFind).toHaveAttribute('href', '/forms/request-access');
    // Helper link below the select, not between its label and the field.
    const university = screen.getByRole('combobox', { name: new RegExp(s.university) });
    expect(
      university.compareDocumentPosition(cantFind) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: s.universityEmailTrouble })).toHaveAttribute(
      'href',
      '/forms/request-access',
    );
    expect(field(s.universityEmail)).toHaveAttribute('dir', 'ltr');
    expect(field(s.password)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('link', { name: new RegExp(s.signIn) })).toHaveAttribute(
      'href',
      '/sign-in',
    );

    // The consent line links to the internal notice, in the same tab.
    const privacy = document.querySelector('label a[href="/privacy"]');
    expect(privacy).not.toBeNull();
    expect(privacy).not.toHaveAttribute('target');
  });

  it('organization (?role=organization): fields and work-email hint', async () => {
    await renderSignUp('/sign-up?role=organization');
    expect(
      screen.getByRole('radio', { name: new RegExp(s.roles.organization.title) }),
    ).toBeChecked();
    expect(fieldLabels()).toEqual([
      `01${s.organizationName}`,
      `02${s.yourFullName}`,
      `03${s.workEmail}`,
      `04${s.password}`,
    ]);
    expect(screen.getByText(s.workEmailHint)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('mentor (?role=mentor): three fields and the pilot notice', async () => {
    await renderSignUp('/sign-up?role=mentor');
    expect(screen.getByRole('radio', { name: new RegExp(s.roles.mentor.title) })).toBeChecked();
    expect(fieldLabels()).toEqual([`01${s.fullName}`, `02${s.email}`, `03${s.password}`]);
    expect(screen.getByText(s.mentorNotice).closest('[role="status"]')).not.toBeNull();
  });

  it.each(['/sign-up?role=admin', '/sign-up?role=Student', '/sign-up?role='])(
    '%s pre-selects Student',
    async (path) => {
      await renderSignUp(path);
      expect(screen.getByRole('radio', { name: new RegExp(s.roles.student.title) })).toBeChecked();
    },
  );

  it('switching role with the keyboard changes the fields and keeps what was typed', async () => {
    const user = setupUser();
    await renderSignUp();
    await enter(user, field(s.fullName), 'Sara Test');
    screen.getByRole('radio', { name: new RegExp(s.roles.student.title) }).focus();
    // The arrow follows the reading direction. Radix selects on the focus it schedules after
    // keydown, so hold the key across that tick (a real keyup comes later than user-event's).
    const next = language === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    await user.keyboard(`{${next}>}`);
    await waitFor(() => {
      expect(
        screen.getByRole('radio', { name: new RegExp(s.roles.organization.title) }),
      ).toBeChecked();
    });
    await user.keyboard(`{/${next}}`);
    expect(field(s.yourFullName)).toHaveValue('Sara Test');
    expect(fieldLabels()).toHaveLength(4);
  });

  it('lists active universities sorted in the current language', async () => {
    await renderSignUp();
    await waitForUniversities();
    const names = screen
      .getAllByRole('option')
      .slice(1)
      .map((option) => option.textContent);
    expect(names).toEqual(
      language === 'ar'
        ? ['جامعة الفيصل', 'جامعة الملك سعود', 'جامعة الملك فهد للبترول والمعادن']
        : ['Alfaisal University', 'King Fahd University', 'King Saud University'],
    );
    expect(supabase.from).toHaveBeenCalledWith('universities');
  });

  it('shows a retry when the universities fail to load', async () => {
    mockUniversities({ data: null, error: { message: 'boom' } });
    const user = setupUser();
    await renderSignUp();
    expect(await screen.findByRole('alert')).toHaveTextContent(s.universitiesError);
    mockUniversities();
    await user.click(screen.getByRole('button', { name: s.retry }));
    await waitForUniversities();
  });

  it('the password checklist follows the input, with spoken states', async () => {
    const user = setupUser();
    await renderSignUp();
    const items = () =>
      within(screen.getByRole('main'))
        .getAllByRole('listitem')
        .map((item) => [item.getAttribute('data-met'), item.textContent]);
    expect(items()).toEqual([
      ['false', `${s.ruleNotMet} ${s.passwordRules.length}`],
      ['false', `${s.ruleNotMet} ${s.passwordRules.case}`],
      ['false', `${s.ruleNotMet} ${s.passwordRules.digit}`],
    ]);
    await enter(user, field(s.password), 'abcdefghij1');
    expect(items()).toEqual([
      ['true', `${s.ruleMet} ${s.passwordRules.length}`],
      ['false', `${s.ruleNotMet} ${s.passwordRules.case}`],
      ['true', `${s.ruleMet} ${s.passwordRules.digit}`],
    ]);
    await enter(user, field(s.password), 'A');
    expect(items().every(([met]) => met === 'true')).toBe(true);
    // The checklist is read with the field.
    const describedBy = field(s.password).getAttribute('aria-describedby') ?? '';
    expect(
      describedBy.split(' ').some((id) => document.getElementById(id)?.querySelector('ul')),
    ).toBe(true);
  });

  it('a password that misses a rule is refused without calling Supabase', async () => {
    const user = setupUser();
    await renderSignUp();
    await fillStudent(user, t, { password: 'alllowercase1' });
    await submit(user, t);
    expect(await screen.findByText(s.passwordNotMet)).toBeInTheDocument();
    expect(field(s.password)).toHaveFocus();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('empty submit: required errors, focus on the first field, no request', async () => {
    const user = setupUser();
    await renderSignUp();
    await waitForUniversities();
    await submit(user, t);
    expect(await screen.findAllByText(t.validation.required)).toHaveLength(4);
    expect(field(s.fullName)).toHaveFocus();
    expect(field(s.fullName)).toHaveAttribute('aria-invalid', 'true');
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('student pre-check on blur: a mismatched email names the university', async () => {
    const user = setupUser();
    await renderSignUp();
    await waitForUniversities();
    await user.selectOptions(field(s.university), KSU);
    await enter(user, field(s.universityEmail), 'sara@kfupm.edu.sa');
    await user.tab();
    const name = language === 'ar' ? 'جامعة الملك سعود' : 'King Saud University';
    expect(
      await screen.findByText(s.emailMismatch.replace('{{university}}', name)),
    ).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('check_student_email', {
      p_university_id: KSU,
      p_email: 'sara@kfupm.edu.sa',
    });
  });

  it('student pre-check on submit blocks a mismatched email: no sign-up request', async () => {
    const user = setupUser();
    await renderSignUp();
    await fillStudent(user, t, { email: 'sara@gmail.com' });
    await submit(user, t);
    const name = language === 'ar' ? 'جامعة الملك سعود' : 'King Saud University';
    expect(
      await screen.findByText(s.emailMismatch.replace('{{university}}', name)),
    ).toBeInTheDocument();
    expect(field(s.universityEmail)).toHaveFocus();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('student with a matching email signs up with exactly role, full_name and university_id', async () => {
    const user = setupUser();
    const router = await renderSignUp();
    await fillStudent(user, t, { email: '  Sara@KSU.edu.sa ' });
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'Sara@KSU.edu.sa',
      password: GOOD_PASSWORD,
      options: {
        data: { role: 'student', full_name: 'Sara Test', university_id: KSU },
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
      },
    });
    expect(router.state.location.state).toEqual({ email: 'Sara@KSU.edu.sa' });
    expect(router.state.location.search).toBe('');
  });

  it('organization signs up with exactly role, full_name and organization_name', async () => {
    const user = setupUser();
    const router = await renderSignUp('/sign-up?role=organization');
    await enter(user, field(s.organizationName), '  Acme Labs ');
    await enter(user, field(s.yourFullName), 'Org Owner');
    await enter(user, field(s.workEmail), 'hello@acme.example');
    await enter(user, field(s.password), GOOD_PASSWORD);
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth.signUp.mock.calls[0]?.[0]).toMatchObject({
      options: {
        data: { role: 'organization', full_name: 'Org Owner', organization_name: 'Acme Labs' },
      },
    });
    const data = (supabase.auth.signUp.mock.calls[0]?.[0] as { options: { data: object } }).options
      .data;
    expect(Object.keys(data).sort()).toEqual(['full_name', 'organization_name', 'role']);
  });

  it('organization name follows the database limits (2–150) with a counter', async () => {
    const user = setupUser();
    await renderSignUp('/sign-up?role=organization');
    const name = field(s.organizationName);
    expect(name).toHaveAttribute('maxlength', '150');
    await enter(user, name, 'A');
    expect(screen.getByText('1/150')).toBeInTheDocument();
    await submit(user, t);
    expect(
      await screen.findByText(t.validation.tooShort.replace('{{min}}', '2')),
    ).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('mentor signs up with exactly role and full_name', async () => {
    const user = setupUser();
    const router = await renderSignUp('/sign-up?role=mentor');
    await enter(user, field(s.fullName), 'Mona Mentor');
    await enter(user, field(s.email), 'mona@example.test');
    await enter(user, field(s.password), GOOD_PASSWORD);
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    const data = (supabase.auth.signUp.mock.calls[0]?.[0] as { options: { data: object } }).options
      .data;
    expect(data).toEqual({ role: 'mentor', full_name: 'Mona Mentor' });
  });

  it('?role=admin still sends role=student', async () => {
    const user = setupUser();
    await renderSignUp('/sign-up?role=admin');
    await fillStudent(user, t);
    await submit(user, t);
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
    });
    const data = (
      supabase.auth.signUp.mock.calls[0]?.[0] as { options: { data: { role: string } } }
    ).options.data;
    expect(data.role).toBe('student');
  });

  it('labels the hidden spam trap with an instruction to leave it empty', async () => {
    await renderSignUp();
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap?.labels?.[0]?.textContent).toBe(t.forms.common.honeypotLabel);
    expect(trap?.closest('.sr-only')).not.toBeNull();
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap).toHaveAttribute('autocomplete', 'off');
  });

  it('a filled spam trap shows the normal success and calls nothing', async () => {
    const user = setupUser();
    const router = await renderSignUp();
    const trap = document.querySelector<HTMLInputElement>('input[name="website"]');
    expect(trap).not.toBeNull();
    expect(trap).toHaveAttribute('tabindex', '-1');
    expect(trap).toHaveAttribute('autocomplete', 'off');
    expect(trap?.closest('[aria-hidden="true"]')).not.toBeNull();
    if (trap) await enter(user, trap, 'https://spam.example');
    await fillStudent(user, t);
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('an email that already has an account (obfuscated success) lands on /check-email', async () => {
    supabase.auth.signUp.mockResolvedValue(obfuscated());
    const user = setupUser();
    const router = await renderSignUp();
    await fillStudent(user, t);
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
    expect(router.state.location.state).toEqual({ email: 'sara@ksu.edu.sa' });
  });

  it('user_already_exists is treated as success too (no enumeration)', async () => {
    supabase.auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('User already registered', 422, 'user_already_exists'),
    });
    const user = setupUser();
    const router = await renderSignUp();
    await fillStudent(user, t);
    await submit(user, t);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/check-email');
    });
  });

  it.each([
    [
      'the trigger 500',
      () => new AuthRetryableFetchError('Unexpected failure, please check server logs', 500),
      'signUpFailed',
    ],
    [
      'rate limit',
      () => new AuthApiError('Too many requests', 429, 'over_email_send_rate_limit'),
      'rateLimited',
    ],
    ['network', () => new AuthRetryableFetchError('Failed to fetch', 0), 'network'],
    [
      'weak_password',
      () => new AuthWeakPasswordError('Password is known to be weak', 422, ['pwned']),
      'weakPassword',
    ],
  ] as const)(
    '%s: a focused message, no live region, no navigation',
    async (_name, error, kind) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: error(),
      });
      const user = setupUser();
      const router = await renderSignUp();
      await fillStudent(user, t);
      await submit(user, t);
      const message = await screen.findByText(t.auth.errors[kind]);
      const callout = message.closest('[tabindex="-1"]');
      await waitFor(() => {
        expect(callout).toHaveFocus();
      });
      expect(callout).not.toHaveAttribute('role');
      expect(router.state.location.pathname).toBe('/sign-up');
      if (kind === 'weakPassword') {
        expect(within(screen.getByRole('main')).getAllByRole('listitem')).toHaveLength(3);
      }
    },
  );

  it('a failed pre-check request shows an error and does not sign up', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = setupUser();
    await renderSignUp();
    await waitForUniversities();
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: '500' } });
    await fillStudent(user, t);
    await submit(user, t);
    expect(await screen.findByText(t.auth.errors.unexpected)).toBeInTheDocument();
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('shows the loading state while creating the account', async () => {
    supabase.auth.signUp.mockReturnValue(new Promise(() => undefined));
    const user = setupUser();
    await renderSignUp();
    await fillStudent(user, t);
    await submit(user, t);
    const button = await screen.findByRole('button', { name: s.submitting });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it(
    'axe: every role, validation errors and an error message have no violations',
    async () => {
      const user = setupUser();
      for (const role of ['student', 'organization', 'mentor'] as const) {
        await renderSignUp(`/sign-up?role=${role}`);
        if (role === 'student') await waitForUniversities();
        expect(await axeViolations()).toEqual([]);
        await submit(user, t);
        await screen.findAllByText(t.validation.required);
        expect(await axeViolations()).toEqual([]);
        cleanup();
      }
      supabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: new AuthRetryableFetchError('Unexpected failure, please check server logs', 500),
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await renderSignUp();
      await fillStudent(user, t, { email: 'sara@gmail.com' });
      await submit(user, t);
      await screen.findByText(s.emailMismatch.split('{{')[0] ?? '', { exact: false });
      expect(await axeViolations()).toEqual([]);
      await user.clear(field(s.universityEmail));
      await enter(user, field(s.universityEmail), 'sara@ksu.edu.sa');
      await submit(user, t);
      await screen.findByText(t.auth.errors.signUpFailed);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('sign-up redirects', () => {
  it('sends a signed-in visitor to /app', async () => {
    const session = { user: { id: 'u1' } } as unknown as Session;
    const router = createMemoryRouter(routes, { initialEntries: ['/sign-up'] });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext value={{ status: 'ready', session, role: 'student', onboarded: true }}>
          <RouterProvider router={router} />
        </AuthContext>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
  });
});
