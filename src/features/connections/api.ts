import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * Organization → project requests, connections and in-app notifications (SCRUM-21).
 * The database is the boundary: RLS lets each party read only its own requests, connections and
 * notifications; every change goes through an RPC (send, respond, withdraw, mark read); and the
 * counterpart's contact details come only from get_connection_contact(), which logs every read.
 */

export type RequestStatus = Database['public']['Enums']['request_status'];
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 1000;
export const REASON_MAX = 300;
/** The decline cool-down enforced by send_org_project_request() (proposed, Plan §11). */
export const COOLDOWN_DAYS = 30;

const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

/** A pending request past its expiry is expired, even before the database marks it. */
export function effectiveStatus(
  status: RequestStatus,
  expiresAt: string,
  now: number = Date.now(),
): RequestStatus {
  return status === 'pending' && Date.parse(expiresAt) <= now ? 'expired' : status;
}

export const connectionKeys = {
  all: ['connections'] as const,
  projectRequest: (projectId: string, userId: string) =>
    ['connections', 'project-request', projectId, userId] as const,
  received: (userId: string) => ['connections', 'received', userId] as const,
  sent: (userId: string) => ['connections', 'sent', userId] as const,
  list: (userId: string) => ['connections', 'list', userId] as const,
  contact: (connectionId: string) => ['connections', 'contact', connectionId] as const,
  notifications: (userId: string) => ['connections', 'notifications', userId] as const,
  unread: (userId: string) => ['connections', 'unread', userId] as const,
};

// Errors ------------------------------------------------------------------------------------------

export type RequestErrorKind =
  | 'network'
  | 'pending'
  | 'connected'
  | 'cooldown'
  | 'rateLimited'
  | 'notFound'
  | 'notAllowed'
  | 'notPending'
  | 'expired'
  | 'unexpected';

export class RequestFailure extends Error {
  constructor(readonly kind: RequestErrorKind) {
    super(kind);
    this.name = 'RequestFailure';
  }
}

const CODES: Record<string, RequestErrorKind> = {
  ABR_REQUEST_PENDING: 'pending',
  ABR_ALREADY_CONNECTED: 'connected',
  ABR_REQUEST_COOLDOWN: 'cooldown',
  ABR_RATE_LIMITED: 'rateLimited',
  ABR_PROJECT_NOT_FOUND: 'notFound',
  ABR_REQUEST_NOT_FOUND: 'notFound',
  ABR_NOT_VERIFIED: 'notAllowed',
  ABR_NOT_ORGANIZATION: 'notAllowed',
  ABR_REQUEST_NOT_PENDING: 'notPending',
  ABR_REQUEST_EXPIRED: 'expired',
};

export function toRequestFailure(error: unknown): RequestFailure {
  if (error instanceof RequestFailure) return error;
  if (error instanceof TypeError) return new RequestFailure('network');
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? error.message : null;
  const kind = typeof message === 'string' ? CODES[message] : undefined;
  if (!kind) console.error('Request call failed', error);
  return new RequestFailure(kind ?? 'unexpected');
}

// The organization's latest request for one project ----------------------------------------------

export interface OwnProjectRequest {
  id: string;
  status: RequestStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  /** After a decline: when the organization may ask again, while that is still ahead. */
  cooldownUntil: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function useProjectRequest(projectId: string, userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: connectionKeys.projectRequest(projectId, userId ?? ''),
    enabled: enabled && Boolean(userId),
    queryFn: async (): Promise<OwnProjectRequest | null> => {
      const { data, error } = await supabase
        .from('requests')
        .select('id, status, created_at, expires_at, responded_at, decline_reason')
        .eq('project_id', projectId)
        .eq('sender_id', userId ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const row = data[0];
      if (!row) return null;
      const until =
        row.status === 'declined' && row.responded_at
          ? Date.parse(row.responded_at) + COOLDOWN_DAYS * DAY
          : null;
      return {
        id: row.id,
        cooldownUntil: until !== null && until > Date.now() ? new Date(until).toISOString() : null,
        status: effectiveStatus(row.status, row.expires_at),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        respondedAt: row.responded_at,
        declineReason: row.decline_reason,
      };
    },
  });
}

export function useSendRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { projectId: string; message: string }) => {
      const { data, error } = await supabase.rpc('send_org_project_request', {
        p_project_id: input.projectId,
        p_message: input.message.trim(),
      });
      if (error) throw toRequestFailure(error);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  });
}

export function useWithdrawRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('withdraw_request', { p_request_id: requestId });
      if (error) throw toRequestFailure(error);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  });
}

export function useRespondToRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { requestId: string; accept: boolean; reason?: string }) => {
      const reason = input.reason?.trim() ?? '';
      const { data, error } = await supabase.rpc('respond_to_request', {
        p_request_id: input.requestId,
        p_accept: input.accept,
        p_reason: input.accept || reason === '' ? undefined : reason,
      });
      if (error) throw toRequestFailure(error);
      return data;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  });
}

// Request lists ------------------------------------------------------------------------------------

export interface RequestItem {
  id: string;
  status: RequestStatus;
  message: string;
  declineReason: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  projectId: string | null;
  /** null when the project is no longer published (RLS hides it). */
  projectTitle: string | null;
  /** The organization (received) or the student (sent); null when no longer visible. */
  counterpartName: string | null;
  counterpartDescription: string | null;
  counterpartWebsite: string | null;
}

interface PartyRow {
  full_name: string | null;
  organization:
    | { organization_name: string | null; description: string | null; website: string | null }
    | { organization_name: string | null; description: string | null; website: string | null }[]
    | null;
}

const REQUEST_COLUMNS =
  'id, status, message, decline_reason, created_at, expires_at, responded_at, project_id, project:projects(title)';

function toRequestItem(row: {
  id: string;
  status: RequestStatus;
  message: string;
  decline_reason: string | null;
  created_at: string;
  expires_at: string;
  responded_at: string | null;
  project_id: string | null;
  project: { title: string } | { title: string }[] | null;
  party: PartyRow | PartyRow[] | null;
}): RequestItem {
  const party = one(row.party);
  const org = one(party?.organization);
  return {
    id: row.id,
    status: effectiveStatus(row.status, row.expires_at),
    message: row.message,
    declineReason: row.decline_reason,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    respondedAt: row.responded_at,
    projectId: row.project_id,
    projectTitle: one(row.project)?.title ?? null,
    counterpartName: org?.organization_name ?? party?.full_name ?? null,
    counterpartDescription: org?.description ?? null,
    counterpartWebsite: org?.website ?? null,
  };
}

/** Requests the signed-in student received, newest first. */
export function useReceivedRequests(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: connectionKeys.received(userId ?? ''),
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(
          `${REQUEST_COLUMNS}, party:profiles!requests_sender_id_fkey(full_name, organization:organization_profiles(organization_name, description, website))`,
        )
        .eq('recipient_id', userId ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(toRequestItem);
    },
  });
}

/** Requests the signed-in organization sent, newest first. */
export function useSentRequests(userId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: connectionKeys.sent(userId ?? ''),
    enabled: enabled && Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requests')
        .select(
          `${REQUEST_COLUMNS}, party:profiles!requests_recipient_id_fkey(full_name, organization:organization_profiles(organization_name, description, website))`,
        )
        .eq('sender_id', userId ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map(toRequestItem);
    },
  });
}

// Connections --------------------------------------------------------------------------------------

export interface ConnectionItem {
  id: string;
  createdAt: string;
  projectId: string | null;
  projectTitle: string | null;
  counterpartName: string | null;
}

const PARTY = 'full_name, organization:organization_profiles(organization_name)';

export function useConnections(userId: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.list(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<ConnectionItem[]> => {
      const { data, error } = await supabase
        .from('connections')
        .select(
          `id, created_at, project_id, user_a, user_b, project:projects(title), a:profiles!connections_user_a_fkey(${PARTY}), b:profiles!connections_user_b_fkey(${PARTY})`,
        )
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => {
        const other = one(row.user_a === userId ? row.b : row.a);
        const org = one(other?.organization);
        return {
          id: row.id,
          createdAt: row.created_at,
          projectId: row.project_id,
          projectTitle: one(row.project)?.title ?? null,
          counterpartName: org?.organization_name ?? other?.full_name ?? null,
        };
      });
    },
  });
}

export interface ConnectionContact {
  displayName: string | null;
  email: string;
  phone: string | null;
  linkedinUrl: string | null;
}

/**
 * The counterpart's permitted contact fields. Only fetched when the user asks (each read is
 * audited). null: the database refused or has nothing (it never says why).
 */
export function useConnectionContact(connectionId: string, enabled: boolean) {
  return useQuery({
    queryKey: connectionKeys.contact(connectionId),
    enabled,
    staleTime: Infinity,
    queryFn: async (): Promise<ConnectionContact | null> => {
      const { data, error } = await supabase.rpc('get_connection_contact', {
        p_connection_id: connectionId,
      });
      if (error) throw error;
      const row = data[0];
      if (!row) return null;
      return {
        displayName: row.display_name,
        email: row.contact_email,
        phone: row.phone,
        linkedinUrl: row.linkedin_url,
      };
    },
  });
}

// Notifications ------------------------------------------------------------------------------------

export const NOTIFICATION_TYPES = [
  'request_received',
  'request_accepted',
  'request_declined',
  'request_cancelled',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
const isNotificationType = (value: string): value is NotificationType =>
  (NOTIFICATION_TYPES as readonly string[]).includes(value);

export interface NotificationItem {
  id: string;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  projectTitle: string | null;
  counterpartName: string | null;
}

const text = (payload: unknown, key: string): string | null => {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const value: unknown = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : null;
};

export const NOTIFICATIONS_PAGE = 50;

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.notifications(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async (): Promise<NotificationItem[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, read_at, created_at, payload')
        .eq('recipient_id', userId ?? '')
        .order('created_at', { ascending: false })
        .range(0, NOTIFICATIONS_PAGE - 1);
      if (error) throw error;
      return data.flatMap((row) =>
        isNotificationType(row.type)
          ? [
              {
                id: row.id,
                type: row.type,
                readAt: row.read_at,
                createdAt: row.created_at,
                projectTitle: text(row.payload, 'project_title'),
                counterpartName: text(row.payload, 'counterpart_name'),
              },
            ]
          : [],
      );
    },
  });
}

/** Unread count for the header bell. Polls once a minute while the tab is open. */
export function useUnreadCount(userId: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.unread(userId ?? ''),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId ?? '')
        .is('read_at', null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    /** ids: these notifications; undefined: all of the caller's unread ones. */
    mutationFn: async (ids?: string[]) => {
      const { error } = await supabase.rpc('mark_notifications_read', { p_ids: ids });
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: connectionKeys.all }),
  });
}
