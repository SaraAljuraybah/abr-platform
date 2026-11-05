import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { routes } from '@/test/routes';
import { axeViolations } from '@/test/axe';

const USER_ID = '00000000-0000-0000-0000-00000000000a';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

/**
 * An in-memory stand-in for the two tables, behind the same supabase-js calls the app makes.
 * Every update is recorded, so tests check exactly which columns the client sends.
 */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  profiles: new Map<string, Row>(),
  student_profiles: new Map<string, Row>(),
  updates: [] as { table: string; patch: Row }[],
  /** Makes the next update fail: an error, or matching no rows (what RLS does). */
  failNextUpdate: null as null | 'error' | 'noRows',
}));

vi.mock('@/lib/supabase', () => {
  const session = {
    user: { id: '00000000-0000-0000-0000-00000000000a', email_confirmed_at: '2026-11-05' },
  };
  const table = (name: 'profiles' | 'student_profiles') => db[name];
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: (name: 'profiles' | 'student_profiles') => ({
        select: () => ({
          eq: (_column: string, id: string) => {
            const read = () => Promise.resolve({ data: table(name).get(id) ?? null, error: null });
            return { single: read, maybeSingle: read };
          },
        }),
        update: (patch: Row) => ({
          eq: (_column: string, id: string) => ({
            select: () => {
              db.updates.push({ table: name, patch });
              const failure = db.failNextUpdate;
              db.failNextUpdate = null;
              if (failure === 'error') {
                return Promise.resolve({ data: null, error: { code: '23514', message: 'x' } });
              }
              const row = table(name).get(id);
              if (!row || failure === 'noRows') return Promise.resolve({ data: [], error: null });
              table(name).set(id, { ...row, ...patch });
              return Promise.resolve({ data: [{ id }], error: null });
            },
          }),
        }),
      }),
    },
  };
});

function seed(profile: Row = {}, student: Row = {}) {
  db.updates = [];
  db.failNextUpdate = null;
  db.profiles.set(USER_ID, {
    role: 'student',
    verification_status: 'verified',
    onboarding_completed: false,
    onboarding_step: 0,
    full_name: 'Sara Student',
    bio: null,
    ...profile,
  });
  db.student_profiles.set(USER_ID, {
    major: null,
    major_other: null,
    academic_level: null,
    graduation_year: null,
    skills: [],
    interests: [],
    github_url: null,
    universities: { name_en: 'King Saud University', name_ar: 'جامعة الملك سعود' },
    ...student,
  });
}

/** Mounts the app at /onboarding with a fresh cache, the way a page load (or refresh) does. */
async function load(path = '/onboarding') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return { router, ...view };
}

type Copy = (typeof copy)[Language];
const stepHeading = (t: Copy, name: keyof Copy['onboarding']['steps']) =>
  screen.findByRole('heading', { level: 2, name: new RegExp(t.onboarding.steps[name]) });

async function next(user: ReturnType<typeof userEvent.setup>, t: Copy) {
  await user.click(screen.getByRole('button', { name: t.onboarding.next }));
}

async function fillStudies(user: ReturnType<typeof userEvent.setup>, t: Copy) {
  await user.selectOptions(screen.getByLabelText(t.onboarding.studies.major), 'ai');
  await user.selectOptions(screen.getByLabelText(t.onboarding.studies.academicLevel), 'final_year');
  await user.selectOptions(screen.getByLabelText(t.onboarding.studies.graduationYear), '2026');
}

/** Validation runs asynchronously; the message joins the field's description. */
async function expectError(field: HTMLElement, message: string) {
  await waitFor(() => {
    expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
  });
  expect(field).toHaveAttribute('aria-invalid', 'true');
}

beforeEach(() => {
  seed();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('student onboarding (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('step 1: prefilled name, read-only university, validation, then saves name, bio and step', async () => {
    const user = userEvent.setup();
    await load();
    await stepHeading(t, 'about');

    const steps = within(screen.getByRole('navigation', { name: t.onboarding.stepperLabel }));
    expect(steps.getAllByRole('listitem')).toHaveLength(4);
    expect(steps.getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');
    const position = t.stepper.position.replace('{{current}}', '1').replace('{{total}}', '4');
    expect(steps.getByText(position)).toBeInTheDocument();

    const name = screen.getByLabelText(t.onboarding.about.fullName);
    expect(name).toHaveValue('Sara Student');
    expect(
      screen.getByText(language === 'ar' ? 'جامعة الملك سعود' : 'King Saud University'),
    ).toBeInTheDocument();
    // The university is text, not a field.
    expect(screen.queryByLabelText(t.onboarding.about.university)).toBeNull();

    await user.clear(name);
    await next(user, t);
    await expectError(name, t.validation.required);
    expect(db.updates).toEqual([]);

    await user.type(name, '  Sara A. ');
    await user.type(screen.getByLabelText(t.onboarding.about.bio), 'I build tools.');
    expect(screen.getByText('14/1000')).toBeInTheDocument();
    await next(user, t);

    const heading = await stepHeading(t, 'studies');
    expect(heading).toHaveFocus();
    expect(db.updates).toEqual([
      {
        table: 'profiles',
        patch: { full_name: 'Sara A.', bio: 'I build tools.', onboarding_step: 1 },
      },
    ]);
  });

  it('step 2: required choices, "Other" needs its text, then saves codes', async () => {
    const user = userEvent.setup();
    seed({ onboarding_step: 1 });
    await load();
    await stepHeading(t, 'studies');

    await next(user, t);
    for (const label of ['major', 'academicLevel', 'graduationYear'] as const) {
      await expectError(screen.getByLabelText(t.onboarding.studies[label]), t.validation.required);
    }

    await fillStudies(user, t);
    await user.selectOptions(screen.getByLabelText(t.onboarding.studies.major), 'other');
    await next(user, t);
    const other = screen.getByLabelText(t.onboarding.studies.majorOther);
    await expectError(other, t.validation.required);
    expect(db.updates).toEqual([]);

    await user.type(other, 'Robotics');
    await next(user, t);
    await stepHeading(t, 'skills');
    expect(db.updates).toEqual([
      {
        table: 'student_profiles',
        patch: {
          major: 'other',
          major_other: 'Robotics',
          academic_level: 'final_year',
          graduation_year: '2026',
        },
      },
      { table: 'profiles', patch: { onboarding_step: 2 } },
    ]);
  });

  it('step 3: skills by Enter and suggestion, no duplicates, removable; interests toggle', async () => {
    const user = userEvent.setup();
    seed({ onboarding_step: 2 });
    await load();
    await stepHeading(t, 'skills');

    const input = screen.getByLabelText(t.onboarding.skills.skills);
    await user.type(input, 'Rust{Enter}');
    // Enter adds a chip and does not submit the step.
    expect(db.updates).toEqual([]);
    await user.type(input, 'rust{Enter}');
    await user.click(
      screen.getByRole('button', { name: t.chips.add.replace('{{chip}}', 'React') }),
    );
    await user.click(
      screen.getByRole('button', { name: t.chips.add.replace('{{chip}}', 'Python') }),
    );

    const chips = within(screen.getByRole('list', { name: t.onboarding.skills.skills }));
    expect(chips.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Rust',
      'React',
      'Python',
    ]);
    await user.click(
      screen.getByRole('button', { name: t.chips.remove.replace('{{chip}}', 'React') }),
    );
    expect(input).toHaveFocus();
    expect(screen.getByText(t.chips.removed.replace('{{chip}}', 'React'))).toBeInTheDocument();

    const fintech = screen.getByRole('button', { name: t.onboarding.options.interest.fintech });
    const gaming = screen.getByRole('button', { name: t.onboarding.options.interest.gaming });
    await user.click(gaming);
    await user.click(fintech);
    expect(fintech).toHaveAttribute('aria-pressed', 'true');
    await next(user, t);

    await stepHeading(t, 'links');
    expect(db.updates[0]).toEqual({
      table: 'student_profiles',
      patch: { skills: ['Rust', 'Python'], interests: ['fintech', 'gaming'] },
    });
  });

  it('step 4: GitHub rule, adds https://, finishes, goes to /app with a toast', async () => {
    const user = userEvent.setup();
    seed(
      { onboarding_step: 3 },
      { major: 'cs', academic_level: 'final_year', graduation_year: '2026' },
    );
    const { router } = await load();
    await stepHeading(t, 'links');
    expect(screen.getByText(t.onboarding.links.githubHint)).toBeInTheDocument();

    const github = screen.getByLabelText(t.onboarding.links.github);
    await user.type(github, 'https://gitlab.com/sara');
    await user.click(screen.getByRole('button', { name: t.onboarding.finish }));
    await expectError(github, t.validation.githubUrl);
    expect(db.updates).toEqual([]);

    await user.clear(github);
    await user.type(github, 'github.com/sara-a');
    await user.click(screen.getByRole('button', { name: t.onboarding.finish }));

    expect(await screen.findByText(t.onboarding.done)).toBeInTheDocument();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
    expect(db.updates).toEqual([
      { table: 'student_profiles', patch: { github_url: 'https://github.com/sara-a' } },
      { table: 'profiles', patch: { onboarding_step: 4, onboarding_completed: true } },
    ]);
  });

  it(
    'axe: every step has no violations',
    async () => {
      const user = userEvent.setup();
      await load();
      await stepHeading(t, 'about');
      expect(await axeViolations()).toEqual([]);
      await next(user, t);
      await stepHeading(t, 'studies');
      await user.selectOptions(screen.getByLabelText(t.onboarding.studies.major), 'other');
      await next(user, t);
      expect(await axeViolations()).toEqual([]);
      await fillStudies(user, t);
      await next(user, t);
      await stepHeading(t, 'skills');
      await user.click(
        screen.getByRole('button', { name: t.chips.add.replace('{{chip}}', 'Cloud') }),
      );
      await user.click(
        screen.getByRole('button', { name: t.onboarding.options.interest.education }),
      );
      expect(await axeViolations()).toEqual([]);
      await next(user, t);
      await stepHeading(t, 'links');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('resume, Back and failures', () => {
  it('a refresh resumes at the first step not completed, with saved values', async () => {
    const user = userEvent.setup();
    seed(
      { onboarding_step: 2, bio: 'Saved bio' },
      { major: 'data', academic_level: 'postgraduate', graduation_year: '2024', skills: ['SQL'] },
    );
    const first = await load();
    await stepHeading(en, 'skills');
    expect(screen.getByRole('list', { name: en.onboarding.skills.skills })).toHaveTextContent(
      'SQL',
    );
    first.unmount();

    // Same data after a refresh; Back shows what was saved.
    await load();
    await stepHeading(en, 'skills');
    await user.click(screen.getByRole('button', { name: en.onboarding.back }));
    await stepHeading(en, 'studies');
    expect(screen.getByLabelText(en.onboarding.studies.major)).toHaveValue('data');
    expect(screen.getByLabelText(en.onboarding.studies.graduationYear)).toHaveValue('2024');
  });

  it('Back keeps unsaved values and never lowers the saved progress', async () => {
    const user = userEvent.setup();
    seed({ onboarding_step: 3 });
    await load();
    await stepHeading(en, 'links');
    await user.type(screen.getByLabelText(en.onboarding.links.github), 'github.com/typed');

    await user.click(screen.getByRole('button', { name: en.onboarding.back }));
    await user.click(screen.getByRole('button', { name: en.onboarding.back }));
    await user.click(screen.getByRole('button', { name: en.onboarding.back }));
    await stepHeading(en, 'about');
    expect(screen.queryByRole('button', { name: en.onboarding.back })).toBeNull();

    await next(user, en);
    await stepHeading(en, 'studies');
    expect(db.updates.at(-1)).toEqual({
      table: 'profiles',
      patch: { full_name: 'Sara Student', bio: null, onboarding_step: 3 },
    });
    await fillStudies(user, en);
    await next(user, en);
    await next(user, en);
    await stepHeading(en, 'links');
    expect(screen.getByLabelText(en.onboarding.links.github)).toHaveValue('github.com/typed');
  });

  it.each([
    ['an error', 'error'],
    ['no matching row (RLS)', 'noRows'],
  ] as const)(
    'a save that returns %s shows an error and stays on the step',
    async (_case, failure) => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const user = userEvent.setup();
      await load();
      await stepHeading(en, 'about');
      db.failNextUpdate = failure;
      await next(user, en);

      const alert = await screen.findByText(en.onboarding.errors.unexpected);
      expect(alert.closest('[tabindex="-1"]')).toHaveFocus();
      expect(screen.getByRole('heading', { level: 2, name: /About you/ })).toBeInTheDocument();
      expect(db.profiles.get(USER_ID)?.onboarding_step).toBe(0);
    },
  );

  it.each(['organization', 'mentor'])('a %s sees that their setup comes next', async (role) => {
    seed({ role, verification_status: 'pending' });
    await load();
    expect(screen.getByText(en.onboarding.comingNext)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: en.onboarding.stepperLabel })).toBeNull();
  });

  it('an onboarded student visiting /onboarding goes to /app', async () => {
    seed({ onboarding_completed: true, onboarding_step: 4 });
    const { router } = await load();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
  });

  it('a student who is not onboarded visiting /app goes to /onboarding', async () => {
    const { router } = await load('/app');
    await stepHeading(en, 'about');
    expect(router.state.location.pathname).toBe('/onboarding');
  });
});
