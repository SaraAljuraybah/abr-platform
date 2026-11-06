import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import type { ProjectStatus } from './options';
import type { ProjectValues } from './schemas';

type Tables = Database['public']['Tables'];

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
}

export interface Project extends ProjectSummary {
  summary: string | null;
  description: string | null;
  track: string | null;
  sectors: string[];
  academicYear: string | null;
}

export const ownProjectsKey = (userId: string) => ['projects', 'own', userId] as const;
export const projectKey = (id: string) => ['projects', 'detail', id] as const;

/**
 * What the UI may say when a project call fails. The RPCs raise ABR_* codes; technical detail
 * goes to the console, never to the screen.
 */
export type ProjectErrorKind =
  'network' | 'limit' | 'notAllowed' | 'notEditable' | 'notFound' | 'unexpected';
export class ProjectFailure extends Error {
  constructor(readonly kind: ProjectErrorKind) {
    super(kind);
    this.name = 'ProjectFailure';
  }
}

const CODES: Record<string, ProjectErrorKind> = {
  ABR_PROJECT_LIMIT: 'limit',
  ABR_NOT_VERIFIED: 'notAllowed',
  ABR_NOT_STUDENT: 'notAllowed',
  ABR_ONBOARDING_INCOMPLETE: 'notAllowed',
  ABR_NOT_DRAFT: 'notEditable',
  ABR_PROJECT_NOT_FOUND: 'notFound',
};

function toFailure(error: unknown): ProjectFailure {
  if (error instanceof ProjectFailure) return error;
  if (error instanceof TypeError) return new ProjectFailure('network');
  const message =
    typeof error === 'object' && error !== null && 'message' in error ? error.message : null;
  const kind = typeof message === 'string' ? CODES[message] : undefined;
  if (kind) return new ProjectFailure(kind);
  console.error('Project request failed', error);
  return new ProjectFailure('unexpected');
}

/** The student's own projects, newest first (RLS is the authority; the filter keeps it to theirs). */
export function ownProjectsQuery(userId: string) {
  return queryOptions({
    queryKey: ownProjectsKey(userId),
    queryFn: async (): Promise<ProjectSummary[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useOwnProjects(userId: string) {
  return useQuery(ownProjectsQuery(userId));
}

/** One project. null when it does not exist or RLS hides it: the page cannot tell, nor should it. */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKey(id),
    // The form keeps its own state once loaded; never refetch underneath it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status, summary, description, track, sectors, academic_year')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const { academic_year: academicYear, ...rest } = data;
      return { ...rest, academicYear };
    },
  });
}

export function useCreateProject(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<string, ProjectFailure, string>({
    mutationFn: async (title) => {
      try {
        const { data, error } = await supabase.rpc('create_project', { p_title: title.trim() });
        if (error) throw error;
        return data;
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ownProjectsKey(userId) }),
  });
}

/** Only the columns clients have UPDATE grants on (ADR 0011); anything else fails to compile. */
type EditableColumns = Required<
  Pick<
    Tables['projects']['Update'],
    'title' | 'summary' | 'description' | 'track' | 'sectors' | 'academic_year'
  >
>;

export function toColumns(values: ProjectValues) {
  return {
    title: values.title.trim(),
    summary: values.summary.trim() || null,
    description: values.description.trim() || null,
    track: values.track || null,
    sectors: values.sectors,
    academic_year: values.academicYear || null,
  } satisfies EditableColumns;
}

/**
 * Saves the editable fields. The update must touch exactly one row: RLS turns it into a no-op once
 * the project is no longer editable, which counts as notEditable.
 */
export function useUpdateProject(project: Project, userId: string) {
  const queryClient = useQueryClient();
  return useMutation<Project, ProjectFailure, ProjectValues>({
    mutationFn: async (values) => {
      try {
        const columns = toColumns(values);
        const { data, error } = await supabase
          .from('projects')
          .update(columns)
          .eq('id', project.id)
          .select('id');
        if (error) throw error;
        if (data.length !== 1) throw new ProjectFailure('notEditable');
        const { academic_year: academicYear, ...rest } = columns;
        return { ...project, ...rest, academicYear };
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(projectKey(project.id), saved);
      void queryClient.invalidateQueries({ queryKey: ownProjectsKey(userId) });
    },
    onError: (error) => {
      // The status changed underneath the form: reload, so the page shows what is true now.
      if (error.kind === 'notEditable') {
        void queryClient.invalidateQueries({ queryKey: projectKey(project.id) });
      }
    },
  });
}

export function useDeleteProject(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<null, ProjectFailure, string>({
    mutationFn: async (id) => {
      try {
        const { error } = await supabase.rpc('delete_project', { p_project_id: id });
        if (error) throw error;
        return null;
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSuccess: (_data, id) => {
      // null, not removed: removing a query the page still observes would refetch it.
      queryClient.setQueryData(projectKey(id), null);
      void queryClient.invalidateQueries({ queryKey: ownProjectsKey(userId) });
    },
  });
}
