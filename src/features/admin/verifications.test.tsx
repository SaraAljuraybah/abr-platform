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

const copy = { en, ar } as const;
const SLOW = { timeout: 5_000 };
const AXE_TIMEOUT = 60_000;
type Row = Record<string, unknown>;

/** In-memory verification queue, universities and the admin RPCs the two pages call. */
const db = vi.hoisted(() => ({
  queue: [] as Row[],
  universities: [] as Row[],
  rpcs: [] as { name: string; args: Row | undefined }[],
  /** The next admin_add_university_domain call fails with this Postgres code. */
  addError: null as string | null,
}));

vi.mock('@/lib/supabase', () => {
  const ADMIN = '00000000-0000-0000-0000-0000000000ad';
  const session = { user: { id: ADMIN, email_confirmed_at: '2026-11-01' } };
  const profile = {
    id: ADMIN,
    role: 'admin',
    verification_status: 'verified',
    onboarding_completed: true,
    full_name: 'Admin X',
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: (name: string) => ({
        select: () =>
          name === 'universities'
            ? Promise.resolve({ data: db.universities, error: null })
            : {
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: profile, error: null }),
                  single: () => Promise.resolve({ data: profile, error: null }),
                }),
              },
      }),
      rpc: (name: string, args?: Row) => {
        db.rpcs.push({ name, args });
        if (name === 'admin_verification_queue') {
          return Promise.resolve({
            data: db.queue.filter((row) => row.verification_status === args?.p_status),
            error: null,
          });
        }
        if (name === 'review_verification') {
          const row = db.queue.find((r) => r.id === args?.p_subject_id);
          if (row)
            row.verification_status = args?.p_decision === 'approved' ? 'verified' : 'rejected';
          return Promise.resolve({ data: 'review-1', error: null });
        }
        if (name === 'admin_add_university_domain') {
          const code = db.addError;
          db.addError = null;
          if (code) return Promise.resolve({ data: null, error: { code, message: 'x' } });
          const uni = db.universities.find((u) => u.id === args?.p_university_id);
          (uni?.domains as Row[] | undefined)?.push({
            id: 'new',
            domain: String(args?.p_domain).trim().toLowerCase(),
            active: true,
          });
          return Promise.resolve({ data: 'new', error: null });
        }
        if (name === 'admin_set_university_domain_active') {
          for (const uni of db.universities) {
            for (const d of uni.domains as Row[]) {
              if (d.id === args?.p_domain_id) d.active = args?.p_active;
            }
          }
          return Promise.resolve({ data: null, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'unknown rpc' } });
      },
    },
  };
});

function seed() {
  db.rpcs = [];
  db.addError = null;
  db.queue = [
    {
      id: 'org-1',
      role: 'organization',
      verification_status: 'pending',
      onboarding_completed: true,
      full_name: 'Huda Contact',
      email: 'hr@clinic.test',
      updated_at: '2026-11-20T09:00:00Z',
      organization_name: 'Clinic Co',
      sector: 'healthcare',
      org_size: '51_500',
      description: 'A clinic network looking for health-tech graduation projects.',
      website: 'https://clinic.test',
      support_types: ['hire_talent'],
      job_title: null,
      company: null,
      expertise: [],
      years_of_experience: null,
      professional_summary: null,
    },
    {
      id: 'mentor-1',
      role: 'mentor',
      verification_status: 'pending',
      onboarding_completed: true,
      full_name: 'Majed Mentor',
      email: 'majed@data.test',
      updated_at: '2026-11-21T09:00:00Z',
      organization_name: null,
      sector: null,
      org_size: null,
      description: null,
      website: null,
      support_types: [],
      job_title: 'Data Lead',
      company: 'Data Co',
      expertise: ['software_data'],
      years_of_experience: 9,
      professional_summary: 'Nine years building data products.',
    },
  ];
  db.universities = [
    {
      id: 'u-tu',
      name_ar: 'جامعة الطائف',
      name_en: 'Taif University',
      kind: 'public',
      active: true,
      domains: [{ id: 'd-tu', domain: 'tu.edu.sa', active: true }],
    },
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
  return router;
}

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

describe.each<Language>(['en', 'ar'])('admin verifications and universities (%s)', (language) => {
  const t = copy[language];
  const v = t.admin.verifications;
  const u = t.admin.universities;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('lists pending organizations and mentors with their sign-up email and profile', async () => {
    await load('/admin/verifications');
    const org = await screen.findByRole('article', { name: 'Clinic Co' }, SLOW);
    expect(org).toHaveTextContent('hr@clinic.test');
    expect(org).toHaveTextContent(t.forms.interest.options.sector.healthcare);
    expect(org).toHaveTextContent(t.forms.interest.options.looking_for.hire_talent);
    const mentor = screen.getByRole('article', { name: 'Majed Mentor' });
    expect(mentor).toHaveTextContent('Data Lead');
    expect(mentor).toHaveTextContent(t.forms.interest.options.expertise.software_data);
    expect(db.rpcs[0]).toEqual({ name: 'admin_verification_queue', args: { p_status: 'pending' } });
  });

  it('approving asks for confirmation, then calls review_verification', async () => {
    const user = userEvent.setup();
    await load('/admin/verifications');
    const org = await screen.findByRole('article', { name: 'Clinic Co' }, SLOW);
    await user.click(within(org).getByRole('button', { name: v.approve }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: v.dialog.approved.confirm }));
    await waitFor(() => {
      expect(db.rpcs.find((r) => r.name === 'review_verification')?.args).toEqual({
        p_subject_id: 'org-1',
        p_decision: 'approved',
        p_reason: undefined,
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('article', { name: 'Clinic Co' })).toBeNull();
    });
  });

  it('rejecting needs a reason before anything is sent', async () => {
    const user = userEvent.setup();
    await load('/admin/verifications');
    const mentor = await screen.findByRole('article', { name: 'Majed Mentor' }, SLOW);
    await user.click(within(mentor).getByRole('button', { name: v.reject }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: v.dialog.rejected.confirm }));
    expect(within(dialog).getByText(v.reasonRequired)).toBeInTheDocument();
    expect(db.rpcs.some((r) => r.name === 'review_verification')).toBe(false);
    await user.type(within(dialog).getByRole('textbox', { name: v.reason }), 'Add your website.');
    await user.click(within(dialog).getByRole('button', { name: v.dialog.rejected.confirm }));
    await waitFor(() => {
      expect(db.rpcs.find((r) => r.name === 'review_verification')?.args).toEqual({
        p_subject_id: 'mentor-1',
        p_decision: 'rejected',
        p_reason: 'Add your website.',
      });
    });
  });

  it('an empty queue says so', async () => {
    db.queue = [];
    await load('/admin/verifications');
    expect(await screen.findByText(v.emptyPending, {}, SLOW)).toBeInTheDocument();
  });

  it('adds a student domain and reports a taken one', async () => {
    const user = userEvent.setup();
    await load('/admin/universities');
    await screen.findByText('tu.edu.sa', {}, SLOW);
    await user.selectOptions(screen.getByRole('combobox', { name: u.university }), 'u-tu');
    db.addError = '23505';
    await user.type(screen.getByRole('textbox', { name: new RegExp(u.domain) }), 'tu.edu.sa');
    await user.click(screen.getByRole('button', { name: u.add }));
    expect(await screen.findByText(u.errors.taken)).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: new RegExp(u.domain) });
    await user.clear(field);
    await user.type(field, 'students.tu.edu.sa');
    await user.click(screen.getByRole('button', { name: u.add }));
    expect(await screen.findByText('students.tu.edu.sa')).toBeInTheDocument();
  });

  it('turns a domain off with a labelled button', async () => {
    const user = userEvent.setup();
    await load('/admin/universities');
    await screen.findByText('tu.edu.sa', {}, SLOW);
    await user.click(
      screen.getByRole('button', { name: u.disableLabel.replace('{{domain}}', 'tu.edu.sa') }),
    );
    await waitFor(() => {
      expect(db.rpcs.find((r) => r.name === 'admin_set_university_domain_active')?.args).toEqual({
        p_domain_id: 'd-tu',
        p_active: false,
      });
    });
  });

  it(
    'axe: the verification queue has no violations',
    async () => {
      await load('/admin/verifications');
      await screen.findByRole('article', { name: 'Clinic Co' }, SLOW);
      expect(await axeViolations(document.body)).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the universities page has no violations',
    async () => {
      await load('/admin/universities');
      await screen.findByText('tu.edu.sa', {}, SLOW);
      expect(await axeViolations(document.body)).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
