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
import { effectiveStatus, toRequestFailure } from './api';

const copy = { en, ar } as const;
const AXE_TIMEOUT = 60_000;
const ME = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
const PROJECT = '11111111-0000-4000-8000-000000000001';
const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

type Row = Record<string, unknown>;

/**
 * In-memory rows behind the supabase-js calls these screens make; rows are stored already in
 * their embedded shape. Top-level eq filters run here. RLS and every rule are the database's job
 * (supabase/tests/database/150_connection_requests.test.sql).
 */
interface FakeDb {
  tables: Record<string, Row[]>;
  rpcs: { name: string; args: Row }[];
  rpcResult: Record<string, { data?: unknown; error?: { message: string } | null }>;
}
const db = vi.hoisted((): FakeDb => ({ tables: {}, rpcs: [], rpcResult: {} }));

vi.mock('@/lib/supabase', () => {
  function select(table: string, options?: { head?: boolean }) {
    const filters: [string, unknown][] = [];
    const run = () => {
      const rows = (db.tables[table] ?? []).filter((row) =>
        filters.every(([column, value]) => !(column in row) || row[column] === value),
      );
      return Promise.resolve({
        data: options?.head ? null : rows,
        error: null,
        count: rows.length,
      });
    };
    const builder = {
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      is: (column: string, value: unknown) => {
        filters.push([column, value]);
        return builder;
      },
      order: () => builder,
      range: () => run(),
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
      from: (table: string) => ({
        select: (_columns: string, options?: { head?: boolean }) => select(table, options),
      }),
      rpc: (name: string, args: Row) => {
        db.rpcs.push({ name, args });
        const result = db.rpcResult[name];
        return Promise.resolve({ data: result?.data ?? null, error: result?.error ?? null });
      },
      storage: {
        from: () => ({
          createSignedUrls: (names: string[]) =>
            Promise.resolve({
              data: names.map((path) => ({ path, signedUrl: `https://x.test/${path}` })),
              error: null,
            }),
        }),
      },
    },
  };
});

const auth = (
  role: AuthState['role'],
  verificationStatus: AuthState['verificationStatus'] = 'verified',
): AuthState => ({
  status: 'ready',
  session: { user: { id: ME, email: 'me@abr.test' } } as unknown as Session,
  role,
  verificationStatus,
  onboarded: true,
});

function project(ownerId = OTHER): Row {
  return {
    id: PROJECT,
    owner_id: ownerId,
    title: 'Campus Navigator',
    status: 'published',
    track: 'web',
    image_path: null,
    summary: 'Indoor maps',
    description: 'A long description of the project.',
    sectors: [],
    academic_year: null,
    stage: null,
    team_size: 1,
    looking_for_members: false,
    wanted_specializations: [],
    needs: [],
    document_path: null,
    video_url: null,
    repo_url: null,
    demo_url: null,
    owner: { full_name: 'Omar Student', verification_status: 'verified', student: null },
    university: { name_en: 'Test University', name_ar: 'جامعة الاختبار' },
  };
}

function request(overrides: Row = {}): Row {
  return {
    id: '22222222-0000-4000-8000-000000000001',
    status: 'pending',
    message: 'We would love to sponsor your work.',
    decline_reason: null,
    created_at: iso(-2),
    expires_at: iso(28),
    responded_at: null,
    project_id: PROJECT,
    project: { title: 'Campus Navigator' },
    party: {
      full_name: 'Sara Org',
      organization: {
        organization_name: 'Acme Labs',
        description: 'We build tools for students.',
        website: 'https://acme.test',
      },
    },
    ...overrides,
  };
}

beforeAll(() => {
  Object.assign(Element.prototype, {
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  });
});

beforeEach(() => {
  db.tables = { projects: [project()], notifications: [] };
  db.rpcs = [];
  db.rpcResult = {};
});

afterEach(async () => {
  await changeLanguage('en');
});

describe('effectiveStatus and errors', () => {
  it('a pending request past its expiry reads as expired', () => {
    expect(effectiveStatus('pending', iso(-1))).toBe('expired');
    expect(effectiveStatus('pending', iso(1))).toBe('pending');
    expect(effectiveStatus('declined', iso(-1))).toBe('declined');
  });
  it('maps database codes to plain-language kinds; anything else is unexpected', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(toRequestFailure({ message: 'ABR_RATE_LIMITED' }).kind).toBe('rateLimited');
    expect(toRequestFailure({ message: 'ABR_REQUEST_COOLDOWN' }).kind).toBe('cooldown');
    expect(toRequestFailure({ message: 'ABR_REQUEST_PENDING' }).kind).toBe('pending');
    expect(toRequestFailure(new TypeError('fetch failed')).kind).toBe('network');
    expect(toRequestFailure({ message: 'permission denied for table requests' }).kind).toBe(
      'unexpected',
    );
  });
});

describe.each(['en', 'ar'] as const)('requests to connect (%s)', (language) => {
  const t = copy[language];
  const c = t.connections;

  beforeEach(async () => {
    await changeLanguage(language);
  });

  const panel = async () => screen.findByRole('region', { name: c.panel.title }, { timeout: 3000 });

  describe('project page panel', () => {
    it('an organization writes a message; under 10 characters is refused before sending', async () => {
      const user = userEvent.setup();
      renderRoute(`/projects/${PROJECT}`, auth('organization'));
      const region = await panel();
      const field = await within(region).findByRole('textbox', { name: c.panel.messageLabel });
      await user.type(field, 'too short');
      await user.click(within(region).getByRole('button', { name: c.panel.send }));
      expect(field).toHaveAccessibleDescription(expect.stringContaining(c.panel.messageTooShort));
      expect(db.rpcs).toHaveLength(0);

      db.rpcResult.send_org_project_request = { data: 'new-id' };
      await user.type(field, ' but now long enough');
      await user.click(within(region).getByRole('button', { name: c.panel.send }));
      await waitFor(() => {
        expect(db.rpcs).toContainEqual({
          name: 'send_org_project_request',
          args: { p_project_id: PROJECT, p_message: 'too short but now long enough' },
        });
      });
      // Only the project id and the message: the recipient is derived by the database.
    });

    it('a refusal is shown in plain language', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      db.rpcResult.send_org_project_request = { error: { message: 'ABR_RATE_LIMITED' } };
      const user = userEvent.setup();
      renderRoute(`/projects/${PROJECT}`, auth('organization'));
      const region = await panel();
      await user.type(
        await within(region).findByRole('textbox', { name: c.panel.messageLabel }),
        'A perfectly fine message',
      );
      await user.click(within(region).getByRole('button', { name: c.panel.send }));
      expect(await within(region).findByText(c.errors.rateLimited)).toBeInTheDocument();
    });

    it('a pending request can be withdrawn', async () => {
      db.tables.requests = [request({ sender_id: ME })];
      const user = userEvent.setup();
      renderRoute(`/projects/${PROJECT}`, auth('organization'));
      const region = await panel();
      await user.click(await within(region).findByRole('button', { name: c.panel.withdraw }));
      await waitFor(() => {
        expect(db.rpcs).toContainEqual({
          name: 'withdraw_request',
          args: { p_request_id: '22222222-0000-4000-8000-000000000001' },
        });
      });
    });

    it('accepted: a link to the contact details; declined: the date to ask again and the note', async () => {
      db.tables.requests = [request({ sender_id: ME, status: 'accepted', responded_at: iso(-1) })];
      const first = renderRoute(`/projects/${PROJECT}`, auth('organization'));
      const region = await panel();
      expect(
        await within(region).findByRole('link', { name: c.panel.viewConnections }),
      ).toHaveAttribute('href', '/app/connections');
      first.unmount();

      db.tables.requests = [
        request({
          sender_id: ME,
          status: 'declined',
          responded_at: iso(-1),
          decline_reason: 'Not this term',
        }),
      ];
      renderRoute(`/projects/${PROJECT}`, auth('organization'));
      const declined = await panel();
      expect(await within(declined).findByText('Not this term')).toBeInTheDocument();
      expect(within(declined).queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('the owner is pointed to Requests; a mentor is told it is coming', async () => {
      db.tables.projects = [project(ME)];
      const first = renderRoute(`/projects/${PROJECT}`, auth('student'));
      const region = await panel();
      expect(within(region).getByRole('link', { name: c.panel.ownerLink })).toHaveAttribute(
        'href',
        '/app/requests',
      );
      first.unmount();
      renderRoute(`/projects/${PROJECT}`, auth('mentor'));
      expect(await panel()).toHaveTextContent(c.panel.mentorBody);
    });

    it(
      'has no axe violations (organization form)',
      async () => {
        renderRoute(`/projects/${PROJECT}`, auth('organization'));
        const region = await panel();
        await within(region).findByRole('textbox');
        expect(await axeViolations()).toEqual([]);
      },
      AXE_TIMEOUT,
    );
  });

  describe('/app/requests', () => {
    it('a student accepts after confirming what will be shared', async () => {
      db.tables.requests = [request({ recipient_id: ME })];
      db.rpcResult.respond_to_request = { data: 'conn-id' };
      const user = userEvent.setup();
      renderRoute('/app/requests', auth('student'));
      const card = await screen.findByRole('article', { name: 'Acme Labs' });
      expect(within(card).getByText(c.status.pending)).toBeInTheDocument();
      expect(within(card).getByText('We would love to sponsor your work.')).toBeInTheDocument();
      await user.click(within(card).getByRole('button', { name: c.requests.accept }));
      const dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(c.requests.acceptDialog.body);
      await user.click(
        within(dialog).getByRole('button', { name: c.requests.acceptDialog.confirm }),
      );
      await waitFor(() => {
        expect(db.rpcs).toContainEqual({
          name: 'respond_to_request',
          args: {
            p_request_id: '22222222-0000-4000-8000-000000000001',
            p_accept: true,
            p_reason: undefined,
          },
        });
      });
    });

    it('a student declines with an optional note', async () => {
      db.tables.requests = [request({ recipient_id: ME })];
      const user = userEvent.setup();
      renderRoute('/app/requests', auth('student'));
      const card = await screen.findByRole('article', { name: 'Acme Labs' });
      await user.click(within(card).getByRole('button', { name: c.requests.decline }));
      const dialog = await screen.findByRole('dialog');
      await user.type(
        within(dialog).getByRole('textbox', { name: c.requests.declineDialog.reasonLabel }),
        '  Not right now  ',
      );
      await user.click(
        within(dialog).getByRole('button', { name: c.requests.declineDialog.confirm }),
      );
      await waitFor(() => {
        expect(db.rpcs).toContainEqual({
          name: 'respond_to_request',
          args: {
            p_request_id: '22222222-0000-4000-8000-000000000001',
            p_accept: false,
            p_reason: 'Not right now',
          },
        });
      });
    });

    it('answered and expired requests have no actions; a hidden project is named generically', async () => {
      db.tables.requests = [
        request({ recipient_id: ME, status: 'declined', responded_at: iso(-1) }),
        request({
          id: '22222222-0000-4000-8000-000000000002',
          recipient_id: ME,
          expires_at: iso(-1),
          project: null,
          party: {
            full_name: 'Other Org',
            organization: { organization_name: 'Beta Co', description: null, website: null },
          },
        }),
      ];
      renderRoute('/app/requests', auth('student'));
      const declined = await screen.findByRole('article', { name: 'Acme Labs' });
      const expired = screen.getByRole('article', { name: 'Beta Co' });
      expect(within(declined).getByText(c.status.declined)).toBeInTheDocument();
      expect(within(expired).getByText(c.status.expired)).toBeInTheDocument();
      expect(within(expired).getByText(c.requests.projectGone)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: c.requests.accept })).not.toBeInTheDocument();
    });

    it('an organization sees what it sent and can withdraw; empty states for both sides', async () => {
      db.tables.requests = [
        request({ sender_id: ME, party: { full_name: 'Omar Student', organization: null } }),
      ];
      const first = renderRoute('/app/requests', auth('organization'));
      const card = await screen.findByRole('article', { name: 'Omar Student' });
      expect(within(card).getByRole('button', { name: c.panel.withdraw })).toBeInTheDocument();
      first.unmount();

      db.tables.requests = [];
      const second = renderRoute('/app/requests', auth('organization'));
      expect(await screen.findByText(c.requests.emptySent)).toBeInTheDocument();
      second.unmount();
      renderRoute('/app/requests', auth('student'));
      expect(await screen.findByText(c.requests.emptyReceived)).toBeInTheDocument();
    });

    it('a mentor and an unverified user are told why there is nothing yet', async () => {
      const first = renderRoute('/app/requests', auth('mentor'));
      expect(await screen.findByText(c.requests.mentorBody)).toBeInTheDocument();
      first.unmount();
      renderRoute('/app/requests', auth('organization', 'pending'));
      expect(await screen.findByText(c.requests.verifyFirst)).toBeInTheDocument();
    });

    it(
      'has no axe violations (received)',
      async () => {
        db.tables.requests = [request({ recipient_id: ME })];
        renderRoute('/app/requests', auth('student'));
        await screen.findByRole('article', { name: 'Acme Labs' });
        expect(await axeViolations()).toEqual([]);
      },
      AXE_TIMEOUT,
    );
  });

  describe('/app/connections', () => {
    const connection = {
      id: '33333333-0000-4000-8000-000000000001',
      created_at: iso(-1),
      project_id: PROJECT,
      user_a: ME,
      user_b: OTHER,
      status: 'active',
      project: { title: 'Campus Navigator' },
      a: { full_name: 'Me', organization: null },
      b: { full_name: 'Sara Org', organization: { organization_name: 'Acme Labs' } },
    };

    it('contact details load only on request, through the audited door', async () => {
      db.tables.connections = [connection];
      db.rpcResult.get_connection_contact = {
        data: [
          {
            user_id: OTHER,
            display_name: 'Acme Labs',
            contact_email: 'hello@acme.test',
            phone: '+966500000001',
            linkedin_url: null,
          },
        ],
      };
      const user = userEvent.setup();
      renderRoute('/app/connections', auth('student'));
      const card = await screen.findByRole('article', { name: 'Acme Labs' });
      expect(db.rpcs).toHaveLength(0);
      await user.click(within(card).getByRole('button', { name: c.list.show }));
      expect(await within(card).findByRole('link', { name: 'hello@acme.test' })).toHaveAttribute(
        'href',
        'mailto:hello@acme.test',
      );
      expect(within(card).getByRole('link', { name: '+966500000001' })).toBeInTheDocument();
      expect(within(card).getByText(c.list.notShared)).toBeInTheDocument();
      expect(db.rpcs).toEqual([
        { name: 'get_connection_contact', args: { p_connection_id: connection.id } },
      ]);
    });

    it('an empty answer from the door says the details are unavailable', async () => {
      db.tables.connections = [connection];
      db.rpcResult.get_connection_contact = { data: [] };
      const user = userEvent.setup();
      renderRoute('/app/connections', auth('organization'));
      const card = await screen.findByRole('article', { name: 'Acme Labs' });
      await user.click(within(card).getByRole('button', { name: c.list.show }));
      expect(await within(card).findByText(c.list.unavailable)).toBeInTheDocument();
    });

    it('empty state', async () => {
      db.tables.connections = [];
      renderRoute('/app/connections', auth('student'));
      expect(await screen.findByText(c.list.empty)).toBeInTheDocument();
    });

    it(
      'has no axe violations',
      async () => {
        db.tables.connections = [connection];
        renderRoute('/app/connections', auth('student'));
        await screen.findByRole('article', { name: 'Acme Labs' });
        expect(await axeViolations()).toEqual([]);
      },
      AXE_TIMEOUT,
    );
  });

  describe('/app/notifications', () => {
    const notes = () => [
      {
        id: '44444444-0000-4000-8000-000000000001',
        recipient_id: ME,
        type: 'request_received',
        read_at: null,
        created_at: iso(0),
        payload: { project_title: 'Campus Navigator', counterpart_name: 'Acme Labs' },
      },
      {
        id: '44444444-0000-4000-8000-000000000002',
        recipient_id: ME,
        type: 'request_cancelled',
        read_at: iso(-1),
        created_at: iso(-1),
        payload: { project_title: 'Old Project' },
      },
    ];

    it('lists events as sentences, marks one read on open and all read on request', async () => {
      db.tables.notifications = notes();
      const user = userEvent.setup();
      renderRoute('/app/notifications', auth('student'));
      const received = c.notifications.types.request_received
        .replace('{{name}}', 'Acme Labs')
        .replace('{{project}}', 'Campus Navigator');
      expect(await screen.findByText(received)).toBeInTheDocument();
      expect(
        screen.getByText(
          c.notifications.types.request_cancelled.replace('{{project}}', 'Old Project'),
        ),
      ).toBeInTheDocument();
      expect(screen.getAllByText(c.notifications.unread)).toHaveLength(1);
      // The bell names the count.
      expect(
        screen.getByRole('link', {
          name: c.notifications.bellUnread.replace('{{count}}', '1'),
        }),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: c.notifications.markAll }));
      await waitFor(() => {
        expect(db.rpcs).toContainEqual({
          name: 'mark_notifications_read',
          args: { p_ids: undefined },
        });
      });
    });

    it('empty state', async () => {
      renderRoute('/app/notifications', auth('organization'));
      expect(await screen.findByText(c.notifications.empty)).toBeInTheDocument();
    });

    it(
      'has no axe violations',
      async () => {
        db.tables.notifications = notes();
        renderRoute('/app/notifications', auth('student'));
        await screen.findAllByText(c.notifications.unread);
        expect(await axeViolations()).toEqual([]);
      },
      AXE_TIMEOUT,
    );
  });
});
