import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { changeLanguage, type Language } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { routes } from '@/test/routes';

const USER_ID = '00000000-0000-0000-0000-00000000000b';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const SLOW = { timeout: 5_000 };
/** A label that may be followed by details (hint, counter) in the accessible name. */
const starts = (label: string) => new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

type Row = Record<string, unknown>;
type Table = 'profiles' | 'organization_profiles' | 'mentor_profiles';
/** The three tables and the contact RPCs, in memory; every update and RPC is recorded. */
const db = vi.hoisted(() => ({
  profiles: new Map<string, Row>(),
  organization_profiles: new Map<string, Row>(),
  mentor_profiles: new Map<string, Row>(),
  contact: null as Row | null,
  updates: [] as { table: string; patch: Row }[],
  rpcs: [] as { name: string; args: Row | undefined }[],
}));

vi.mock('@/lib/supabase', () => {
  const session = {
    user: { id: '00000000-0000-0000-0000-00000000000b', email_confirmed_at: '2026-11-05' },
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
      },
      from: (name: Table) => ({
        select: () => ({
          eq: (_column: string, id: string) => {
            const read = () => Promise.resolve({ data: db[name].get(id) ?? null, error: null });
            return { single: read, maybeSingle: read };
          },
        }),
        update: (patch: Row) => ({
          eq: (_column: string, id: string) => ({
            select: () => {
              db.updates.push({ table: name, patch });
              const row = db[name].get(id);
              if (!row) return Promise.resolve({ data: [], error: null });
              db[name].set(id, { ...row, ...patch });
              return Promise.resolve({ data: [{ id }], error: null });
            },
          }),
        }),
      }),
      rpc: (name: string, args?: Row) => {
        db.rpcs.push({ name, args });
        if (name === 'get_my_contact') {
          return Promise.resolve({ data: db.contact ? [db.contact] : [], error: null });
        }
        db.contact = {
          phone: args?.p_phone,
          linkedin_url: args?.p_linkedin_url === '' ? null : args?.p_linkedin_url,
          share_phone: args?.p_share_phone,
          share_linkedin: args?.p_share_linkedin,
        };
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

function seed(role: 'organization' | 'mentor', onboarded = false) {
  db.updates = [];
  db.rpcs = [];
  db.contact = { phone: null, share_phone: false, linkedin_url: null, share_linkedin: false };
  db.profiles.set(USER_ID, {
    role,
    verification_status: 'pending',
    onboarding_completed: onboarded,
    full_name: role === 'organization' ? 'Huda Contact' : 'Majed',
  });
  db.organization_profiles.set(USER_ID, {
    organization_name: 'Clinic Co',
    sector: null,
    org_size: null,
    support_types: [],
    website: null,
    description: null,
  });
  db.mentor_profiles.set(USER_ID, {
    job_title: null,
    company: null,
    years_of_experience: null,
    expertise: [],
    professional_summary: null,
  });
}

async function load(path = '/onboarding') {
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

afterEach(async () => {
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each<Language>(['en', 'ar'])('organization and mentor onboarding (%s)', (language) => {
  const t = copy[language];
  const p = t.onboarding.partner;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('an organization must fill the required fields; nothing is saved until it does', async () => {
    seed('organization');
    const user = userEvent.setup();
    await load();
    await user.click(await screen.findByRole('button', { name: p.submit }, SLOW));
    expect(await screen.findByText(t.validation.chooseOne)).toBeInTheDocument();
    expect(screen.getAllByText(t.validation.required).length).toBeGreaterThan(0);
    expect(db.updates).toEqual([]);
    expect(db.rpcs.some((call) => call.name === 'update_my_contact')).toBe(false);
  });

  it('an organization submits: private contact, codes, then onboarding complete', async () => {
    seed('organization');
    const user = userEvent.setup();
    const router = await load();
    await screen.findByRole('button', { name: p.submit }, SLOW);
    await user.selectOptions(
      screen.getByRole('combobox', { name: p.organization.sector }),
      'healthcare',
    );
    await user.click(
      screen.getByRole('button', { name: t.forms.interest.options.looking_for.hire_talent }),
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(p.organization.description) }),
      'A clinic network looking for health-tech graduation projects.',
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(p.organization.website) }),
      'clinic.sa',
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(t.onboarding.about.phone) }),
      '0501112222',
    );
    await user.click(screen.getByRole('button', { name: p.submit }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    }, SLOW);
    expect(db.rpcs.find((call) => call.name === 'update_my_contact')?.args).toEqual({
      p_phone: '+966501112222',
      p_linkedin_url: '',
      p_share_phone: false,
      p_share_linkedin: false,
    });
    expect(db.updates).toEqual([
      {
        table: 'organization_profiles',
        patch: {
          organization_name: 'Clinic Co',
          sector: 'healthcare',
          org_size: null,
          support_types: ['hire_talent'],
          website: 'https://clinic.sa',
          description: 'A clinic network looking for health-tech graduation projects.',
        },
      },
      { table: 'profiles', patch: { full_name: 'Huda Contact', onboarding_completed: true } },
    ]);
  });

  it('a mentor: years must be a number; LinkedIn gets https:// added', async () => {
    seed('mentor');
    const user = userEvent.setup();
    const router = await load();
    await screen.findByRole('button', { name: p.submit }, SLOW);
    await user.type(screen.getByRole('textbox', { name: p.mentor.jobTitle }), 'Data Lead');
    await user.type(screen.getByRole('textbox', { name: p.mentor.company }), 'Data Co');
    await user.type(screen.getByRole('textbox', { name: p.mentor.years }), 'ten');
    await user.click(
      screen.getByRole('button', { name: t.forms.interest.options.expertise.software_data }),
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(p.mentor.description) }),
      'Nine years building data products; happy to mentor.',
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(t.onboarding.about.phone) }),
      '0503334444',
    );
    await user.type(
      screen.getByRole('textbox', { name: starts(p.linkedin) }),
      'linkedin.com/in/majed',
    );
    await user.click(screen.getByRole('button', { name: p.submit }));
    expect(await screen.findByText(t.validation.yearsOfExperience)).toBeInTheDocument();
    expect(db.updates).toEqual([]);

    const years = screen.getByRole('textbox', { name: p.mentor.years });
    await user.clear(years);
    await user.type(years, '9');
    await user.click(screen.getByRole('checkbox', { name: p.shareLinkedin }));
    await user.click(screen.getByRole('button', { name: p.submit }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    }, SLOW);
    expect(db.rpcs.find((call) => call.name === 'update_my_contact')?.args).toMatchObject({
      p_linkedin_url: 'https://linkedin.com/in/majed',
      p_share_linkedin: true,
    });
    expect(db.updates[0]).toEqual({
      table: 'mentor_profiles',
      patch: {
        job_title: 'Data Lead',
        company: 'Data Co',
        years_of_experience: 9,
        expertise: ['software_data'],
        professional_summary: 'Nine years building data products; happy to mentor.',
      },
    });
  });

  it('an onboarded organization edits its profile at /app/profile without re-completing', async () => {
    seed('organization', true);
    db.organization_profiles.set(USER_ID, {
      organization_name: 'Clinic Co',
      sector: 'healthcare',
      org_size: '51_500',
      support_types: ['hire_talent'],
      website: 'https://clinic.sa',
      description: 'A clinic network looking for health-tech graduation projects.',
    });
    db.contact = {
      phone: '+966501112222',
      share_phone: false,
      linkedin_url: null,
      share_linkedin: false,
    };
    const user = userEvent.setup();
    const router = await load('/app/profile');
    expect(await screen.findByRole('heading', { level: 1, name: p.editTitle })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: p.save }, SLOW));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    }, SLOW);
    expect(db.updates.at(-1)).toEqual({ table: 'profiles', patch: { full_name: 'Huda Contact' } });
  });

  it(
    'axe: the organization form has no violations',
    async () => {
      seed('organization');
      await load();
      await screen.findByRole('button', { name: p.submit }, SLOW);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
