import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { routes } from '@/test/routes';

const USER_ID = '00000000-0000-0000-0000-00000000000a';
const OTHER_ID = '00000000-0000-0000-0000-00000000000b';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;

/**
 * An in-memory stand-in for the tables and RPCs behind the same supabase-js calls the app makes.
 * It applies the rules RLS applies: only the user's own projects are visible, and an update
 * outside draft / changes_requested matches no rows. Every update and RPC call is recorded.
 */
type Row = Record<string, unknown>;
const db = vi.hoisted(() => ({
  profiles: new Map<string, Row>(),
  student_profiles: new Map<string, Row>(),
  projects: new Map<string, Row>(),
  updates: [] as Row[],
  rpcs: [] as { name: string; args: Row }[],
  /** The next create_project call fails with this ABR_* code. */
  createError: null as string | null,
  /** The next delete_project call fails with this ABR_* code. */
  deleteError: null as string | null,
}));

vi.mock('@/lib/supabase', () => {
  const USER = '00000000-0000-0000-0000-00000000000a';
  const session = { user: { id: USER, email_confirmed_at: '2026-11-05' } };
  const visible = (name: string): Row[] =>
    name === 'projects'
      ? [...db.projects.values()].filter((row) => row.owner_id === USER).reverse()
      : [...(name === 'profiles' ? db.profiles : db.student_profiles).entries()].map(
          ([id, row]) => ({ ...row, id, user_id: id }),
        );

  function rows(name: string) {
    const filters: [string, unknown][] = [];
    const result = () =>
      visible(name).filter((row) => filters.every(([column, value]) => row[column] === value));
    const one = () => Promise.resolve({ data: result()[0] ?? null, error: null });
    const builder = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => Promise.resolve({ data: result(), error: null }),
      single: one,
      maybeSingle: one,
    };
    return builder;
  }

  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: (name: string) => ({
        select: () => rows(name),
        update: (patch: Row) => ({
          eq: (_column: string, id: string) => ({
            select: () => {
              db.updates.push(patch);
              const row = db.projects.get(id);
              const editable =
                row?.owner_id === USER &&
                (row.status === 'draft' || row.status === 'changes_requested');
              if (!row || !editable) return Promise.resolve({ data: [], error: null });
              db.projects.set(id, { ...row, ...patch });
              return Promise.resolve({ data: [{ id }], error: null });
            },
          }),
        }),
      }),
      rpc: (name: string, args: Row) => {
        db.rpcs.push({ name, args });
        if (name === 'create_project') {
          const code = db.createError;
          db.createError = null;
          if (code) return Promise.resolve({ data: null, error: { code: '55000', message: code } });
          db.projects.set('p-new', {
            id: 'p-new',
            owner_id: USER,
            status: 'draft',
            title: args.p_title,
            summary: null,
            description: null,
            track: null,
            sectors: [],
            academic_year: null,
          });
          return Promise.resolve({ data: 'p-new', error: null });
        }
        const code = db.deleteError;
        db.deleteError = null;
        if (code) return Promise.resolve({ data: null, error: { code: '55000', message: code } });
        db.projects.delete(String(args.p_project_id));
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

function project(row: Row = {}): Row {
  return {
    id: 'p-1',
    owner_id: USER_ID,
    status: 'draft',
    title: 'Campus Navigator',
    summary: 'Indoor maps for campus.',
    description: null,
    track: 'mobile',
    sectors: ['education'],
    academic_year: '2026',
    ...row,
  };
}

function seed(projects: Row[] = []) {
  db.profiles.clear();
  db.student_profiles.clear();
  db.projects.clear();
  db.updates = [];
  db.rpcs = [];
  db.createError = null;
  db.deleteError = null;
  db.profiles.set(USER_ID, {
    role: 'student',
    verification_status: 'verified',
    onboarding_completed: true,
    full_name: 'Sara Al Juraybah',
  });
  db.student_profiles.set(USER_ID, {
    major: 'cs',
    major_other: null,
    academic_level: 'final_year',
    graduation_year: '2026',
    skills: [],
    interests: [],
    github_url: null,
    universities: { name_en: 'King Saud University', name_ar: 'جامعة الملك سعود' },
  });
  for (const row of projects) db.projects.set(String(row.id), row);
}

async function load(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  await screen.findByRole('heading', { level: 1 });
  // The loading skeleton has a (hidden) h1 too: wait until the page itself is there.
  const loading = [en.projects.loading, ar.projects.loading];
  await waitFor(() => {
    expect(screen.queryByText((text) => loading.includes(text))).toBeNull();
  });
  return router;
}

type Copy = (typeof copy)[Language];
const dashboardLink = (t: Copy) => screen.getAllByRole('link', { name: t.shell.dashboard })[0];

beforeAll(() => {
  // Radix dialogs and menus use pointer capture and scrollIntoView, which jsdom lacks.
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

describe.each(['en', 'ar'] as const)('create a project (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('a title creates the draft and opens its edit page', async () => {
    const user = userEvent.setup();
    const router = await load('/app/projects/new');
    expect(
      screen.getByRole('heading', { level: 1, name: t.projects.new.title }),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.projects.fields.title), '  Campus Navigator  ');
    await user.click(screen.getByRole('button', { name: t.projects.new.submit }));

    expect(
      await screen.findByRole('heading', { level: 1, name: t.projects.edit.title }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/projects/p-new/edit');
    expect(db.rpcs).toEqual([{ name: 'create_project', args: { p_title: 'Campus Navigator' } }]);
    expect(await screen.findByLabelText(t.projects.fields.title)).toHaveValue('Campus Navigator');
    expect(screen.getByText(t.projectStatus.draft)).toBeInTheDocument();
  });

  it('validates the title before calling the server', async () => {
    const user = userEvent.setup();
    await load('/app/projects/new');
    const submit = screen.getByRole('button', { name: t.projects.new.submit });
    await user.click(submit);
    expect(await screen.findByText(t.validation.required)).toBeInTheDocument();
    await user.type(screen.getByLabelText(t.projects.fields.title), 'ab');
    await user.click(submit);
    expect(
      await screen.findByText(t.validation.tooShort.replace('{{min}}', '3')),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(t.projects.fields.title)).toHaveAttribute('aria-invalid', 'true');
    expect(db.rpcs).toEqual([]);
  });

  it('a student who already has a project goes straight to it', async () => {
    seed([project()]);
    const router = await load('/app/projects/new');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app/projects/p-1/edit');
    });
    expect(db.rpcs).toEqual([]);
  });

  it('a refused second project (ABR_PROJECT_LIMIT) opens the existing one', async () => {
    const user = userEvent.setup();
    const router = await load('/app/projects/new');
    // Created meanwhile (another tab): the server refuses, the refetch finds it.
    db.createError = 'ABR_PROJECT_LIMIT';
    db.projects.set('p-1', project());
    await user.type(screen.getByLabelText(t.projects.fields.title), 'Second project');
    await user.click(screen.getByRole('button', { name: t.projects.new.submit }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app/projects/p-1/edit');
    });
  });

  it('a refusal for who may create is explained in plain language', async () => {
    const user = userEvent.setup();
    await load('/app/projects/new');
    db.createError = 'ABR_NOT_VERIFIED';
    await user.type(screen.getByLabelText(t.projects.fields.title), 'Campus Navigator');
    await user.click(screen.getByRole('button', { name: t.projects.new.submit }));
    const error = await screen.findByText(t.projects.errors.notAllowed);
    await waitFor(() => {
      expect(error.parentElement?.parentElement).toHaveFocus();
    });
  });

  it(
    'axe: the create page has no violations',
    async () => {
      await load('/app/projects/new');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('edit a draft (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
    seed([project()]);
  });

  it('loads the draft, saves only the editable columns and says "Saved"', async () => {
    const user = userEvent.setup();
    await load('/app/projects/p-1/edit');
    expect(screen.getByLabelText(t.projects.fields.title)).toHaveValue('Campus Navigator');
    expect(screen.getByLabelText(t.projects.fields.summary)).toHaveValue('Indoor maps for campus.');
    expect(screen.getByLabelText(t.projects.fields.track)).toHaveValue('mobile');
    expect(
      screen.getByRole('checkbox', { name: t.onboarding.options.interest.education }),
    ).toBeChecked();

    await user.type(screen.getByLabelText(t.projects.fields.description), 'What we built.');
    await user.selectOptions(screen.getByLabelText(t.projects.fields.track), 'ai');
    await user.click(screen.getByRole('checkbox', { name: t.onboarding.options.interest.fintech }));
    await user.selectOptions(
      screen.getByLabelText(t.projects.fields.academicYear),
      '2027_or_later',
    );
    await user.click(screen.getByRole('button', { name: t.projects.save.button }));

    expect(await screen.findByText(t.projects.save.saved)).toBeInTheDocument();
    expect(db.updates).toEqual([
      {
        title: 'Campus Navigator',
        summary: 'Indoor maps for campus.',
        description: 'What we built.',
        track: 'ai',
        // In the order the sectors are listed on the page.
        sectors: ['fintech', 'education'],
        academic_year: '2027_or_later',
      },
    ]);
    // A new change hides "Saved" again.
    await user.type(screen.getByLabelText(t.projects.fields.summary), '!');
    expect(screen.queryByText(t.projects.save.saved)).toBeNull();
  });

  it('shows the character counters', async () => {
    await load('/app/projects/p-1/edit');
    const summary = screen.getByLabelText(t.projects.fields.summary);
    expect(summary).toHaveAttribute('maxLength', '300');
    expect(screen.getByLabelText(t.projects.fields.description)).toHaveAttribute(
      'maxLength',
      '5000',
    );
  });

  it('validation stops the save', async () => {
    const user = userEvent.setup();
    await load('/app/projects/p-1/edit');
    await user.clear(screen.getByLabelText(t.projects.fields.title));
    await user.click(screen.getByRole('button', { name: t.projects.save.button }));
    expect(await screen.findByText(t.validation.required)).toBeInTheDocument();
    expect(db.updates).toEqual([]);
  });

  it('allows up to 5 sectors: the others are disabled at the limit', async () => {
    seed([project({ sectors: ['fintech', 'health_tech', 'education', 'smart_cities', 'gaming'] })]);
    await load('/app/projects/p-1/edit');
    const sector = (code: keyof typeof t.onboarding.options.interest) =>
      screen.getByRole('checkbox', { name: t.onboarding.options.interest[code] });
    expect(sector('ecommerce')).toBeDisabled();
    expect(sector('other')).toBeDisabled();
    expect(sector('gaming')).toBeEnabled();
    await userEvent.setup().click(sector('gaming'));
    expect(sector('ecommerce')).toBeEnabled();
  });

  it('unsaved changes: leaving asks first; Stay keeps them, Leave goes', async () => {
    const user = userEvent.setup();
    const router = await load('/app/projects/p-1/edit');
    await user.type(screen.getByLabelText(t.projects.fields.summary), ' More.');

    await user.click(dashboardLink(t) ?? document.body);
    const dialog = await screen.findByRole('dialog', { name: t.projects.unsaved.title });
    expect(within(dialog).getByText(t.projects.unsaved.body)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.projects.unsaved.stay }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(router.state.location.pathname).toBe('/app/projects/p-1/edit');
    expect(screen.getByLabelText(t.projects.fields.summary)).toHaveValue(
      'Indoor maps for campus. More.',
    );

    await user.click(dashboardLink(t) ?? document.body);
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t.projects.unsaved.leave,
      }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
    expect(db.updates).toEqual([]);
  });

  it('after saving, leaving does not ask', async () => {
    const user = userEvent.setup();
    const router = await load('/app/projects/p-1/edit');
    await user.type(screen.getByLabelText(t.projects.fields.summary), ' More.');
    await user.click(screen.getByRole('button', { name: t.projects.save.button }));
    await screen.findByText(t.projects.save.saved);
    await user.click(dashboardLink(t) ?? document.body);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('delete: Cancel keeps the draft; confirming deletes it and returns to the dashboard', async () => {
    const user = userEvent.setup();
    const router = await load('/app/projects/p-1/edit');

    await user.click(screen.getByRole('button', { name: t.projects.delete.button }));
    let dialog = await screen.findByRole('dialog', { name: t.projects.delete.title });
    expect(
      within(dialog).getByText(t.projects.delete.body.replace('{{title}}', 'Campus Navigator')),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.projects.delete.cancel }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(screen.getByRole('button', { name: t.projects.delete.button })).toHaveFocus();
    expect(db.rpcs).toEqual([]);

    await user.click(screen.getByRole('button', { name: t.projects.delete.button }));
    dialog = await screen.findByRole('dialog', { name: t.projects.delete.title });
    await user.click(within(dialog).getByRole('button', { name: t.projects.delete.confirm }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    });
    expect(db.rpcs).toEqual([{ name: 'delete_project', args: { p_project_id: 'p-1' } }]);
    expect(await screen.findByText(t.projects.delete.done)).toBeInTheDocument();
    expect(
      await screen.findByRole('region', { name: t.dashboard.projects.title }),
    ).toHaveTextContent(t.dashboard.projects.empty);
  });

  it('delete refused (no longer a draft) is shown in the dialog', async () => {
    const user = userEvent.setup();
    await load('/app/projects/p-1/edit');
    db.deleteError = 'ABR_NOT_DRAFT';
    await user.click(screen.getByRole('button', { name: t.projects.delete.button }));
    const dialog = await screen.findByRole('dialog', { name: t.projects.delete.title });
    await user.click(within(dialog).getByRole('button', { name: t.projects.delete.confirm }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      t.projects.errors.notEditable,
    );
  });

  it('a save that RLS turns into a no-op is reported, never shown as saved', async () => {
    const user = userEvent.setup();
    await load('/app/projects/p-1/edit');
    // Submitted for review in another tab: the update now matches no rows.
    db.projects.set('p-1', project({ status: 'pending_review' }));
    await user.type(screen.getByLabelText(t.projects.fields.summary), ' More.');
    await user.click(screen.getByRole('button', { name: t.projects.save.button }));
    // The page reloads the project and shows it read-only.
    expect(await screen.findByText(t.projects.readOnly.notice)).toBeInTheDocument();
    expect(screen.queryByText(t.projects.save.saved)).toBeNull();
  });

  it(
    'axe: the edit page and the open delete dialog have no violations',
    async () => {
      const user = userEvent.setup();
      await load('/app/projects/p-1/edit');
      expect(await axeViolations()).toEqual([]);
      await user.click(screen.getByRole('button', { name: t.projects.delete.button }));
      await screen.findByRole('dialog');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('read-only and not found (%s)', (language) => {
  const t = copy[language];

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it.each(['pending_review', 'published', 'rejected', 'unpublished'] as const)(
    '%s is shown read-only, without a form or delete',
    async (status) => {
      seed([project({ status })]);
      await load('/app/projects/p-1/edit');
      expect(
        screen.getByRole('heading', { level: 1, name: t.projects.readOnly.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(t.projectStatus[status])).toBeInTheDocument();
      expect(screen.getByText(t.projects.readOnly.notice)).toBeInTheDocument();
      expect(screen.getByText('Campus Navigator')).toBeInTheDocument();
      expect(screen.getByText(t.projects.options.track.mobile)).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: t.projects.save.button })).toBeNull();
      expect(screen.queryByRole('button', { name: t.projects.delete.button })).toBeNull();
    },
  );

  it('changes requested is editable but cannot be deleted', async () => {
    seed([project({ status: 'changes_requested' })]);
    await load('/app/projects/p-1/edit');
    expect(screen.getByLabelText(t.projects.fields.title)).toBeInTheDocument();
    expect(screen.getByText(t.projectStatus.changes_requested)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.projects.delete.button })).toBeNull();
  });

  it("another student's project reads as not found", async () => {
    seed([project({ id: 'p-2', owner_id: OTHER_ID })]);
    await load('/app/projects/p-2/edit');
    expect(
      screen.getByRole('heading', { level: 1, name: t.projects.notFound.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.projects.backToDashboard })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it(
    'axe: the read-only view has no violations',
    async () => {
      seed([project({ status: 'pending_review' })]);
      await load('/app/projects/p-1/edit');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
