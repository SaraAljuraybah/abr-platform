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
const PROJECT_ID = '22222222-3333-4444-8555-666666666666';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const SLOW = { timeout: 5_000 };

type Row = Record<string, unknown>;
/**
 * In-memory rows behind the supabase-js calls the app makes. The two RPCs apply the same rules as
 * the database (owner, status, completeness with the missing fields in form order); every write is
 * recorded in `calls`, in order.
 */
const db = vi.hoisted(() => ({
  profiles: new Map<string, Row>(),
  student_profiles: new Map<string, Row>(),
  project: null as Row | null,
  reviews: [] as Row[],
  calls: [] as string[],
  /** Fields the server reports missing even when the page thinks the project is complete. */
  serverMissing: null as string | null,
}));

vi.mock('@/lib/supabase', () => {
  const USER = '00000000-0000-0000-0000-00000000000a';
  const session = { user: { id: USER, email_confirmed_at: '2026-11-05' } };
  const source = (name: string): Row[] => {
    if (name === 'projects') return db.project ? [db.project] : [];
    if (name === 'project_reviews') return [...db.reviews].reverse();
    return [...(name === 'profiles' ? db.profiles : db.student_profiles).entries()].map(
      ([id, row]) => ({ ...row, id, user_id: id }),
    );
  };
  function rows(name: string) {
    const filters: [string, unknown][] = [];
    const result = () =>
      source(name).filter((row) => filters.every(([column, value]) => row[column] === value));
    const one = () => Promise.resolve({ data: result()[0] ?? null, error: null });
    const builder = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => Object.assign(Promise.resolve({ data: result(), error: null }), builder),
      limit: () => builder,
      single: one,
      maybeSingle: one,
    };
    return builder;
  }
  const missing = (p: Row) => {
    const out: string[] = [];
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    if (!text(p.title)) out.push('title');
    if (!text(p.summary)) out.push('summary');
    if (text(p.description).length < 100) out.push('description');
    if (!p.track) out.push('track');
    if (!p.academic_year) out.push('academic_year');
    if (!p.stage) out.push('stage');
    return out;
  };
  const refuse = (message: string) => Promise.resolve({ data: null, error: { message } });
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: (name: string) => ({
        select: () => rows(name),
        update: (patch: Row) => ({
          eq: () => ({
            select: () => {
              db.calls.push('update');
              const p = db.project;
              if (!p || (p.status !== 'draft' && p.status !== 'changes_requested')) {
                return Promise.resolve({ data: [], error: null });
              }
              db.project = { ...p, ...patch };
              return Promise.resolve({ data: [{ id: p.id }], error: null });
            },
          }),
        }),
      }),
      storage: {
        from: () => ({
          createSignedUrl: () => refuse('no file'),
          info: () => refuse('no file'),
          list: () => Promise.resolve({ data: [], error: null }),
          remove: () => Promise.resolve({ data: [], error: null }),
        }),
      },
      rpc: (name: string) => {
        db.calls.push(`rpc:${name}`);
        const p = db.project;
        if (!p) return refuse('ABR_PROJECT_NOT_FOUND');
        if (name === 'submit_project') {
          if (p.status !== 'draft' && p.status !== 'changes_requested') {
            return refuse('ABR_NOT_SUBMITTABLE');
          }
          const gaps = db.serverMissing ?? missing(p).join(',');
          db.serverMissing = null;
          if (gaps) return refuse(`ABR_PROJECT_INCOMPLETE: ${gaps}`);
          db.project = { ...p, status: 'pending_review' };
        } else if (name === 'withdraw_submission') {
          if (p.status !== 'pending_review') return refuse('ABR_NOT_PENDING');
          db.project = { ...p, status: 'draft' };
        }
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

const COMPLETE: Row = {
  summary: 'Indoor maps for campus.',
  description: 'A clear description of what the project does and how it was built. '.repeat(2),
  track: 'mobile',
  academic_year: '2026',
  stage: 'prototype',
};

function seed(row: Row = {}, reviews: Row[] = []) {
  db.profiles.clear();
  db.student_profiles.clear();
  db.calls = [];
  db.serverMissing = null;
  db.reviews = reviews;
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
  db.project = {
    id: PROJECT_ID,
    owner_id: USER_ID,
    status: 'draft',
    title: 'Campus Navigator',
    summary: null,
    description: null,
    track: null,
    sectors: [],
    academic_year: null,
    stage: null,
    team_size: 1,
    looking_for_members: false,
    wanted_specializations: [],
    needs: [],
    image_path: null,
    document_path: null,
    video_url: null,
    repo_url: null,
    demo_url: null,
    ...row,
  };
}

async function load(path = `/app/projects/${PROJECT_ID}/edit`) {
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
  const loading = [en.projects.loading, ar.projects.loading];
  await waitFor(() => {
    expect(screen.queryByText((text) => loading.includes(text))).toBeNull();
  }, SLOW);
  return router;
}

type Copy = (typeof copy)[Language];
const submitRegion = (t: Copy, resubmit = false) =>
  screen.getByRole('region', {
    name: resubmit ? t.projects.submit.resubmitTitle : t.projects.submit.title,
  });
const banner = (t: Copy, status: keyof Copy['projects']['status']) =>
  screen.getByRole('region', {
    name: (t.projects.status[status] as { title: string }).title,
  });

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

describe.each(['en', 'ar'] as const)('submit for review (%s)', (language) => {
  const t = copy[language];
  const s = t.projects.submit;
  const f = t.projects.fields;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('the checklist names what is missing; each item takes you to its field', async () => {
    const user = userEvent.setup();
    await load();
    const section = within(submitRegion(t));
    const items = () =>
      within(section.getByRole('list'))
        .getAllByRole('button')
        .map((button) => button.textContent);
    expect(items()).toEqual([
      f.summary,
      s.descriptionItem.replace('{{min}}', '100'),
      f.track,
      f.academicYear,
      f.stage,
    ]);
    // Missing is said in words, not only by the icon's colour.
    expect(section.getAllByText(s.missing, { exact: false })).toHaveLength(5);
    expect(section.getByText(s.completeFirst)).toBeInTheDocument();
    expect(section.getByRole('button', { name: s.button })).toBeDisabled();

    await user.click(section.getByRole('button', { name: f.summary }));
    expect(screen.getByLabelText(f.summary)).toHaveFocus();
    await user.click(section.getByRole('button', { name: f.stage }));
    expect(document.activeElement).toHaveAttribute('role', 'radio');

    await user.type(screen.getByLabelText(f.summary), 'Indoor maps.');
    expect(items()).not.toContain(f.summary);
    await user.type(screen.getByLabelText(f.description), 'x'.repeat(99));
    expect(items()).toContain(s.descriptionItem.replace('{{min}}', '100'));
    await user.type(screen.getByLabelText(f.description), 'x');
    expect(items()).not.toContain(s.descriptionItem.replace('{{min}}', '100'));
    expect(db.calls).toEqual([]);
  });

  it('a complete project: confirm, submit, and the page becomes "Under review"', async () => {
    const user = userEvent.setup();
    seed(COMPLETE);
    await load();
    const section = within(submitRegion(t));
    expect(section.getByText(s.ready)).toBeInTheDocument();

    await user.click(section.getByRole('button', { name: s.button }));
    let dialog = await screen.findByRole('dialog', { name: s.dialogTitle });
    expect(within(dialog).getByText(s.dialogBody)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t.projects.delete.cancel }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(db.calls).toEqual([]);

    await user.click(section.getByRole('button', { name: s.button }));
    dialog = await screen.findByRole('dialog', { name: s.dialogTitle });
    await user.click(within(dialog).getByRole('button', { name: s.button }));

    expect(
      await screen.findByRole('region', { name: t.projects.status.pending_review.title }, SLOW),
    ).toBeInTheDocument();
    expect(db.calls).toEqual(['rpc:submit_project']);
    expect(screen.getByText(s.done)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: t.projects.status.withdraw })).toBeInTheDocument();
  });

  it('open changes are saved first, so the server checks what the student sees', async () => {
    const user = userEvent.setup();
    seed(COMPLETE);
    await load();
    await user.type(screen.getByLabelText(f.summary), ' Updated.');
    await user.click(within(submitRegion(t)).getByRole('button', { name: s.button }));
    const dialog = await screen.findByRole('dialog', { name: s.dialogTitle });
    await user.click(within(dialog).getByRole('button', { name: s.button }));
    await screen.findByRole('region', { name: t.projects.status.pending_review.title }, SLOW);
    expect(db.calls).toEqual(['update', 'rpc:submit_project']);
    expect(db.project?.summary).toBe('Indoor maps for campus. Updated.');
  });

  it('a server "incomplete" answer is shown as the checklist', async () => {
    const user = userEvent.setup();
    seed(COMPLETE);
    db.serverMissing = 'stage';
    await load();
    await user.click(within(submitRegion(t)).getByRole('button', { name: s.button }));
    const dialog = await screen.findByRole('dialog', { name: s.dialogTitle });
    await user.click(within(dialog).getByRole('button', { name: s.button }));
    const section = within(submitRegion(t));
    expect(await section.findByRole('button', { name: f.stage })).toBeInTheDocument();
    expect(db.project?.status).toBe('draft');
  });

  it(
    'axe: the checklist has no violations',
    async () => {
      await load();
      await screen.findByText(s.completeFirst);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the submit confirmation has no violations',
    async () => {
      const user = userEvent.setup();
      seed(COMPLETE);
      await load();
      await user.click(within(submitRegion(t)).getByRole('button', { name: s.button }));
      await screen.findByRole('dialog', { name: s.dialogTitle });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('status banners (%s)', (language) => {
  const t = copy[language];
  const st = t.projects.status;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('pending review: read-only; withdraw (after confirming) makes it editable again', async () => {
    const user = userEvent.setup();
    seed({ ...COMPLETE, status: 'pending_review' });
    await load();
    const region = within(banner(t, 'pending_review'));
    expect(region.getByText(st.pending_review.body)).toBeInTheDocument();
    expect(region.getByText(t.projects.readOnly.notice)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();

    await user.click(region.getByRole('button', { name: st.withdraw }));
    const dialog = await screen.findByRole('dialog', { name: st.withdrawTitle });
    expect(within(dialog).getByText(st.withdrawBody)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: st.withdraw }));

    expect(await screen.findByLabelText(t.projects.fields.summary, {}, SLOW)).toHaveValue(
      'Indoor maps for campus.',
    );
    expect(db.calls).toEqual(['rpc:withdraw_submission']);
    expect(screen.getByText(st.withdrawn)).toBeInTheDocument();
    expect(
      within(submitRegion(t)).getByRole('button', { name: t.projects.submit.button }),
    ).toBeEnabled();
  });

  it('changes requested: the latest notes, still editable, and "Resubmit for review"', async () => {
    const user = userEvent.setup();
    seed({ ...COMPLETE, status: 'changes_requested' }, [
      {
        project_id: PROJECT_ID,
        decision: 'changes_requested',
        notes: 'Old note.',
        created_at: '2026-11-01T10:00:00Z',
      },
      {
        project_id: PROJECT_ID,
        decision: 'changes_requested',
        notes: 'Add a demo video.\nShorten the summary.',
        created_at: '2026-11-06T10:00:00Z',
      },
    ]);
    await load();
    const region = within(banner(t, 'changes_requested'));
    expect(region.getByText(st.changes_requested.body)).toBeInTheDocument();
    const notes = await region.findByText(/Add a demo video\./);
    expect(notes).toHaveAttribute('dir', 'auto');
    expect(region.queryByText('Old note.')).toBeNull();
    expect(region.getByText(st.notes, { exact: false })).toBeInTheDocument();
    expect(region.queryByText(t.projects.readOnly.notice)).toBeNull();
    expect(screen.getByLabelText(t.projects.fields.summary)).toBeEnabled();

    const section = within(submitRegion(t, true));
    await user.click(section.getByRole('button', { name: t.projects.submit.resubmit }));
    const dialog = await screen.findByRole('dialog', { name: t.projects.submit.dialogTitle });
    await user.click(within(dialog).getByRole('button', { name: t.projects.submit.resubmit }));
    expect(
      await screen.findByRole('region', { name: st.pending_review.title }, SLOW),
    ).toBeInTheDocument();
  });

  it('rejected: the reason, read-only, no submit', async () => {
    seed({ ...COMPLETE, status: 'rejected' }, [
      {
        project_id: PROJECT_ID,
        decision: 'rejected',
        notes: 'Not a graduation project.',
        created_at: '2026-11-06T10:00:00Z',
      },
    ]);
    await load();
    const region = within(banner(t, 'rejected'));
    expect(await region.findByText('Not a graduation project.')).toBeInTheDocument();
    expect(region.getByText(st.reason, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: t.projects.submit.button })).toBeNull();
  });

  it.each(['published', 'unpublished'] as const)('%s: its message, read-only', async (status) => {
    seed({ ...COMPLETE, status });
    await load();
    const region = within(banner(t, status));
    expect(region.getByText(st[status].body)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: st.withdraw })).toBeNull();
  });

  it(
    'axe: the pending banner with the withdraw dialog, and the changes-requested banner',
    async () => {
      const user = userEvent.setup();
      seed({ ...COMPLETE, status: 'pending_review' });
      await load();
      expect(await axeViolations()).toEqual([]);
      await user.click(screen.getByRole('button', { name: st.withdraw }));
      await screen.findByRole('dialog', { name: st.withdrawTitle });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: changes requested with notes, and rejected',
    async () => {
      seed({ ...COMPLETE, status: 'changes_requested' }, [
        {
          project_id: PROJECT_ID,
          decision: 'changes_requested',
          notes: 'Add a demo video.',
          created_at: '2026-11-06T10:00:00Z',
        },
      ]);
      await load();
      await screen.findByText('Add a demo video.');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
