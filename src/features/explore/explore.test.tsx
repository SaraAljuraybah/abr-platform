import type { Session } from '@supabase/supabase-js';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthState } from '@/features/auth/auth-context';
import { changeLanguage } from '@/lib/i18n';
import ar from '@/locales/ar.json';
import en from '@/locales/en.json';
import { axeViolations } from '@/test/axe';
import { renderRoute } from '@/test/render-route';

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const UNI_1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const UNI_2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const pid = (n: number) => `11111111-0000-4000-8000-${String(n).padStart(12, '0')}`;

type Row = Record<string, unknown>;
interface Query {
  table: string;
  filters: [op: string, column: string, value: unknown][];
  orders: [column: string, ascending: boolean][];
  range: [number, number] | null;
}

/**
 * In-memory tables behind the supabase-js calls the directory makes. Filters, sort, ranges and the
 * count run here, so the tests check both what the page asks for and what it then shows. RLS is
 * not emulated: that is the job of supabase/tests/database/120_project_directory.test.sql.
 */
const db = vi.hoisted(() => ({
  projects: [] as Row[],
  queries: [] as Query[],
  signBatches: [] as string[][],
  /** While set, project reads wait for it (the loading state). */
  gate: null as Promise<void> | null,
  fail: false,
}));

vi.mock('@/lib/supabase', () => {
  const get = (row: Row, path: string): unknown =>
    path.split('.').reduce<unknown>((value, key) => (value as Row | null)?.[key], row);

  /** Back from the quoted PostgREST value and the escaped LIKE pattern to the user's text. */
  const searchText = (filter: string) => {
    const match = /^title\.ilike\."(.*)",summary\.ilike\."(.*)"$/.exec(filter);
    const quoted = match?.[1] ?? '';
    const pattern = quoted.replace(/\\(["\\])/g, '$1').slice(1, -1);
    return pattern.replace(/\\([\\%_])/g, '$1').toLowerCase();
  };

  const matches = (row: Row, [op, column, value]: Query['filters'][number]) => {
    if (op === 'eq') return get(row, column) === value;
    if (op === 'overlaps') {
      const values = get(row, column) as string[];
      return (value as string[]).some((code) => values.includes(code));
    }
    if (op === 'or') {
      const text = searchText(String(value));
      return [row.title, row.summary].some(
        (field) => typeof field === 'string' && field.toLowerCase().includes(text),
      );
    }
    return false;
  };

  function select(table: string) {
    const q: Query = { table, filters: [], orders: [], range: null };
    if (table === 'projects') db.queries.push(q);
    const source = (): Row[] =>
      table === 'projects'
        ? db.projects
        : table === 'universities'
          ? [
              {
                id: UNI_1,
                name_en: 'Test University One',
                name_ar: 'جامعة الاختبار الأولى',
                active: true,
              },
              {
                id: UNI_2,
                name_en: 'Test University Two',
                name_ar: 'جامعة الاختبار الثانية',
                active: true,
              },
            ]
          : [];
    const run = async () => {
      if (table === 'projects' && db.gate) await db.gate;
      if (table === 'projects' && db.fail) {
        return { data: null, error: { message: 'boom' }, count: null };
      }
      if (table === 'profiles') return { data: [], error: null, count: 0 };
      const rows = source()
        .filter((row) => q.filters.every((filter) => matches(row, filter)))
        .sort((a, b) => {
          for (const [column, ascending] of q.orders) {
            const x = a[column] as string | number | null;
            const y = b[column] as string | number | null;
            if (x !== y) return ((x ?? '') < (y ?? '') ? -1 : 1) * (ascending ? 1 : -1);
          }
          return 0;
        });
      const data = q.range ? rows.slice(q.range[0], q.range[1] + 1) : rows;
      return { data, error: null, count: rows.length };
    };
    const builder = {
      eq: (column: string, value: unknown) => {
        q.filters.push(['eq', column, value]);
        return builder;
      },
      or: (filter: string) => {
        q.filters.push(['or', '', filter]);
        return builder;
      },
      overlaps: (column: string, value: string[]) => {
        q.filters.push(['overlaps', column, value]);
        return builder;
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        q.orders.push([column, options?.ascending ?? true]);
        return builder;
      },
      range: (from: number, to: number) => {
        q.range = [from, to];
        return run();
      },
      maybeSingle: async () => {
        const result = await run();
        return { ...result, data: result.data?.[0] ?? null };
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        run().then(resolve, reject),
    };
    return builder;
  }

  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signOut: () => Promise.resolve({ error: null }),
      },
      from: (table: string) => ({ select: () => select(table) }),
      storage: {
        from: (bucket: string) => ({
          createSignedUrls: (names: string[]) => {
            db.signBatches.push(names);
            return Promise.resolve({
              data: names.map((name) => ({
                path: name,
                signedUrl: `https://signed.test/${bucket}/${name}`,
                error: null,
              })),
              error: null,
            });
          },
          createSignedUrl: (name: string) =>
            Promise.resolve({
              data: { signedUrl: `https://signed.test/${bucket}/${name}` },
              error: null,
            }),
          info: () =>
            Promise.resolve({ data: { size: 2048, metadata: { name: 'Plan.pdf' } }, error: null }),
        }),
      },
    },
  };
});

function project(n: number, row: Row = {}): Row {
  const id = pid(n);
  return {
    id,
    status: 'published',
    title: `Project ${String(n).padStart(2, '0')}`,
    summary: 'A short summary.',
    description: 'A long enough description of what the team built and why it matters.',
    track: 'web',
    stage: 'prototype',
    sectors: ['education'],
    academic_year: '2026',
    team_size: 2,
    looking_for_members: false,
    wanted_specializations: [],
    needs: [],
    image_path: null,
    document_path: null,
    video_url: null,
    repo_url: null,
    demo_url: null,
    university_id: UNI_1,
    published_at: `2026-10-${String(n).padStart(2, '0')}T09:00:00Z`,
    owner: {
      full_name: 'Sara Aljuraybah',
      verification_status: 'verified',
      student: { major: 'cs', major_other: null },
    },
    university: { name_en: 'Test University One', name_ar: 'جامعة الاختبار الأولى' },
    ...row,
  };
}

function seed() {
  db.queries = [];
  db.signBatches = [];
  db.gate = null;
  db.fail = false;
  db.projects = [
    project(1, {
      title: 'Campus Navigator',
      summary: 'Indoor maps for 50% faster walks.',
      track: 'mobile',
      stage: 'mvp',
      sectors: ['education', 'smart_cities', 'ecommerce', 'fintech'],
      looking_for_members: true,
      wanted_specializations: ['design'],
      team_size: 4,
      needs: ['mentor', 'funding'],
      image_path: `${pid(1)}/image-aaaaaaaa-0000-4000-8000-000000000001.webp`,
    }),
    project(2, {
      title: 'منصة تعليمية',
      summary: 'منصة لتعلم البرمجة بالعربية.',
      track: 'ai',
      sectors: ['education'],
      needs: ['investor'],
      university_id: UNI_2,
      image_path: `${pid(2)}/image-aaaaaaaa-0000-4000-8000-000000000002.png`,
      owner: {
        full_name: 'Omar Student',
        verification_status: 'verified',
        student: { major: 'other', major_other: 'Bioinformatics' },
      },
    }),
    project(3, { title: 'Budget Buddy', track: 'web', stage: 'idea', sectors: ['fintech'] }),
    // Never in the directory: the explicit filters leave them out even where RLS shows them
    // (an owner's own draft, everything for an admin).
    project(4, { title: 'Secret draft', status: 'draft', published_at: null }),
    project(5, {
      title: 'Suspended owner project',
      owner: { full_name: 'Gone', verification_status: 'suspended', student: null },
    }),
  ];
}

const session = (id: string) =>
  ({ user: { id, email: 'ops.team@abr.test' } }) as unknown as Session;
const as = (
  role: AuthState['role'],
  verificationStatus: AuthState['verificationStatus'],
): AuthState => ({
  status: 'ready',
  session: session('00000000-0000-0000-0000-0000000000aa'),
  role,
  verificationStatus,
  onboarded: true,
});
const student = as('student', 'verified');

async function open(path: string, auth: AuthState = student) {
  const view = renderRoute(path, auth);
  await screen.findByRole('heading', { level: 1 });
  return view;
}
const cards = () => screen.queryAllByTestId('project-card');
const cardTitles = () =>
  cards().map((card) => within(card).getByRole('link', { hidden: true }).textContent);
/** The Filters button below lg (the one that opens the dialog). */
const dialogTrigger = (name: string) => {
  const button = screen
    .getAllByRole('button', { name })
    .find((element) => element.getAttribute('aria-haspopup') === 'dialog');
  if (!button) throw new Error('no Filters dialog button');
  return button;
};
const directoryQueries = () => db.queries.filter((q) => q.range !== null);
const lastQuery = () => {
  const list = directoryQueries();
  const last = list[list.length - 1];
  if (!last) throw new Error('no directory query was sent');
  return last;
};

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
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('projects directory (%s)', (language) => {
  const t = copy[language];
  const e = t.explore;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it.each([
    ['a verified student', student],
    ['a pending organization', as('organization', 'pending')],
    ['an admin', as('admin', 'verified')],
  ])('the shell links %s to Explore projects', async (_label, auth) => {
    await open('/app/profile', auth);
    const nav = screen.getAllByRole('navigation', { name: t.shell.nav })[0];
    if (!nav) throw new Error('no app navigation');
    expect(within(nav).getByRole('link', { name: t.shell.explore })).toHaveAttribute(
      'href',
      '/projects',
    );
    // No full name (a provisioned admin): initials from the email, never "?".
    expect(screen.getByRole('button', { name: t.shell.accountMenu })).toHaveTextContent('OT');
  });

  it.each([
    ['a pending organization', as('organization', 'pending')],
    ['an unverified student', as('student', 'unverified')],
    ['a rejected mentor', as('mentor', 'rejected')],
  ])('%s sees "available once verified" and no query is sent', async (_label, auth) => {
    await open('/projects', auth);
    expect(screen.getByRole('heading', { level: 1, name: e.title })).toBeInTheDocument();
    expect(screen.getByText(e.verificationRequired)).toBeInTheDocument();
    expect(cards()).toHaveLength(0);
    expect(db.queries).toHaveLength(0);
  });

  it('the project page also asks an unverified user to verify first, with no query', async () => {
    await open(`/projects/${pid(1)}`, as('organization', 'pending'));
    expect(screen.getByText(e.verificationRequired)).toBeInTheDocument();
    expect(screen.queryByText('Campus Navigator')).toBeNull();
    expect(db.queries).toHaveLength(0);
  });

  it('lists published projects of verified owners, newest first, with the count', async () => {
    await open('/projects');
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
    expect(cardTitles()).toEqual(['Budget Buddy', 'منصة تعليمية', 'Campus Navigator']);
    expect(screen.getByRole('status')).toHaveTextContent(e.results.replace('{{count}}', '3'));
    const q = lastQuery();
    expect(q.filters).toContainEqual(['eq', 'status', 'published']);
    expect(q.filters).toContainEqual(['eq', 'owner.verification_status', 'verified']);
    expect(q.orders).toEqual([
      ['published_at', false],
      ['id', false],
    ]);
    expect(q.range).toEqual([0, 23]);
  });

  it('an admin gets the same directory: drafts and suspended owners are filtered out', async () => {
    await open('/projects', as('admin', 'verified'));
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
    expect(cardTitles()).not.toContain('Secret draft');
    expect(cardTitles()).not.toContain('Suspended owner project');
  });

  it('card: one link named by the title, owner, team size and chips in order', async () => {
    await open('/projects');
    const card = await screen.findByRole('link', { name: 'Campus Navigator' });
    expect(card).toHaveAttribute('href', `/projects/${pid(1)}`);
    const article = card.closest('article');
    if (!article) throw new Error('no card');
    expect(within(article).getAllByRole('link')).toHaveLength(1);
    expect(within(article).getByText('Sara Aljuraybah')).toBeInTheDocument();
    expect(
      within(article).getByText(e.card.teamSize.replace('{{count}}', '4')),
    ).toBeInTheDocument();
    const chips = within(within(article).getByRole('list', { name: e.card.labels }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(chips).toEqual([
      t.projects.options.track.mobile,
      t.projects.options.stage.mvp,
      t.onboarding.options.interest.education,
      t.onboarding.options.interest.smart_cities,
      `+2${e.card.moreLabel.replace('{{count}}', '2')}`,
      e.card.lookingForMembers,
    ]);
  });

  it('images: one signed-URL batch per page, filling the frame but never cropped', async () => {
    await open('/projects');
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid="project-image-foreground"]')).toHaveLength(2);
    });
    expect(db.signBatches).toEqual([
      [
        `${pid(2)}/image-aaaaaaaa-0000-4000-8000-000000000002.png`,
        `${pid(1)}/image-aaaaaaaa-0000-4000-8000-000000000001.webp`,
      ],
    ]);
    for (const img of document.querySelectorAll('[data-testid="project-image-foreground"]')) {
      expect(img).toHaveClass('object-contain', 'size-full');
      expect(img.className).not.toMatch(/object-cover/);
      // The blurred cover copy behind it fills the frame and is hidden from assistive technology.
      const backdrop = img.parentElement?.querySelector('[data-testid="project-image-backdrop"]');
      expect(backdrop).toHaveClass('object-cover');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      // Decorative: the title link already names the card.
      expect(img).toHaveAttribute('alt', '');
    }
    // No image: the generated default.
    expect(screen.getAllByTestId('project-image-default')).toHaveLength(1);
  });

  it.each([
    ['English', 'navigator', 'Campus Navigator'],
    ['Arabic', 'تعليمية', 'منصة تعليمية'],
    ['a summary with %', '50%', 'Campus Navigator'],
  ])(
    'search (%s) filters by title or summary, debounced, into the URL',
    async (_l, text, title) => {
      const user = userEvent.setup();
      const { router } = await open('/projects');
      await waitFor(() => {
        expect(cards()).toHaveLength(3);
      });
      await user.type(screen.getByRole('searchbox', { name: e.search }), text);
      await waitFor(() => {
        expect(cardTitles()).toEqual([title]);
      });
      expect(new URLSearchParams(router.state.location.search).get('q')).toBe(text);
      expect(screen.getByRole('status')).toHaveTextContent(e.results.replace('{{count}}', '1'));
      // Debounced: one query for the whole text, not one per key.
      const searches = directoryQueries().filter((q) => q.filters.some(([op]) => op === 'or'));
      expect(searches).toHaveLength(1);
    },
  );

  it.each([
    [
      'track',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.selectOptions(screen.getByRole('combobox', { name: e.filter.track }), 'ai'),
      ['eq', 'track', 'ai'],
      ['منصة تعليمية'],
    ],
    [
      'stage',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.selectOptions(screen.getByRole('combobox', { name: e.filter.stage }), 'idea'),
      ['eq', 'stage', 'idea'],
      ['Budget Buddy'],
    ],
    [
      'university',
      async (u: ReturnType<typeof userEvent.setup>) => {
        // The university list loads with the filters.
        await screen.findByRole('option', {
          name: language === 'ar' ? 'جامعة الاختبار الثانية' : 'Test University Two',
        });
        await u.selectOptions(screen.getByRole('combobox', { name: e.filter.university }), UNI_2);
      },
      ['eq', 'university_id', UNI_2],
      ['منصة تعليمية'],
    ],
    [
      'sector',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.click(screen.getByRole('checkbox', { name: t.onboarding.options.interest.fintech })),
      ['overlaps', 'sectors', ['fintech']],
      ['Budget Buddy', 'Campus Navigator'],
    ],
    [
      'need',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.click(screen.getByRole('checkbox', { name: t.projects.options.need.investor })),
      ['overlaps', 'needs', ['investor']],
      ['منصة تعليمية'],
    ],
    [
      'looking for members',
      (u: ReturnType<typeof userEvent.setup>) =>
        u.click(screen.getByRole('checkbox', { name: e.filter.lookingForMembers })),
      ['eq', 'looking_for_members', true],
      ['Campus Navigator'],
    ],
  ] as const)('filter: %s (in the Filters dialog)', async (_name, act, filter, titles) => {
    const user = userEvent.setup();
    const { router } = await open('/projects');
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
    await user.click(dialogTrigger(e.filters));
    const dialog = await screen.findByRole('dialog', { name: e.filters });
    expect(dialog).toBeInTheDocument();
    await act(user);
    await waitFor(() => {
      expect(cardTitles()).toEqual(titles);
    });
    expect(lastQuery().filters).toContainEqual(filter);
    expect(router.state.location.search).not.toBe('');
    await user.click(within(dialog).getByRole('button', { name: e.showResults }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // The trigger now says how many filters are on.
    expect(
      screen.getAllByRole('button', { name: e.filtersCount.replace('{{count}}', '1') }).length,
    ).toBeGreaterThan(0);
  });

  it('sort: title A–Z', async () => {
    const user = userEvent.setup();
    const { router } = await open('/projects');
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
    await user.selectOptions(screen.getByRole('combobox', { name: e.sort }), 'title');
    await waitFor(() => {
      expect(cardTitles()).toEqual(['Budget Buddy', 'Campus Navigator', 'منصة تعليمية']);
    });
    expect(lastQuery().orders).toEqual([
      ['title', true],
      ['id', true],
    ]);
    expect(router.state.location.search).toBe('?sort=title');
  });

  it('URL state: a shared link opens with its search, filters and sort applied', async () => {
    await open(`/projects?q=campus&sector=fintech&members=1&sort=title`);
    await waitFor(() => {
      expect(cardTitles()).toEqual(['Campus Navigator']);
    });
    expect(screen.getByRole('searchbox', { name: e.search })).toHaveValue('campus');
    expect(screen.getByRole('combobox', { name: e.sort })).toHaveValue('title');
    const q = lastQuery();
    expect(q.filters).toContainEqual(['overlaps', 'sectors', ['fintech']]);
    expect(q.filters).toContainEqual(['eq', 'looking_for_members', true]);
    // Filters are on: the panel starts open, with the checked boxes.
    const panel = screen.getByRole('region', { name: e.filters });
    expect(
      within(panel).getByRole('checkbox', { name: t.onboarding.options.interest.fintech }),
    ).toBeChecked();
  });

  it('load more: 24 per page, then the rest, then no button', async () => {
    db.projects = Array.from({ length: 30 }, (_, i) => project(i + 1));
    const user = userEvent.setup();
    await open('/projects');
    await waitFor(() => {
      expect(cards()).toHaveLength(24);
    });
    expect(screen.getByRole('status')).toHaveTextContent(e.results.replace('{{count}}', '30'));
    await user.click(screen.getByRole('button', { name: e.loadMore }));
    await waitFor(() => {
      expect(cards()).toHaveLength(30);
    });
    expect(directoryQueries().map((q) => q.range)).toEqual([
      [0, 23],
      [24, 47],
    ]);
    expect(screen.queryByRole('button', { name: e.loadMore })).toBeNull();
    expect(new Set(cardTitles()).size).toBe(30);
  });

  it('empty: no match says so, and "Clear filters" brings everything back', async () => {
    const user = userEvent.setup();
    const { router } = await open('/projects?q=nothing-like-this&track=games');
    expect(await screen.findByText(e.empty)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(e.results.replace('{{count}}', '0'));
    const buttons = screen.getAllByRole('button', { name: e.clearFilters });
    const last = buttons[buttons.length - 1];
    if (!last) throw new Error('no clear button');
    await user.click(last);
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('searchbox', { name: e.search })).toHaveValue('');
  });

  it('empty directory: nothing published yet', async () => {
    db.projects = [];
    await open('/projects');
    expect(await screen.findByText(e.emptyNone)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: e.clearFilters })).toBeNull();
  });

  it('loading: skeleton cards and "Loading projects…", then the cards', async () => {
    let release: () => void = () => undefined;
    db.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await open('/projects');
    expect(screen.getByRole('status')).toHaveTextContent(e.loading);
    expect(cards()).toHaveLength(0);
    release();
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
  });

  it('error: plain-language message and retry', async () => {
    db.fail = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const user = userEvent.setup();
    await open('/projects');
    expect(await screen.findByText(e.loadError)).toBeInTheDocument();
    db.fail = false;
    await user.click(screen.getByRole('button', { name: t.projects.retry }));
    await waitFor(() => {
      expect(cards()).toHaveLength(3);
    });
  });

  it(
    'has no axe violations (directory)',
    async () => {
      await open('/projects?sector=education');
      await waitFor(() => {
        expect(cards()).toHaveLength(2);
      });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  describe('project page', () => {
    it('shows the project, the owner card and the connect placeholder', async () => {
      await open(`/projects/${pid(2)}`);
      expect(
        await screen.findByRole('heading', { level: 1, name: 'منصة تعليمية' }),
      ).toBeInTheDocument();
      const owner = screen.getByRole('region', { name: e.project.ownerTitle });
      expect(within(owner).getByText('Omar Student')).toBeInTheDocument();
      expect(
        within(owner).getByText(
          language === 'ar' ? 'جامعة الاختبار الأولى' : 'Test University One',
        ),
      ).toBeInTheDocument();
      expect(within(owner).getByText('Bioinformatics')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: e.project.connectTitle })).toHaveTextContent(
        e.project.connectBody,
      );
      expect(screen.getByRole('link', { name: e.project.back })).toHaveAttribute(
        'href',
        '/projects',
      );
      const q = lastQueryAny();
      expect(q.filters).toContainEqual(['eq', 'id', pid(2)]);
      expect(q.filters).toContainEqual(['eq', 'status', 'published']);
      expect(q.filters).toContainEqual(['eq', 'owner.verification_status', 'verified']);
    });

    it('field of study by its label; the image whole', async () => {
      await open(`/projects/${pid(1)}`);
      const owner = await screen.findByRole('region', { name: e.project.ownerTitle });
      expect(
        within(owner).getByText(t.forms.interest.options.field_of_study.cs),
      ).toBeInTheDocument();
      const img = await screen.findByRole('img', {
        name: t.projects.media.imageAlt.replace('{{title}}', 'Campus Navigator'),
      });
      expect(img).toHaveClass('object-contain');
    });

    it('a card opens its page, and "Back to projects" returns to the same results', async () => {
      const user = userEvent.setup();
      const { router } = await open('/projects?sort=title');
      await user.click(await screen.findByRole('link', { name: 'Budget Buddy' }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Budget Buddy' })).toBeVisible();
      await user.click(screen.getByRole('link', { name: e.project.back }));
      await waitFor(() => {
        expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
          '/projects?sort=title',
        );
      });
    });

    it.each([
      ['a draft', pid(4)],
      ['a suspended owner', pid(5)],
      ['a missing project', pid(99)],
      ['a malformed id', 'not-a-uuid'],
    ])('%s gives the same "not found"', async (_label, id) => {
      await open(`/projects/${id}`);
      expect(
        await screen.findByRole('heading', { level: 1, name: t.projects.notFound.title }),
      ).toBeInTheDocument();
      expect(screen.getByText(t.projects.notFound.body)).toBeInTheDocument();
    });

    it(
      'has no axe violations (project page)',
      async () => {
        await open(`/projects/${pid(1)}`);
        await screen.findByRole('region', { name: e.project.ownerTitle });
        expect(await axeViolations()).toEqual([]);
      },
      AXE_TIMEOUT,
    );
  });
});

function lastQueryAny(): Query {
  const last = db.queries[db.queries.length - 1];
  if (!last) throw new Error('no query was sent');
  return last;
}
