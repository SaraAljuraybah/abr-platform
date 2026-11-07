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
import type * as StorageModule from './storage';

const USER_ID = '00000000-0000-0000-0000-00000000000a';
const PROJECT_ID = '11111111-2222-4333-8444-555555555555';
const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const SLOW = { timeout: 5_000 };
const IMAGE = `${PROJECT_ID}/image-aaaaaaaa-0000-4000-8000-000000000001.webp`;
const DOCUMENT = `${PROJECT_ID}/document-aaaaaaaa-0000-4000-8000-000000000002.pdf`;

type Row = Record<string, unknown>;
/**
 * In-memory tables, storage objects and RPCs behind the supabase-js calls the app makes. Every
 * write is recorded in `calls`, in order, so the tests can check the sequence of steps.
 */
const db = vi.hoisted(() => ({
  profiles: new Map<string, Row>(),
  student_profiles: new Map<string, Row>(),
  projects: new Map<string, Row>(),
  objects: new Set<string>(),
  calls: [] as string[],
  updates: [] as Row[],
  /** Makes the next project update affect no rows (what RLS does once it is not editable). */
  failNextUpdate: false,
  failRemove: false,
  failRpc: false,
  /** An upload error kind, or 'hold' to keep the upload pending until release(). */
  upload: null as null | 'hold' | 'network' | 'tooLarge',
  release: null as null | (() => void),
  /** What the fake re-encoder produces for the next image: dimensions and byte count. */
  encoded: { width: 1080, height: 1080, bytes: 240 * 1024 },
  /** Object URLs handed out for previews, and the ones revoked. */
  objectUrls: [] as string[],
  revoked: [] as string[],
}));

vi.mock('@/lib/supabase', () => {
  const USER = '00000000-0000-0000-0000-00000000000a';
  const session = { user: { id: USER, email_confirmed_at: '2026-11-05' } };
  const visible = (name: string): Row[] =>
    name === 'projects'
      ? [...db.projects.values()].filter((row) => row.owner_id === USER)
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
              db.calls.push(`update:${Object.keys(patch).sort().join(',')}`);
              db.updates.push(patch);
              const row = db.projects.get(id);
              const fail = db.failNextUpdate;
              db.failNextUpdate = false;
              if (!row || fail || (row.status !== 'draft' && row.status !== 'changes_requested')) {
                return Promise.resolve({ data: [], error: null });
              }
              db.projects.set(id, { ...row, ...patch });
              return Promise.resolve({ data: [{ id }], error: null });
            },
          }),
        }),
      }),
      storage: {
        from: (bucket: string) => ({
          createSignedUrl: (name: string) =>
            Promise.resolve({
              data: { signedUrl: `https://signed.test/${bucket}/${name}` },
              error: null,
            }),
          info: () =>
            Promise.resolve({
              data: { size: 1572864, metadata: { name: 'Pitch deck.pdf' } },
              error: null,
            }),
          list: (folder: string) =>
            Promise.resolve({
              data: [...db.objects]
                .filter((key) => key.startsWith(`${bucket}:${folder}/`))
                .map((key) => ({ name: key.slice(`${bucket}:${folder}/`.length) })),
              error: null,
            }),
          remove: (names: string[]) => {
            db.calls.push(`remove:${bucket}:${String(names.length)}`);
            if (db.failRemove) return Promise.resolve({ data: null, error: { message: 'boom' } });
            for (const name of names) db.objects.delete(`${bucket}:${name}`);
            return Promise.resolve({ data: [], error: null });
          },
        }),
      },
      rpc: (name: string, args: Row) => {
        db.calls.push(`rpc:${name}`);
        if (db.failRpc) return Promise.resolve({ data: null, error: { message: 'boom' } });
        db.projects.delete(String(args.p_project_id));
        return Promise.resolve({ data: null, error: null });
      },
    },
  };
});

// The real file checks and the XHR upload are unit-tested in storage.test.ts (Node, real bytes);
// here they are replaced by fakes with the same type and size rules and a controllable upload.
vi.mock('@/features/projects/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof StorageModule>();
  const { PROJECT_FILES } = await import('./options');
  return {
    ...actual,
    prepareFile: (kind: 'image' | 'document', file: File) => {
      const rules = PROJECT_FILES[kind];
      if (!(rules.types as readonly string[]).includes(file.type)) {
        return Promise.reject(new actual.UploadFailure('wrongType'));
      }
      if (file.size > rules.maxBytes) return Promise.reject(new actual.UploadFailure('tooLarge'));
      if (kind === 'document') {
        return Promise.resolve({
          blob: file,
          contentType: file.type,
          extension: 'pdf',
          originalName: file.name,
        });
      }
      // The re-encoded image: a new blob with its own size and dimensions, never the original.
      const { width, height, bytes } = db.encoded;
      return Promise.resolve({
        blob: new Blob([new Uint8Array(bytes)], { type: 'image/webp' }),
        contentType: 'image/webp',
        extension: 'webp',
        originalName: file.name,
        width,
        height,
      });
    },
    uploadObject: async (
      kind: 'image' | 'document',
      name: string,
      _file: unknown,
      onProgress: (percent: number) => void,
    ) => {
      db.calls.push(`upload:${kind}`);
      onProgress(40);
      const mode = db.upload;
      if (mode === 'hold') {
        await new Promise<void>((resolve) => {
          db.release = resolve;
        });
      } else if (mode) {
        throw new actual.UploadFailure(mode);
      }
      db.objects.add(`${PROJECT_FILES[kind].bucket}:${name}`);
      onProgress(100);
    },
  };
});

function project(row: Row = {}): Row {
  return {
    id: PROJECT_ID,
    owner_id: USER_ID,
    status: 'draft',
    title: 'Campus Navigator',
    summary: null,
    description: null,
    track: 'mobile',
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

function seed(row: Row = {}) {
  db.profiles.clear();
  db.student_profiles.clear();
  db.projects.clear();
  db.objects.clear();
  db.calls = [];
  db.updates = [];
  db.failNextUpdate = false;
  db.failRemove = false;
  db.failRpc = false;
  db.upload = null;
  db.release = null;
  db.encoded = { width: 1080, height: 1080, bytes: 240 * 1024 };
  db.objectUrls = [];
  db.revoked = [];
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
  const p = project(row);
  db.projects.set(PROJECT_ID, p);
  if (typeof p.image_path === 'string') db.objects.add(`project-images:${p.image_path}`);
  if (typeof p.document_path === 'string') {
    db.objects.add(`project-documents:${p.document_path}`);
  }
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
const region = (t: Copy, key: keyof Copy['projects']['sections']) =>
  screen.getByRole('region', { name: t.projects.sections[key] });
const fileInput = (label: string) => {
  const input = document.querySelector<HTMLInputElement>(
    `input[type="file"][aria-label="${label}"]`,
  );
  if (!input) throw new Error(`no file input for ${label}`);
  return input;
};
const pngFile = () => new File(['png-bytes'], 'logo.png', { type: 'image/png' });
const pdfFile = () => new File(['%PDF-1.7'], 'Pitch deck.pdf', { type: 'application/pdf' });

beforeAll(() => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  });
  // jsdom has no object URLs; the preview shows the re-encoded blob through one.
  Object.assign(URL, {
    createObjectURL: () => {
      const url = `blob:preview-${String(db.objectUrls.length + 1)}`;
      db.objectUrls.push(url);
      return url;
    },
    revokeObjectURL: (url: string) => {
      db.revoked.push(url);
    },
  });
});

beforeEach(() => {
  seed();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await changeLanguage('en');
});

describe.each(['en', 'ar'] as const)('edit page sections (%s)', (language) => {
  const t = copy[language];
  const p = t.projects;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('six sections (the last one submits), one Save', async () => {
    await load();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      p.sections.basics,
      p.sections.stageTeam,
      p.sections.needs,
      p.sections.media,
      p.sections.links,
      p.submit.title,
    ]);
    expect(screen.getAllByRole('button', { name: p.save.button })).toHaveLength(1);
  });

  it('stage & team: stage, team size, and specializations only while looking for members', async () => {
    const user = userEvent.setup();
    await load();
    const section = within(region(t, 'stageTeam'));
    await user.click(section.getByRole('radio', { name: p.options.stage.mvp }));

    const decrease = section.getByRole('button', {
      name: p.fields.teamSize
        ? t.numberStepper.decrease.replace('{{label}}', p.fields.teamSize)
        : '',
    });
    const increase = section.getByRole('button', {
      name: t.numberStepper.increase.replace('{{label}}', p.fields.teamSize),
    });
    expect(decrease).toBeDisabled();
    await user.click(increase);
    await user.click(increase);
    expect(section.getByRole('spinbutton', { name: p.fields.teamSize })).toHaveValue(3);
    expect(section.getByText(p.fields.teamSizeHint)).toBeInTheDocument();

    expect(section.queryByRole('group', { name: p.fields.wantedSpecializations })).toBeNull();
    const looking = section.getByRole('checkbox', { name: p.fields.lookingForMembers });
    await user.click(looking);
    const chips = within(section.getByRole('group', { name: p.fields.wantedSpecializations }));
    // Tech codes keep their field-of-study names.
    await user.click(
      chips.getByRole('button', { name: t.forms.interest.options.field_of_study.ai }),
    );
    await user.click(chips.getByRole('button', { name: p.options.specialization.design }));
    await user.click(looking);
    expect(section.queryByRole('group', { name: p.fields.wantedSpecializations })).toBeNull();
    await user.click(looking);
    expect(
      within(section.getByRole('group', { name: p.fields.wantedSpecializations }))
        .getAllByRole('button')
        .filter((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toEqual([]);
    await user.click(
      within(section.getByRole('group', { name: p.fields.wantedSpecializations })).getByRole(
        'button',
        { name: p.options.specialization.business },
      ),
    );

    await user.click(screen.getByRole('button', { name: p.save.button }));
    expect(await screen.findByText(p.save.saved)).toBeInTheDocument();
    expect(db.updates.at(-1)).toMatchObject({
      stage: 'mvp',
      team_size: 3,
      looking_for_members: true,
      wanted_specializations: ['business'],
    });
    expect(db.updates.at(-1)).not.toHaveProperty('image_path');
  });

  it('team size stops at 10', async () => {
    const user = userEvent.setup();
    seed({ team_size: 9 });
    await load();
    const section = within(region(t, 'stageTeam'));
    const increase = section.getByRole('button', {
      name: t.numberStepper.increase.replace('{{label}}', p.fields.teamSize),
    });
    await user.click(increase);
    expect(increase).toBeDisabled();
    expect(section.getByRole('spinbutton', { name: p.fields.teamSize })).toHaveValue(10);
  });

  it('needs: chips in list order, saved with the form', async () => {
    const user = userEvent.setup();
    await load();
    const section = within(region(t, 'needs'));
    expect(section.getByText(p.fields.needsHint)).toBeInTheDocument();
    await user.click(section.getByRole('button', { name: p.options.need.tech_partner }));
    await user.click(section.getByRole('button', { name: p.options.need.funding }));
    await user.click(screen.getByRole('button', { name: p.save.button }));
    await screen.findByText(p.save.saved);
    expect(db.updates.at(-1)?.needs).toEqual(['funding', 'tech_partner']);
  });

  it('links: each field has a format hint and is checked like the database', async () => {
    const user = userEvent.setup();
    await load();
    const section = within(region(t, 'links'));
    const video = section.getByLabelText(p.fields.videoUrl);
    const repo = section.getByLabelText(p.fields.repoUrl);
    const demo = section.getByLabelText(p.fields.demoUrl);
    for (const field of [video, repo, demo]) expect(field).toHaveAttribute('dir', 'ltr');
    expect(video).toHaveAccessibleDescription(expect.stringContaining(p.fields.videoUrlHint));

    await user.type(video, 'https://evil.example/watch');
    await user.type(repo, 'https://bitbucket.org/team/p');
    await user.type(demo, 'http://demo.example.com');
    await user.click(screen.getByRole('button', { name: p.save.button }));
    await waitFor(() => {
      expect(video).toHaveAccessibleDescription(expect.stringContaining(t.validation.videoUrl));
    });
    expect(repo).toHaveAccessibleDescription(expect.stringContaining(t.validation.repoUrl));
    expect(demo).toHaveAccessibleDescription(expect.stringContaining(t.validation.demoUrl));
    expect(db.updates).toEqual([]);

    await user.clear(video);
    await user.type(video, 'https://youtu.be/abc');
    await user.clear(repo);
    await user.type(repo, 'https://github.com/team/project');
    await user.clear(demo);
    await user.type(demo, 'https://demo.example.com');
    await user.click(screen.getByRole('button', { name: p.save.button }));
    await screen.findByText(p.save.saved);
    expect(db.updates.at(-1)).toMatchObject({
      video_url: 'https://youtu.be/abc',
      repo_url: 'https://github.com/team/project',
      demo_url: 'https://demo.example.com',
    });
  });

  it(
    'axe: every section, with link errors, has no violations',
    async () => {
      const user = userEvent.setup();
      await load();
      expect(await axeViolations()).toEqual([]);
      await user.click(
        within(region(t, 'stageTeam')).getByRole('checkbox', { name: p.fields.lookingForMembers }),
      );
      await user.type(within(region(t, 'links')).getByLabelText(p.fields.repoUrl), 'x');
      await user.click(screen.getByRole('button', { name: p.save.button }));
      await screen.findByText(t.validation.repoUrl);
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe.each(['en', 'ar'] as const)('media (%s)', (language) => {
  const t = copy[language];
  const m = t.projects.media;
  const alt = m.imageAlt.replace('{{title}}', 'Campus Navigator');
  const previewDialog = () => screen.findByRole('dialog', { name: m.previewTitle });
  const sizeLine = (width: number, height: number, kb: number) =>
    m.previewSize
      .replace('{{width}}', String(width))
      .replace('{{height}}', String(height))
      .replace('{{size}}', m.sizeKb.replace('{{value}}', String(kb)));

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('no image: the branded default with the title letter and the track icon', async () => {
    await load();
    const media = region(t, 'media');
    const fallback = within(media).getByTestId('project-image-default');
    expect(fallback).toHaveAttribute('aria-hidden', 'true');
    expect(fallback).toHaveTextContent('C');
    expect(fallback.querySelector('[data-track="mobile"]')).not.toBeNull();
    expect(within(media).getByText(m.imageHint)).toBeInTheDocument();
    expect(within(media).queryByRole('button', { name: m.removeImage })).toBeNull();
  });

  it('picking an image opens the preview of the re-encoded result; nothing is sent yet', async () => {
    const user = userEvent.setup();
    await load();
    await user.upload(fileInput(m.image), pngFile());
    const dialog = within(await previewDialog());
    expect(dialog.getByText(m.previewBody)).toBeInTheDocument();
    // The same ProjectImage, large and small, showing the re-encoded blob (not the original).
    const images = dialog.getAllByRole('img', { name: alt });
    expect(images).toHaveLength(2);
    for (const img of images) expect(img).toHaveAttribute('src', 'blob:preview-1');
    expect(dialog.getByText(m.previewLarge)).toBeInTheDocument();
    expect(dialog.getByText(m.previewSmall)).toBeInTheDocument();
    expect(dialog.getByTestId('preview-size')).toHaveTextContent(sizeLine(1080, 1080, 240));
    expect(dialog.queryByText(m.previewSquareTip)).toBeNull();
    expect(db.calls).toEqual([]);
    expect(db.projects.get(PROJECT_ID)?.image_path).toBeNull();
  });

  it('"Use this image" uploads with progress; saved at once, not with Save', async () => {
    const user = userEvent.setup();
    db.upload = 'hold';
    await load();
    await user.upload(fileInput(m.image), pngFile());
    const dialog = await previewDialog();
    await user.click(within(dialog).getByRole('button', { name: m.useImage }));
    const bar = await screen.findByRole('progressbar', { name: m.uploadingImage });
    expect(bar).toHaveAttribute('aria-valuenow', '40');
    expect(screen.getByText(m.uploading.replace('{{percent}}', '40'))).toBeInTheDocument();
    // An upload in progress cannot be dismissed.
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: m.previewTitle })).toBeInTheDocument();
    db.release?.();

    expect(await screen.findByText(m.imageUploaded)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    const path = db.projects.get(PROJECT_ID)?.image_path as string;
    expect(path).toMatch(new RegExp(`^${PROJECT_ID}/image-[0-9a-f-]{36}\\.webp$`));
    expect(db.calls).toEqual(['upload:image', 'update:image_path']);
    const img = await screen.findByRole('img', { name: alt });
    expect(img).toHaveAttribute('src', `https://signed.test/project-images/${path}`);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(db.revoked).toEqual(['blob:preview-1']);
  });

  it.each(['cancel', 'escape'] as const)(
    '%s uploads nothing, keeps the current image and returns focus to Replace',
    async (how) => {
      const user = userEvent.setup();
      seed({ image_path: IMAGE });
      await load();
      const replace = screen.getByRole('button', { name: m.replaceImage });
      await user.upload(fileInput(m.image), pngFile());
      const dialog = await previewDialog();
      if (how === 'cancel') {
        await user.click(within(dialog).getByRole('button', { name: m.cancel }));
      } else {
        await user.keyboard('{Escape}');
      }
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(db.calls).toEqual([]);
      expect(db.projects.get(PROJECT_ID)?.image_path).toBe(IMAGE);
      expect(screen.getByRole('img', { name: alt })).toHaveAttribute(
        'src',
        `https://signed.test/project-images/${IMAGE}`,
      );
      await waitFor(() => {
        expect(replace).toHaveFocus();
      });
      expect(db.revoked).toEqual(['blob:preview-1']);
    },
  );

  it('"Choose another" replaces the pending file; only the last one is uploaded', async () => {
    const user = userEvent.setup();
    await load();
    await user.upload(fileInput(m.image), pngFile());
    let dialog = within(await previewDialog());
    expect(dialog.getByTestId('preview-size')).toHaveTextContent(sizeLine(1080, 1080, 240));

    db.encoded = { width: 1600, height: 900, bytes: 180 * 1024 };
    await user.click(dialog.getByRole('button', { name: m.chooseAnother }));
    await user.upload(fileInput(m.chooseAnother), pngFile());
    dialog = within(screen.getByRole('dialog', { name: m.previewTitle }));
    await waitFor(() => {
      expect(dialog.getByTestId('preview-size')).toHaveTextContent(sizeLine(1600, 900, 180));
    });
    for (const img of dialog.getAllByRole('img', { name: alt })) {
      expect(img).toHaveAttribute('src', 'blob:preview-2');
    }
    expect(db.revoked).toEqual(['blob:preview-1']);
    expect(db.calls).toEqual([]);

    await user.click(dialog.getByRole('button', { name: m.useImage }));
    expect(await screen.findByText(m.imageUploaded)).toBeInTheDocument();
    expect(db.calls).toEqual(['upload:image', 'update:image_path']);
  });

  it.each([
    ['wide (2.3:1)', 1600, 696, true],
    ['tall (1:1.4)', 1143, 1600, true],
    ['square', 1080, 1080, false],
  ] as const)(
    'a %s image fills the frame without being cropped (blurred backdrop, contained image)',
    async (_case, width, height, tip) => {
      const user = userEvent.setup();
      db.encoded = { width, height, bytes: 100 * 1024 };
      await load();
      await user.upload(fileInput(m.image), pngFile());
      const dialog = within(await previewDialog());
      expect(dialog.getByTestId('preview-size')).toHaveTextContent(sizeLine(width, height, 100));
      if (tip) expect(dialog.getByText(m.previewSquareTip)).toBeInTheDocument();
      else expect(dialog.queryByText(m.previewSquareTip)).toBeNull();
      for (const img of dialog.getAllByRole('img', { name: alt })) {
        // The image itself: whole (contain), as large as the frame, no padding, never cover.
        expect(img).toHaveClass('object-contain', 'size-full');
        expect(img).not.toHaveClass('object-cover');
        const frame = img.parentElement;
        expect(frame).toHaveAttribute('data-testid', 'project-image-frame');
        expect(frame?.className).not.toMatch(/(^|\s)p-\d/);
        // Behind it: the same picture, cover, blurred and hidden from assistive technology.
        const backdrop = within(frame as HTMLElement).getByTestId('project-image-backdrop');
        expect(backdrop).toHaveAttribute('src', img.getAttribute('src'));
        expect(backdrop).toHaveAttribute('aria-hidden', 'true');
        expect(backdrop).toHaveClass('object-cover', 'blur-[24px]', 'scale-115');
      }
    },
  );

  it('the stored image is shown whole too (edit page)', async () => {
    seed({ image_path: IMAGE });
    await load();
    const img = await screen.findByRole('img', { name: alt });
    expect(img).toHaveClass('object-contain');
    expect(img).not.toHaveClass('object-cover');
  });

  it('replace removes the old image; remove clears the path first, then the object', async () => {
    const user = userEvent.setup();
    seed({ image_path: IMAGE });
    await load();
    await user.upload(fileInput(m.image), pngFile());
    await user.click(within(await previewDialog()).getByRole('button', { name: m.useImage }));
    await screen.findByText(m.imageUploaded);
    expect(db.calls).toEqual(['upload:image', 'update:image_path', 'remove:project-images:1']);
    expect(db.objects.has(`project-images:${IMAGE}`)).toBe(false);

    db.calls = [];
    await user.click(screen.getByRole('button', { name: m.removeImage }));
    expect(await screen.findByText(m.imageRemoved)).toBeInTheDocument();
    expect(db.calls).toEqual(['update:image_path', 'remove:project-images:1']);
    expect(db.projects.get(PROJECT_ID)?.image_path).toBeNull();
    expect(screen.getByTestId('project-image-default')).toBeInTheDocument();
  });

  it.each([
    [
      'a GIF image',
      'image',
      () => new File(['gif'], 'a.gif', { type: 'image/gif' }),
      'wrongTypeImage',
    ],
    [
      'a Word file',
      'document',
      () => new File(['doc'], 'a.docx', { type: 'application/msword' }),
      'wrongTypeDocument',
    ],
    [
      'an 11 MB PDF',
      'document',
      () => new File([new Uint8Array(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }),
      'tooLargeDocument',
    ],
  ] as const)(
    '%s is refused before any upload, without a dialog',
    async (_case, kind, make, error) => {
      const user = userEvent.setup({ applyAccept: false });
      await load();
      await user.upload(fileInput(kind === 'image' ? m.image : m.document), make());
      expect(await screen.findByRole('alert')).toHaveTextContent(m.errors[error]);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(db.calls).toEqual([]);
    },
  );

  it('a wrong file chosen through "Choose another" is explained in the dialog', async () => {
    const user = userEvent.setup({ applyAccept: false });
    await load();
    await user.upload(fileInput(m.image), pngFile());
    const dialog = within(await previewDialog());
    await user.upload(
      fileInput(m.chooseAnother),
      new File(['gif'], 'a.gif', { type: 'image/gif' }),
    );
    expect(await dialog.findByRole('alert')).toHaveTextContent(m.errors.wrongTypeImage);
    expect(db.calls).toEqual([]);
  });

  it('a network failure says so in the dialog and saves nothing', async () => {
    const user = userEvent.setup();
    db.upload = 'network';
    await load();
    await user.upload(fileInput(m.image), pngFile());
    const dialog = within(await previewDialog());
    await user.click(dialog.getByRole('button', { name: m.useImage }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(m.errors.network);
    expect(db.projects.get(PROJECT_ID)?.image_path).toBeNull();
  });

  it('if saving the path fails, the new object is removed again (no orphan)', async () => {
    const user = userEvent.setup();
    db.failNextUpdate = true;
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await load();
    await user.upload(fileInput(m.image), pngFile());
    await user.click(within(await previewDialog()).getByRole('button', { name: m.useImage }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.projects.errors.notEditable);
    expect(db.calls).toEqual(['upload:image', 'update:image_path', 'remove:project-images:1']);
    expect([...db.objects]).toEqual([]);
  });

  it('document: "Upload this document?" with name and size; Cancel uploads nothing', async () => {
    const user = userEvent.setup();
    await load();
    await user.upload(fileInput(m.document), pdfFile());
    const dialog = within(await screen.findByRole('dialog', { name: m.confirmDocumentTitle }));
    expect(dialog.getByText('Pitch deck.pdf')).toBeInTheDocument();
    expect(dialog.getByText(m.sizeKb.replace('{{value}}', '1'))).toBeInTheDocument();
    expect(dialog.queryByRole('img')).toBeNull();
    await user.click(dialog.getByRole('button', { name: m.cancel }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(db.calls).toEqual([]);
    expect(db.projects.get(PROJECT_ID)?.document_path).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: m.uploadDocument })).toHaveFocus();
    });
  });

  it('document: Upload, then name and size, and "Open" through a signed URL', async () => {
    const user = userEvent.setup();
    await load();
    await user.upload(fileInput(m.document), pdfFile());
    const dialog = within(await screen.findByRole('dialog', { name: m.confirmDocumentTitle }));
    await user.click(dialog.getByRole('button', { name: m.confirmDocumentUpload }));
    expect(await screen.findByText(m.documentUploaded)).toBeInTheDocument();
    const media = within(region(t, 'media'));
    expect(await media.findByText('Pitch deck.pdf')).toBeInTheDocument();
    expect(media.getByText(m.sizeMb.replace('{{value}}', '1.5'))).toBeInTheDocument();
    const open = await media.findByRole('link', { name: `${m.open} ${t.legal.opensInNewTab}` });
    const path = db.projects.get(PROJECT_ID)?.document_path as string;
    expect(open).toHaveAttribute('href', `https://signed.test/project-documents/${path}`);
    expect(open).toHaveAttribute('target', '_blank');
    expect(open).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it(
    'axe: media with an image, a document and an error has no violations',
    async () => {
      const user = userEvent.setup({ applyAccept: false });
      seed({ image_path: IMAGE, document_path: DOCUMENT });
      await load();
      await screen.findByRole('img', { name: alt });
      await user.upload(fileInput(m.image), new File(['gif'], 'a.gif', { type: 'image/gif' }));
      await screen.findByRole('alert');
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the image preview dialog (with the tip) has no violations',
    async () => {
      const user = userEvent.setup();
      db.encoded = { width: 1600, height: 696, bytes: 100 * 1024 };
      await load();
      await user.upload(fileInput(m.image), pngFile());
      await previewDialog();
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );

  it(
    'axe: the document confirm dialog has no violations',
    async () => {
      const user = userEvent.setup();
      await load();
      await user.upload(fileInput(m.document), pdfFile());
      await screen.findByRole('dialog', { name: m.confirmDocumentTitle });
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});

describe('deleting a draft with files', () => {
  const t = en;

  async function confirmDelete() {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: t.projects.delete.button }));
    const dialog = await screen.findByRole('dialog', { name: t.projects.delete.title });
    await user.click(within(dialog).getByRole('button', { name: t.projects.delete.confirm }));
    return dialog;
  }

  beforeEach(() => {
    seed({ image_path: IMAGE, document_path: DOCUMENT });
    // An orphan from an earlier failed replacement: removed too, because the folder is listed.
    db.objects.add(`project-images:${PROJECT_ID}/image-aaaaaaaa-0000-4000-8000-000000000009.jpg`);
  });

  it('clears the paths, removes every object in the folders, then deletes the project', async () => {
    const router = await load();
    await confirmDelete();
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/app');
    }, SLOW);
    expect(db.calls).toEqual([
      'update:document_path,image_path',
      'remove:project-images:2',
      'remove:project-documents:1',
      'rpc:delete_project',
    ]);
    expect(db.objects.size).toBe(0);
    expect(db.projects.size).toBe(0);
  });

  it('step 1 fails: nothing removed, nothing deleted, paths intact', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await load();
    db.failNextUpdate = true;
    const dialog = await confirmDelete();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      t.projects.errors.notEditable,
    );
    expect(db.calls).toEqual(['update:document_path,image_path']);
    expect(db.projects.get(PROJECT_ID)).toMatchObject({
      image_path: IMAGE,
      document_path: DOCUMENT,
    });
    expect(db.objects.size).toBe(3);
  });

  it('step 2 fails: the project stays, with no paths to missing files', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await load();
    db.failRemove = true;
    const dialog = await confirmDelete();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      t.projects.errors.unexpected,
    );
    expect(db.calls).toEqual(['update:document_path,image_path', 'remove:project-images:2']);
    expect(db.projects.get(PROJECT_ID)).toMatchObject({ image_path: null, document_path: null });
    expect(db.calls).not.toContain('rpc:delete_project');
  });

  it('step 3 fails: the project stays, files gone and no paths left', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await load();
    db.failRpc = true;
    const dialog = await confirmDelete();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      t.projects.errors.unexpected,
    );
    expect(db.projects.get(PROJECT_ID)).toMatchObject({ image_path: null, document_path: null });
    expect(db.objects.size).toBe(0);
  });
});

describe.each(['en', 'ar'] as const)('read-only view and dashboard (%s)', (language) => {
  const t = copy[language];
  const p = t.projects;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  it('a project in review shows its details, links and the document', async () => {
    seed({
      status: 'pending_review',
      stage: 'prototype',
      team_size: 4,
      looking_for_members: true,
      wanted_specializations: ['ai', 'marketing'],
      needs: ['mentor'],
      document_path: DOCUMENT,
      repo_url: 'https://github.com/team/project',
    });
    await load();
    expect(screen.getByText(p.options.stage.prototype)).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: p.fields.wantedSpecializations })).toHaveTextContent(
      p.options.specialization.marketing,
    );
    expect(screen.getByRole('list', { name: p.fields.needs })).toHaveTextContent(
      p.options.need.mentor,
    );
    expect(await screen.findByText('Pitch deck.pdf')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: new RegExp('github.com/team/project') }),
    ).toHaveAttribute('target', '_blank');
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('"Your projects" shows the project image (or the default) next to the title', async () => {
    seed({ image_path: IMAGE });
    await load('/app');
    const card = await screen.findByRole('region', { name: t.dashboard.projects.title }, SLOW);
    const img = await within(card).findByRole('img', {
      name: p.media.imageAlt.replace('{{title}}', 'Campus Navigator'),
    });
    expect(img).toHaveAttribute('src', `https://signed.test/project-images/${IMAGE}`);
  });

  it(
    'axe: the read-only view has no violations',
    async () => {
      seed({ status: 'published', needs: ['funding'], video_url: 'https://youtu.be/abc' });
      await load();
      expect(await axeViolations()).toEqual([]);
    },
    AXE_TIMEOUT,
  );
});
