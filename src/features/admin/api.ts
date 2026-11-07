import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Project, projectKey, toProject } from '@/features/projects/api';
import { type ProjectStatus } from '@/features/projects/options';
import { type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

/**
 * Admin data (SCRUM-19). Every call is checked again by the database: the select policies through
 * is_admin(), and the admin RPCs refuse anyone else (ABR_NOT_ADMIN). The route guard is UX only.
 */

export type ReviewDecision = Database['public']['Enums']['review_decision'];

export const adminKeys = {
  counts: ['admin', 'counts'] as const,
  interest: ['admin', 'interest'] as const,
  queue: (status: ProjectStatus) => ['admin', 'queue', status] as const,
  review: (id: string) => ['admin', 'review', id] as const,
  history: (id: string) => ['admin', 'history', id] as const,
};

export function useProjectCounts() {
  return useQuery({
    queryKey: adminKeys.counts,
    queryFn: async (): Promise<Record<ProjectStatus, number>> => {
      const { data, error } = await supabase.rpc('admin_project_counts');
      if (error) throw error;
      const counts = {
        draft: 0,
        pending_review: 0,
        changes_requested: 0,
        published: 0,
        rejected: 0,
        unpublished: 0,
      };
      for (const row of data) counts[row.status] = row.count;
      return counts;
    },
  });
}

export interface InterestRow {
  dimension: string;
  value: string;
  count: number;
}

/** Interest sign-up counts per dimension (get_interest_stats: counts only, no personal data). */
export function useInterestStats() {
  return useQuery({
    queryKey: adminKeys.interest,
    queryFn: async (): Promise<InterestRow[]> => {
      const { data, error } = await supabase.rpc('get_interest_stats');
      if (error) throw error;
      return data.map((row) => ({
        dimension: row.dimension,
        value: row.value,
        count: row.count,
      }));
    },
  });
}

export interface QueueItem {
  id: string;
  title: string;
  status: ProjectStatus;
  track: string | null;
  imagePath: string | null;
  submittedAt: string | null;
  updatedAt: string;
  studentName: string | null;
  universityName: string | null;
}

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

/**
 * Projects in one status, with the student's name and university. Pending review is the queue,
 * oldest submission first; the other statuses are for reference, most recently changed first.
 */
export function useReviewQueue(status: ProjectStatus, language: Language) {
  return useQuery({
    queryKey: adminKeys.queue(status),
    queryFn: async () => {
      const query = supabase
        .from('projects')
        .select(
          'id, title, status, track, image_path, submitted_at, updated_at, owner:profiles!projects_owner_id_fkey(full_name), university:universities(name_en, name_ar)',
        )
        .eq('status', status);
      const { data, error } = await (status === 'pending_review'
        ? query.order('submitted_at', { ascending: true, nullsFirst: false })
        : query.order('updated_at', { ascending: false }));
      if (error) throw error;
      return data;
    },
    select: (rows): QueueItem[] =>
      rows.map((row) => {
        const university = one(row.university);
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          track: row.track,
          imagePath: row.image_path,
          submittedAt: row.submitted_at,
          updatedAt: row.updated_at,
          studentName: one(row.owner)?.full_name ?? null,
          universityName: university
            ? language === 'ar'
              ? university.name_ar
              : university.name_en
            : null,
        };
      }),
  });
}

export interface ReviewProject extends Project {
  submittedAt: string | null;
  studentName: string | null;
  universityName: string | null;
}

const PROJECT_COLUMNS =
  'id, title, status, track, image_path, summary, description, sectors, academic_year, stage, team_size, looking_for_members, wanted_specializations, needs, document_path, video_url, repo_url, demo_url, submitted_at, owner:profiles!projects_owner_id_fkey(full_name), university:universities(name_en, name_ar)';

/** One project for review, with its student. null when it does not exist. */
export function useReviewProject(id: string, language: Language) {
  return useQuery({
    queryKey: adminKeys.review(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    select: (row): ReviewProject | null => {
      if (!row) return null;
      const { owner, university, submitted_at: submittedAt, ...project } = row;
      const uni = one(university);
      return {
        ...toProject(project),
        submittedAt,
        studentName: one(owner)?.full_name ?? null,
        universityName: uni ? (language === 'ar' ? uni.name_ar : uni.name_en) : null,
      };
    },
  });
}

export interface ReviewEntry {
  id: string;
  decision: ReviewDecision;
  notes: string | null;
  createdAt: string;
  reviewerName: string | null;
}

/** The review history with reviewer names (admin_project_reviews), newest first. */
export function useReviewHistory(id: string) {
  return useQuery({
    queryKey: adminKeys.history(id),
    queryFn: async (): Promise<ReviewEntry[]> => {
      const { data, error } = await supabase.rpc('admin_project_reviews', { p_project_id: id });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        decision: row.decision,
        notes: row.notes,
        createdAt: row.created_at,
        reviewerName: row.reviewer_name,
      }));
    },
  });
}

export type ReviewErrorKind =
  'notPending' | 'notesRequired' | 'notFound' | 'network' | 'unexpected';
export class ReviewFailure extends Error {
  constructor(readonly kind: ReviewErrorKind) {
    super(kind);
    this.name = 'ReviewFailure';
  }
}
const REVIEW_CODES: Record<string, ReviewErrorKind> = {
  ABR_NOT_PENDING: 'notPending',
  ABR_NOTES_REQUIRED: 'notesRequired',
  ABR_PROJECT_NOT_FOUND: 'notFound',
};

/** review_project(): the database decides; afterwards the admin views reload. */
export function useReviewProjectMutation(id: string) {
  const queryClient = useQueryClient();
  return useMutation<string, ReviewFailure, { decision: ReviewDecision; notes: string }>({
    mutationFn: async ({ decision, notes }) => {
      try {
        const { data, error } = await supabase.rpc('review_project', {
          p_project_id: id,
          p_decision: decision,
          p_notes: notes.trim(),
        });
        if (error) throw error;
        return data;
      } catch (error) {
        if (error instanceof TypeError) throw new ReviewFailure('network');
        const message =
          typeof error === 'object' && error !== null && 'message' in error ? error.message : null;
        const kind = typeof message === 'string' ? REVIEW_CODES[message] : undefined;
        if (kind) throw new ReviewFailure(kind);
        console.error('Review failed', error);
        throw new ReviewFailure('unexpected');
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      void queryClient.invalidateQueries({ queryKey: projectKey(id) });
    },
  });
}
