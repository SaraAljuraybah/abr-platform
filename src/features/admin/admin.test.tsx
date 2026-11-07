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

const P1 = '11111111-0000-4000-8000-000000000001';
const P2 = '11111111-0000-4000-8000-000000000002';
const P3 = '11111111-0000-4000-8000-000000000003';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const SLOW = { timeout: 5_000 };

type Row = Record<string, unknown>;
/** In-memory projects, counts, stats, reviews and RPCs behind the supabase-js calls the app makes. */
const db = vi.hoisted(() => ({
  role: 'admin',
  projects: [] as Row[],
  history: [] as Row[],
  stats: [] as Row[],
  rpcs: [] as { name: string; args: Row | undefined }[],
  orders: [] as { column: string; ascending: boolean | undefined }[],
  /** The next review_project call fails with this ABR_* code. */
  reviewError: null as string | null,
}));

vi.mock('@/lib/supabase', () => {
  const ADMIN = '00000000-0000-0000-0000-0000000000ad';
  const session = { user: { id: ADMIN, email_confirmed_at: '2026-11-01' } };
  const STATUSES = [
    'draft',
    'pending_review',
    'changes_requested',
    'published',
    'rejected',
    'unpublished',
  ];
  function rows(name: string) {
    const filters: [string, unknown][] = [];
    const source = (): Row[] =>
      name === 'projects'
        ? db.projects
        : name === 'profiles'
          ? [
              {
                id: ADMIN,
                role: db.role,
                verification_status: 'verified',
                onboarding_completed: true,
                full_name: 'Admin X',
              },
            ]
          : [];
    const result = () => source().filter((row) => filters.every(([c, v]) => row[c] === v));
    const one = () => Promise.resolve({ data: result()[0] ?? null, error: null });
    const builder = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        db.orders.push({ column, ascending: options?.ascending });
        const sorted = [...result()].sort((a, b) => {
          const x = typeof a[column] === 'string' ? a[column] : '';
          const y = typeof b[column] === 'string' ? b[column] : '';
          return options?.ascending === false ? y.localeCompare(x) : x.localeCompare(y);
        });
        return Promise.resolve({ data: sorted, error: null });
      },
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
      from: (name: string) => ({ select: () => rows(name) }),
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: (name: string) =>
            Promise.resolve({
              data: { signedUrl: `https://signed.test/${bucket}/${name}` },
              error: null,
            }),
          info: () =>
            Promise.resolve({
              data: { size: 2048, metadata: { name: 'Report.pdf' } },
              error: null,
            }),
        }),
      },
      rpc: (name: string, args?: Row) => {
        db.rpcs.push({ name, args });
        if (name === 'admin_project_counts') {
          return Promise.resolve({
            data: STATUSES.map((status) => ({
              status,
              count: db.projects.filter((p) => p.status === status).length,
            })),
            error: null,
          });
        }
        if (name === 'get_interest_stats') return Promise.resolve({ data: db.stats, error: null });
        if (name === 'admin_project_reviews')
          return Promise.resolve({ data: db.history, error: null });
        if (name === 'review_project') {
          const code = db.reviewError;
          db.reviewError = null;
          const project = db.projects.find((p) => p.id === args?.p_project_id);
          if (code) {
            if (code === 'ABR_NOT_PENDING' && project) project.status = 'draft';
            return Promise.resolve({ data: null, error: { message: code } });
          }
          if (project) {
            project.status =
              args?.p_decision === 'approved' ? 'published' : String(args?.p_decision);
          }
          return Promise.resolve({ data: 'review-1', error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
      },
    },
  };
});

function project(id: string, row: Row = {}): Row {
  return {
    id,
    owner_id: 'student',
    status: 'pending_review',
    title: 'Campus Navigator',
    summary: 'Indoor maps for campus.',
    description: 'A clear description of the project.',
    track: 'mobile',
    sectors: ['education'],
    academic_year: '2026',
    stage: 'prototype',
    team_size: 3,
    looking_for_members: false,
    wanted_specializations: [],
    needs: ['mentor'],
    image_path: null,
    document_path: `${id}/document-aaaaaaaa-0000-4000-8000-000000000001.pdf`,
    video_url: null,
    repo_url: 'https://github.com/team/project',
    demo_url: null,
    submitted_at: '2026-11-05T09:00:00Z',
    updated_at: '2026-11-05T09:00:00Z',
    owner: { full_name: 'Sara Student' },
    university: { name_en: 'King Saud University', name_ar: 'جامعة الملك سعود' },
    ...row,
  };
}

function seed() {
  db.role = 'admin';
  db.rpcs = [];
  db.orders = [];
  db.reviewError = null;
  db.projects = [
    project(P1, { title: 'Newer submission', submitted_at: '2026-11-06T09:00:00Z' }),
    project(P2, {
      title: 'Older submission',
      submitted_at: '2026-11-02T09:00:00Z',
      track: 'ai',
      owner: { full_name: 'Omar Student' },
    }),
    project(P3, { title: 'Live project', status: 'published', updated_at: '2026-11-04T09:00:00Z' }),
  ];
  db.history = [
    {
      id: 'r2',
      decision: 'changes_requested',
      notes: 'Add a demo video.',
      created_at: '2026-11-04T10:00:00Z',
      reviewer_name: 'Admin X',
    },
  ];
  db.stats = [
    { dimension: 'role', value: 'student', count: 3 },
    { dimension: 'role', value: 'organization', count: 2 },
    { dimension: 'field_of_study', value: 'cs', count: 2 },
    { dimension: 'field_of_study', value: 'mystery_code', count: 1 },
    { dimension: 'heard_from', value: 'linkedin', count: 4 },
  ];
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
  await screen.findByRole('heading', { level: 1 }, SLOW);
  await waitFor(() => {
    expect(screen.queryByRole('status', { name: '' })).toBeNull();
  }, SLOW).catch(() => undefined);
  return router;
}

type Copy = (typeof copy)[Language];
/** An element that must exist (the test fails clearly if it does not). */
function nth(list: HTMLElement[], index: number): HTMLElement {
  const element = list[index];
  if (!element) throw new Error(`no element at ${String(index)}`);
  return element;
}
const adminNav = (t: Copy) => screen.getByRole('navigation', { name: t.admin.nav.label });

beforeAll(() => {
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

describe('admin guard (UX only)', () => {
  it.each(['student', 'organization'])('a %s at /admin is sent to /app', async (role) => {
    db.role = role;
    const router = createMemoryRouter(routes, { initialEntries: ['/admin'] });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    }, SLOW);
  });
});

describe.each(['en', 'ar'] as const)('admin area (%s)', (language) => {
  const t = copy[language];
  const a = t.admin;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('the admin navigation marks the current page', async () => {
    const user = userEvent.setup();
    await load('/admin');
    const nav = within(adminNav(t));
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      a.nav.overview,
      a.nav.projects,
      a.nav.interest,
    ]);
    expect(nav.getByRole('link', { name: a.nav.overview })).toHaveAttribute('aria-current', 'page');
    await user.click(nav.getByRole('link', { name: a.nav.projects }));
    await screen.findByRole('heading', { level: 1, name: a.queue.title }, SLOW);
    expect(within(adminNav(t)).getByRole('link', { name: a.nav.projects })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('overview: projects per status, pending first and linked, plus the interest total', async () => {
    await load('/admin');
    const section = within(await screen.findByRole('region', { name: a.overview.projects }));
    const cards = await section.findAllByRole('listitem', {}, SLOW);
    expect(cards[0]).toHaveTextContent(t.projectStatus.pending_review);
    expect(cards[0]).toHaveTextContent('2');
    expect(
      within(nth(cards, 0)).getByRole('link', { name: new RegExp(a.overview.reviewNow) }),
    ).toHaveAttribute('href', '/admin/projects');
    const published = cards.find((card) => card.textContent.includes(t.projectStatus.published));
    expect(published).toHaveTextContent('1');
    const interest = within(screen.getByRole('region', { name: a.overview.interestTitle }));
    expect(await interest.findByText('5')).toBeInTheDocument();
  });

  it('queue: pending projects, oldest submission first, with student, university and track', async () => {
    await load('/admin/projects');
    const list = await screen.findByRole('list', { name: t.projectStatus.pending_review }, SLOW);
    const items = within(list).getAllByRole('listitem');
    expect(items.map((item) => within(item).getByRole('link').textContent)).toEqual([
      'Older submission',
      'Newer submission',
    ]);
    expect(db.orders.at(-1)).toEqual({ column: 'submitted_at', ascending: true });
    const first = within(nth(items, 0));
    expect(first.getByText('Omar Student')).toBeInTheDocument();
    expect(
      first.getByText(language === 'ar' ? 'جامعة الملك سعود' : 'King Saud University'),
    ).toBeInTheDocument();
    expect(first.getByText(t.projects.options.track.ai, { exact: false })).toBeInTheDocument();
    expect(
      first.getByText(a.queue.submitted.split('{{')[0] ?? '', { exact: false }),
    ).toBeInTheDocument();
    expect(first.getByTestId('project-image-default')).toBeInTheDocument();
    expect(first.getByRole('link')).toHaveAttribute('href', `/admin/projects/${P2}`);
  });

  it('queue: the status filter shows other outcomes, with an empty state', async () => {
    const user = userEvent.setup();
    const router = await load('/admin/projects');
    const filter = within(screen.getByRole('navigation', { name: a.queue.filterLabel }));
    expect(filter.getByRole('link', { name: t.projectStatus.pending_review })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await user.click(filter.getByRole('link', { name: t.projectStatus.published }));
    await waitFor(() => {
      expect(router.state.location.search).toBe('?status=published');
    });
    const list = await screen.findByRole('list', { name: t.projectStatus.published }, SLOW);
    expect(within(list).getByRole('link', { name: 'Live project' })).toBeInTheDocument();
    await user.click(filter.getByRole('link', { name: t.projectStatus.rejected }));
    expect(await screen.findByText(a.queue.empty, {}, SLOW)).toBeInTheDocument();
  });

  it('review page: everything the student entered, the history with reviewer names, the panel', async () => {
    await load(`/admin/projects/${P2}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Older submission' })).toBeInTheDocument();
    expect(screen.getByText('Omar Student')).toBeInTheDocument();
    expect(screen.getByText('Indoor maps for campus.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: t.projects.fields.needs })).toHaveTextContent(
      t.projects.options.need.mentor,
    );
    expect(await screen.findByText('Report.pdf', {}, SLOW)).toBeInTheDocument();
    expect(
      await screen.findByRole('link', {
        name: `${t.projects.media.open} ${t.legal.opensInNewTab}`,
      }),
    ).toHaveAttribute('target', '_blank');
    const history = within(screen.getByRole('region', { name: a.review.historyTitle }));
    expect(await history.findByText('Add a demo video.')).toBeInTheDocument();
    expect(history.getByText(a.review.by.replace('{{name}}', 'Admin X'))).toBeInTheDocument();
    const panel = within(screen.getByRole('region', { name: a.review.decisionTitle }));
    for (const name of [a.review.approve, a.review.requestChanges, a.review.reject]) {
      expect(panel.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('approve: confirm, review_project, back to the queue with a toast', async () => {
    const user = userEvent.setup();
    const router = await load(`/admin/projects/${P2}`);
    await user.click(screen.getByRole('button', { name: a.review.approve }));
    const dialog = await screen.findByRole('dialog', { name: a.review.dialog.approved.title });
    expect(within(dialog).getByText(a.review.dialog.approved.body)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(a.review.notesOptional)).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole('button', { name: a.review.dialog.approved.confirm }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/admin/projects');
    }, SLOW);
    expect(db.rpcs.filter((call) => call.name === 'review_project')).toEqual([
      { name: 'review_project', args: { p_project_id: P2, p_decision: 'approved', p_notes: '' } },
    ]);
    expect(await screen.findByText(a.review.done.approved)).toBeInTheDocument();
  });

  it.each(['changes_requested', 'rejected'] as const)(
    '%s needs notes before anything is sent',
    async (decision) => {
      const user = userEvent.setup();
      const router = await load(`/admin/projects/${P2}`);
      const button = decision === 'rejected' ? a.review.reject : a.review.requestChanges;
      await user.click(screen.getByRole('button', { name: button }));
      const dialog = await screen.findByRole('dialog', { name: a.review.dialog[decision].title });
      const confirm = within(dialog).getByRole('button', {
        name: a.review.dialog[decision].confirm,
      });
      await user.click(confirm);
      const notes = within(dialog).getByLabelText(a.review.notes);
      await waitFor(() => {
        expect(notes).toHaveAccessibleDescription(expect.stringContaining(a.review.notesRequired));
      });
      expect(db.rpcs.filter((call) => call.name === 'review_project')).toEqual([]);

      await user.type(notes, 'Please add a demo video.');
      await user.click(confirm);
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/admin/projects');
      }, SLOW);
      expect(db.rpcs.find((call) => call.name === 'review_project')?.args).toEqual({
        p_project_id: P2,
        p_decision: decision,
        p_notes: 'Please add a demo video.',
      });
      expect(await screen.findByText(a.review.done[decision])).toBeInTheDocument();
    },
  );

  it('cancel sends nothing', async () => {
    const user = userEvent.setup();
    await load(`/admin/projects/${P2}`);
    await user.click(screen.getByRole('button', { name: a.review.reject }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: a.review.cancel }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(db.rpcs.filter((call) => call.name === 'review_project')).toEqual([]);
  });

  it('a project withdrawn meanwhile: "no longer awaiting review", no panel', async () => {
    const user = userEvent.setup();
    await load(`/admin/projects/${P2}`);
    db.reviewError = 'ABR_NOT_PENDING';
    await user.click(screen.getByRole('button', { name: a.review.approve }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: a.review.dialog.approved.confirm }),
    );
    expect(await screen.findByText(a.review.notPending, {}, SLOW)).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: a.review.decisionTitle })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a project that is not pending when opened shows the message and no decisions', async () => {
    await load(`/admin/projects/${P3}`);
    expect(screen.getByText(a.review.notPending)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: a.review.approve })).toBeNull();
  });

  it('interest: one table per dimension, with labels, counts and shares', async () => {
    await load('/admin/interest');
    const total = await screen.findByText(a.interest.total, { exact: false }, SLOW);
    expect(total.parentElement).toHaveTextContent(`${a.interest.total}: 5`);
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings.slice(0, 3)).toEqual([
      a.interest.dimension.role,
      a.interest.dimension.university,
      a.interest.dimension.field_of_study,
    ]);
    expect(headings).toHaveLength(11);

    const role = within(screen.getByRole('table', { name: a.interest.dimension.role }));
    const rows = role.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      t.auth.signUp.roles.student.title,
      t.auth.signUp.roles.organization.title,
    ]);
    expect(within(nth(rows, 0)).getByText('3')).toBeInTheDocument();
    expect(within(nth(rows, 0)).getByText('60%')).toBeInTheDocument();

    const field = within(screen.getByRole('table', { name: a.interest.dimension.field_of_study }));
    expect(field.getByText(t.forms.interest.options.field_of_study.cs)).toBeInTheDocument();
    expect(field.getByText('mystery_code')).toBeInTheDocument();
    const university = within(
      screen.getByRole('region', { name: a.interest.dimension.university }),
    );
    expect(university.getByText(a.interest.empty)).toBeInTheDocument();
  });

  it(
    'axe: overview, queue, review page with a dialog, and interest have no violations',
    async () => {
      const user = userEvent.setup();
      await load('/admin');
      await screen.findAllByRole('listitem', {}, SLOW);
      expect(await axeViolations()).toEqual([]);

      await user.click(within(adminNav(t)).getByRole('link', { name: a.nav.projects }));
      await screen.findByRole('list', { name: t.projectStatus.pending_review }, SLOW);
      expect(await axeViolations()).toEqual([]);

      await user.click(screen.getByRole('link', { name: 'Older submission' }));
      await screen.findByRole('region', { name: a.review.decisionTitle }, SLOW);
      expect(await axeViolations()).toEqual([]);
      await user.click(screen.getByRole('button', { name: a.review.reject }));
      await screen.findByRole('dialog');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the interest page has no violations',
    async () => {
      await load('/admin/interest');
      await screen.findAllByRole('table', {}, SLOW);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
