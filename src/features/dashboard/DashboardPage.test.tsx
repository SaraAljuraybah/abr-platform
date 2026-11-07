import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { routes } from '@/test/routes';
import { axeViolations } from '@/test/axe';

const USER_ID = '00000000-0000-0000-0000-00000000000a';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

type Row = Record<string, unknown>;
/** In-memory rows behind the supabase-js calls the app makes, plus a controllable session. */
const fake = vi.hoisted(() => {
  const studentFailures: { value: number | 'hang' } = { value: 0 };
  return {
    profiles: new Map<string, Row>(),
    student_profiles: new Map<string, Row>(),
    /** The student's own projects, newest first (what RLS and the owner filter return). */
    projects: [] as Row[],
    projectsFail: 0,
    signedIn: true,
    listener: null as null | ((event: string, session: unknown) => void),
    /** Reads of student_profiles fail this many times, or never resolve with 'hang'. */
    studentFailures,
    signOut: vi.fn(),
  };
});

vi.mock('@/lib/supabase', () => {
  const session = () =>
    fake.signedIn
      ? { user: { id: '00000000-0000-0000-0000-00000000000a', email_confirmed_at: '2026-11-05' } }
      : null;
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: session() }, error: null }),
        onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
          fake.listener = callback;
          return { data: { subscription: { unsubscribe: () => undefined } } };
        },
        signOut: (options: unknown) => {
          fake.signOut(options);
          fake.signedIn = false;
          fake.listener?.('SIGNED_OUT', null);
          return Promise.resolve({ error: null });
        },
      },
      from: (name: 'profiles' | 'student_profiles' | 'projects') => ({
        select: () => ({
          eq: (_column: string, id: string) => {
            if (name === 'projects') {
              return {
                order: () => {
                  if (fake.projectsFail > 0) {
                    fake.projectsFail -= 1;
                    return Promise.resolve({
                      data: null,
                      error: { code: 'PGRST000', message: 'x' },
                    });
                  }
                  return Promise.resolve({ data: fake.projects, error: null });
                },
              };
            }
            const read = () => {
              if (name === 'student_profiles' && fake.studentFailures.value === 'hang') {
                return new Promise(() => undefined);
              }
              const failures = fake.studentFailures.value;
              if (name === 'student_profiles' && typeof failures === 'number' && failures > 0) {
                fake.studentFailures.value = failures - 1;
                return Promise.resolve({ data: null, error: { code: 'PGRST000', message: 'x' } });
              }
              return Promise.resolve({ data: fake[name].get(id) ?? null, error: null });
            };
            return { single: read, maybeSingle: read };
          },
        }),
      }),
    },
  };
});

function seed(profile: Row = {}, student: Row = {}) {
  fake.signedIn = true;
  fake.studentFailures.value = 0;
  fake.projects = [];
  fake.projectsFail = 0;
  fake.signOut.mockReset();
  fake.profiles.set(USER_ID, {
    role: 'student',
    verification_status: 'verified',
    onboarding_completed: true,
    full_name: 'Sara Al Juraybah',
    ...profile,
  });
  fake.student_profiles.set(USER_ID, {
    major: 'other',
    major_other: 'Robotics',
    academic_level: 'final_year',
    graduation_year: '2027_or_later',
    skills: ['React', 'Python'],
    interests: ['fintech', 'gaming'],
    github_url: 'https://github.com/sara-a',
    universities: { name_en: 'King Saud University', name_ar: 'جامعة الملك سعود' },
    ...student,
  });
}

async function load(path = '/app') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  return router;
}

type Copy = (typeof copy)[Language];
const welcome = (t: Copy, name: string) => t.dashboard.welcome.replace('{{firstName}}', name);

beforeAll(() => {
  // Radix menus use pointer capture and scrollIntoView, which jsdom lacks.
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  });
});

beforeEach(() => {
  seed();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('app shell (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('logo to /app and the Dashboard link marked current only on /app', async () => {
    const router = await load();
    await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
    expect(screen.getByRole('link', { name: t.shell.homeLink })).toHaveAttribute('href', '/app');

    const nav = screen.getAllByRole('navigation', { name: t.shell.nav })[0];
    if (!nav) throw new Error('no app navigation');
    const dashboard = within(nav).getByRole('link', { name: t.shell.dashboard });
    expect(dashboard).toHaveAttribute('aria-current', 'page');

    act(() => {
      void router.navigate('/app/profile');
    });
    await screen.findByRole('heading', { level: 1, name: t.comingNext.profile });
    expect(within(nav).getByRole('link', { name: t.shell.dashboard })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('the account menu works with the keyboard and closes with Escape', async () => {
    const user = userEvent.setup();
    await load();
    await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });

    const trigger = screen.getByRole('button', { name: t.shell.accountMenu });
    expect(trigger).toHaveTextContent('Sara Al Juraybah');
    expect(trigger).toHaveTextContent('SJ');
    trigger.focus();
    await user.keyboard('{Enter}');

    const menu = await screen.findByRole('menu');
    expect(menu).toHaveAttribute('dir', language === 'ar' ? 'rtl' : 'ltr');
    const items = within(menu).getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([t.shell.myProfile, t.shell.signOut]);
    await waitFor(() => {
      expect(items[0]).toHaveFocus();
    });
    await user.keyboard('{ArrowDown}');
    expect(items[1]).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
    expect(trigger).toHaveFocus();
  });

  it('"My profile" opens the profile placeholder', async () => {
    const user = userEvent.setup();
    const router = await load();
    await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
    await user.click(screen.getByRole('button', { name: t.shell.accountMenu }));
    await user.click(await screen.findByRole('menuitem', { name: t.shell.myProfile }));
    expect(
      await screen.findByRole('heading', { level: 1, name: t.comingNext.profile }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/profile');
  });

  it('"Sign out" ends the session and goes to the landing page', async () => {
    const user = userEvent.setup();
    const router = await load();
    await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
    await user.click(screen.getByRole('button', { name: t.shell.accountMenu }));
    await user.click(await screen.findByRole('menuitem', { name: t.shell.signOut }));

    expect(
      await screen.findByRole('heading', { level: 1, name: t.landing.hero.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(fake.signOut).toHaveBeenCalledWith({ scope: 'local' });
    // Signed out: the landing header offers sign-in again, and /app is closed.
    expect(screen.getAllByRole('link', { name: t.nav.signIn }).length).toBeGreaterThan(0);
    act(() => {
      void router.navigate('/app');
    });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sign-in');
    });
  });

  it('the mobile menu holds the Dashboard link', async () => {
    const user = userEvent.setup();
    await load();
    await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
    await user.click(screen.getByRole('button', { name: t.nav.menu }));
    const navs = screen.getAllByRole('navigation', { name: t.shell.nav });
    expect(navs).toHaveLength(2);
    expect(
      within(navs.at(-1) ?? document.body).getByRole('link', { name: t.shell.dashboard }),
    ).toBeVisible();
  });
});

describe.each(['en', 'ar'] as const)('student dashboard (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('greets by first name with the status chip', async () => {
    await load();
    const heading = await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
    const chip = within(heading.parentElement ?? document.body).getByText(t.status.verified);
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('"What\'s next" with no project offers Create project', async () => {
    await load();
    const card = await screen.findByRole('region', { name: t.dashboard.next.title });
    expect(
      within(card).getByRole('heading', { name: t.dashboard.next.none.title }),
    ).toBeInTheDocument();
    expect(within(card).getByText(t.dashboard.next.none.body)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: t.dashboard.createProject })).toHaveAttribute(
      'href',
      '/app/projects/new',
    );
  });

  it('the profile card shows the "Other" text, labels, chips and the GitHub link', async () => {
    await load();
    const card = await screen.findByRole('region', { name: t.dashboard.profile.title });
    const value = (label: string) => within(card).getByText(label).nextElementSibling;

    expect(value(t.onboarding.about.university)).toHaveTextContent(
      language === 'ar' ? 'جامعة الملك سعود' : 'King Saud University',
    );
    expect(value(t.onboarding.studies.major)).toHaveTextContent('Robotics');
    expect(value(t.onboarding.studies.academicLevel)).toHaveTextContent(
      t.onboarding.options.academicLevel.final_year,
    );
    expect(value(t.onboarding.studies.graduationYear)).toHaveTextContent(
      t.forms.interest.options.graduation_year['2027_or_later'],
    );
    const skills = within(card).getByRole('list', { name: t.dashboard.profile.skills });
    expect(
      within(skills)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['React', 'Python']);
    const interests = within(card).getByRole('list', { name: t.dashboard.profile.interests });
    expect(
      within(interests)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([t.onboarding.options.interest.fintech, t.onboarding.options.interest.gaming]);

    const github = within(card).getByRole('link', { name: new RegExp('github.com/sara-a') });
    expect(github).toHaveAttribute('href', 'https://github.com/sara-a');
    expect(github).toHaveAttribute('target', '_blank');
    expect(github).toHaveAttribute('rel', 'noopener noreferrer');
    expect(github).toHaveAccessibleName(`github.com/sara-a ${t.dashboard.opensInNewTab}`);

    expect(within(card).getByRole('link', { name: t.dashboard.profile.edit })).toHaveAttribute(
      'href',
      '/app/profile',
    );
  });

  it('a listed field of study shows its label; missing values say "not added yet"', async () => {
    seed({}, { major: 'cs', major_other: null, skills: [], interests: [], github_url: null });
    await load();
    const card = await screen.findByRole('region', { name: t.dashboard.profile.title });
    expect(within(card).getByText(t.onboarding.studies.major).nextElementSibling).toHaveTextContent(
      t.forms.interest.options.field_of_study.cs,
    );
    expect(within(card).getAllByText(t.dashboard.profile.notSet)).toHaveLength(3);
    expect(within(card).queryByRole('link', { name: /github/i })).toBeNull();
  });

  it('"Your projects" is empty with the same Create project button', async () => {
    await load();
    const card = await screen.findByRole('region', { name: t.dashboard.projects.title });
    expect(within(card).getByText(t.dashboard.projects.empty)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: t.dashboard.createProject })).toHaveAttribute(
      'href',
      '/app/projects/new',
    );
  });

  it('a draft: "What\'s next" continues it and "Your projects" lists it with its status', async () => {
    fake.projects = [{ id: 'p-1', title: 'Campus Navigator', status: 'draft' }];
    await load();
    const next = await screen.findByRole('region', { name: t.dashboard.next.title });
    expect(
      within(next).getByRole('heading', { name: t.dashboard.next.draft.title }),
    ).toBeInTheDocument();
    expect(within(next).getByRole('link', { name: t.dashboard.next.draft.cta })).toHaveAttribute(
      'href',
      '/app/projects/p-1/edit',
    );
    expect(within(next).queryByRole('link', { name: t.dashboard.createProject })).toBeNull();

    const card = screen.getByRole('region', { name: t.dashboard.projects.title });
    const item = within(card).getByRole('listitem');
    expect(within(item).getByRole('link', { name: 'Campus Navigator' })).toHaveAttribute(
      'href',
      '/app/projects/p-1/edit',
    );
    expect(within(item).getByText(t.projectStatus.draft)).toBeInTheDocument();
    expect(within(card).queryByText(t.dashboard.projects.empty)).toBeNull();
    expect(within(card).queryByRole('link', { name: t.dashboard.createProject })).toBeNull();
  });

  it.each(['pending_review', 'changes_requested', 'rejected', 'published', 'unpublished'] as const)(
    '"What\'s next" for %s: its own message, the status chip and the next action',
    async (status) => {
      fake.projects = [{ id: 'p-1', title: 'Campus Navigator', status }];
      await load();
      const next = await screen.findByRole('region', { name: t.dashboard.next.title });
      const copyFor = t.dashboard.next[status];
      expect(within(next).getByRole('heading', { name: copyFor.title })).toBeInTheDocument();
      expect(within(next).getByText(copyFor.body)).toBeInTheDocument();
      expect(within(next).getByText(t.projectStatus[status])).toBeInTheDocument();
      expect(within(next).getByRole('link', { name: copyFor.cta })).toHaveAttribute(
        'href',
        '/app/projects/p-1/edit',
      );
    },
  );

  it('projects that fail to load show an error with a retry', async () => {
    const user = userEvent.setup();
    fake.projectsFail = 1;
    await load();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.dashboard.projects.error);
    // The profile still shows.
    expect(screen.getByRole('region', { name: t.dashboard.profile.title })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.dashboard.retry }));
    expect(
      await screen.findByRole('region', { name: t.dashboard.projects.title }),
    ).toBeInTheDocument();
  });

  it(
    'axe: the dashboard with a draft has no violations',
    async () => {
      fake.projects = [{ id: 'p-1', title: 'Campus Navigator', status: 'draft' }];
      await load();
      await screen.findByRole('region', { name: t.dashboard.projects.title });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it('shows a loading state with a heading while the profile loads', async () => {
    fake.studentFailures.value = 'hang';
    await load();
    expect(await screen.findByRole('status')).toHaveTextContent(t.dashboard.loading);
    expect(screen.getByRole('heading', { level: 1, name: t.dashboard.title })).toBeInTheDocument();
  });

  it('an error offers a retry that loads the dashboard', async () => {
    const user = userEvent.setup();
    fake.studentFailures.value = 1;
    await load();
    expect(await screen.findByRole('alert')).toHaveTextContent(t.dashboard.error);
    await user.click(screen.getByRole('button', { name: t.dashboard.retry }));
    expect(
      await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') }),
    ).toBeInTheDocument();
  });

  it(
    'axe: the dashboard and the open account menu have no violations',
    async () => {
      const user = userEvent.setup();
      await load();
      await screen.findByRole('heading', { level: 1, name: welcome(t, 'Sara') });
      expect(await axeViolations()).toEqual([]);
      await user.click(screen.getByRole('button', { name: t.shell.accountMenu }));
      await screen.findByRole('menu');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('other roles on /app (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it.each([
    ['organization', 'pending'],
    ['mentor', 'rejected'],
  ] as const)('a %s (%s) sees the coming-next card with their status', async (role, status) => {
    seed({ role, verification_status: status });
    await load();
    const card = await screen.findByRole('region', { name: t.dashboard.other.title });
    expect(within(card).getByText(t.dashboard.other.body)).toBeInTheDocument();
    expect(within(card).getByText(t.status[status])).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: t.dashboard.profile.title })).toBeNull();
  });

  it('an admin keeps the placeholder', async () => {
    seed({ role: 'admin', verification_status: 'verified' });
    await load();
    expect(
      await screen.findByRole('heading', { level: 1, name: t.placeholder.pages.app }),
    ).toBeInTheDocument();
  });

  it(
    'axe: the coming-next card has no violations',
    async () => {
      seed({ role: 'organization', verification_status: 'pending' });
      await load();
      await screen.findByRole('region', { name: t.dashboard.other.title });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('placeholders and guards', () => {
  it('/app/profile shows its coming-next page with a way back', async () => {
    await load('/app/profile');
    expect(
      await screen.findByRole('heading', { level: 1, name: en.comingNext.profile }),
    ).toBeInTheDocument();
    expect(screen.getByText(en.comingNext.body)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: en.comingNext.backToDashboard })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it.each(['/app/projects/new', '/app/projects/p-1/edit'])(
    'an organization is sent from %s to /app (students only; UX guard)',
    async (path) => {
      seed({ role: 'organization', verification_status: 'verified' });
      const router = await load(path);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/app');
      });
    },
  );

  it.each(['/app/profile', '/app/projects/new', '/app/projects/p-1/edit'])(
    'a student who is not onboarded is sent from %s to /onboarding',
    async (path) => {
      seed({ onboarding_completed: false });
      const router = await load(path);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/onboarding');
      });
    },
  );

  it.each(['/app', '/app/profile', '/app/projects/new'])(
    'a signed-out visitor is sent from %s to sign-in',
    async (path) => {
      fake.signedIn = false;
      const router = await load(path);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/sign-in');
      });
      expect(new URLSearchParams(router.state.location.search).get('next')).toBe(path);
    },
  );
});
