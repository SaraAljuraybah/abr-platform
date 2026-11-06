import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { type ProjectFileKind, type ProjectStatus } from './options';
import type { ProjectValues } from './schemas';
import {
  listProjectObjects,
  objectInfo,
  objectName,
  prepareFile,
  removeObjects,
  signedUrl,
  SIGNED_URL_SECONDS,
  UploadFailure,
  uploadObject,
} from './storage';

type Tables = Database['public']['Tables'];
type Row = Tables['projects']['Row'];

export interface ProjectSummary {
  id: string;
  title: string;
  status: ProjectStatus;
  track: string | null;
  imagePath: string | null;
}

export interface Project extends ProjectSummary {
  summary: string | null;
  description: string | null;
  sectors: string[];
  academicYear: string | null;
  stage: string | null;
  teamSize: number;
  lookingForMembers: boolean;
  wantedSpecializations: string[];
  needs: string[];
  documentPath: string | null;
  videoUrl: string | null;
  repoUrl: string | null;
  demoUrl: string | null;
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

const SUMMARY_COLUMNS = 'id, title, status, track, image_path';
const PROJECT_COLUMNS =
  'id, title, status, track, image_path, summary, description, sectors, academic_year, stage, team_size, looking_for_members, wanted_specializations, needs, document_path, video_url, repo_url, demo_url';

function toProject(
  row: Omit<
    Row,
    'owner_id' | 'university_id' | 'submitted_at' | 'published_at' | 'created_at' | 'updated_at'
  >,
): Project {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    track: row.track,
    imagePath: row.image_path,
    summary: row.summary,
    description: row.description,
    sectors: row.sectors,
    academicYear: row.academic_year,
    stage: row.stage,
    teamSize: row.team_size,
    lookingForMembers: row.looking_for_members,
    wantedSpecializations: row.wanted_specializations,
    needs: row.needs,
    documentPath: row.document_path,
    videoUrl: row.video_url,
    repoUrl: row.repo_url,
    demoUrl: row.demo_url,
  };
}

/** The student's own projects, newest first (RLS is the authority; the filter keeps it to theirs). */
export function ownProjectsQuery(userId: string) {
  return queryOptions({
    queryKey: ownProjectsKey(userId),
    queryFn: async (): Promise<ProjectSummary[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select(SUMMARY_COLUMNS)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        track: row.track,
        imagePath: row.image_path,
      }));
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
        .select(PROJECT_COLUMNS)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data ? toProject(data) : null;
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

/**
 * Only the columns clients have UPDATE grants on (ADR 0011); anything else fails to compile.
 * image_path and document_path are granted too, but written only by the file mutations below.
 */
type EditableColumns = Required<
  Pick<
    Tables['projects']['Update'],
    | 'title'
    | 'summary'
    | 'description'
    | 'track'
    | 'sectors'
    | 'academic_year'
    | 'stage'
    | 'team_size'
    | 'looking_for_members'
    | 'wanted_specializations'
    | 'needs'
    | 'video_url'
    | 'repo_url'
    | 'demo_url'
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
    stage: values.stage || null,
    team_size: values.teamSize,
    looking_for_members: values.lookingForMembers,
    // The CHECK refuses specializations unless the team is looking for members.
    wanted_specializations: values.lookingForMembers ? values.wantedSpecializations : [],
    needs: values.needs,
    video_url: values.videoUrl.trim() || null,
    repo_url: values.repoUrl.trim() || null,
    demo_url: values.demoUrl.trim() || null,
  } satisfies EditableColumns;
}

/** One project row update; RLS turning it into a no-op means the project is no longer editable. */
async function updateProjectRow(id: string, columns: Tables['projects']['Update']) {
  const { data, error } = await supabase.from('projects').update(columns).eq('id', id).select('id');
  if (error) throw error;
  if (data.length !== 1) throw new ProjectFailure('notEditable');
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
        await updateProjectRow(project.id, columns);
        return {
          ...project,
          title: columns.title,
          summary: columns.summary,
          description: columns.description,
          track: columns.track,
          sectors: columns.sectors,
          academicYear: columns.academic_year,
          stage: columns.stage,
          teamSize: columns.team_size,
          lookingForMembers: columns.looking_for_members,
          wantedSpecializations: columns.wanted_specializations,
          needs: columns.needs,
          videoUrl: columns.video_url,
          repoUrl: columns.repo_url,
          demoUrl: columns.demo_url,
        };
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSuccess: (saved) => {
      // Keep the file paths as they are now (they save on their own, maybe while editing).
      queryClient.setQueryData<Project | null>(projectKey(project.id), (current) => ({
        ...saved,
        imagePath: current?.imagePath ?? saved.imagePath,
        documentPath: current?.documentPath ?? saved.documentPath,
      }));
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

// Files ----------------------------------------------------------------------------------------------

const PATH_COLUMN = { image: 'image_path', document: 'document_path' } as const;
const PATH_FIELD = { image: 'imagePath', document: 'documentPath' } as const;

export type FileErrorKind = UploadFailure['kind'] | 'notEditable';

/** A failed upload or removal, with what the UI may say about it. */
export class FileFailure extends Error {
  constructor(readonly kind: FileErrorKind) {
    super(kind);
    this.name = 'FileFailure';
  }
}

/**
 * Upload, replace and remove one project file. Files save immediately (not with the form's Save):
 *   upload the new object → save its path on the project → remove the old object.
 * If saving the path fails, the new object is removed again, so nothing points to a missing file
 * and no new orphan is left. A failed removal of the OLD object is only logged: it is private and
 * unreachable once no path names it (a cleanup job is planned).
 */
export function useProjectFile(project: Project, kind: ProjectFileKind, userId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const current = project[PATH_FIELD[kind]];

  const setPath = (path: string | null) => {
    queryClient.setQueryData<Project | null>(projectKey(project.id), (old) =>
      old ? { ...old, [PATH_FIELD[kind]]: path } : old,
    );
    void queryClient.invalidateQueries({ queryKey: ownProjectsKey(userId) });
  };

  const removeOld = async (old: string | null) => {
    if (!old) return;
    try {
      await removeObjects(kind, [old]);
    } catch (error) {
      console.error('Old project file not removed (orphaned)', error);
    }
  };

  const upload = useMutation<string, FileFailure, File>({
    mutationFn: async (file) => {
      setProgress(0);
      try {
        const prepared = await prepareFile(kind, file);
        const name = objectName(project.id, kind, prepared.extension);
        await uploadObject(kind, name, prepared, setProgress);
        try {
          await updateProjectRow(project.id, { [PATH_COLUMN[kind]]: name });
        } catch (error) {
          await removeObjects(kind, [name]).catch(() => undefined);
          throw error;
        }
        await removeOld(current);
        return name;
      } catch (error) {
        throw toFileFailure(error);
      } finally {
        setProgress(null);
      }
    },
    onSuccess: (name) => {
      setPath(name);
    },
  });

  const remove = useMutation<null, FileFailure>({
    mutationFn: async () => {
      try {
        // The path first: a failure afterwards leaves an orphan, never a path to a missing file.
        await updateProjectRow(project.id, { [PATH_COLUMN[kind]]: null });
        await removeOld(current);
        return null;
      } catch (error) {
        throw toFileFailure(error);
      }
    },
    onSuccess: () => {
      setPath(null);
    },
  });

  return { upload, remove, progress };
}

function toFileFailure(error: unknown): FileFailure {
  if (error instanceof UploadFailure) return new FileFailure(error.kind);
  if (error instanceof ProjectFailure && error.kind === 'notEditable') {
    return new FileFailure('notEditable');
  }
  if (error instanceof TypeError) return new FileFailure('network');
  console.error('Project file failed', error);
  return new FileFailure('unexpected');
}

/** A signed URL for a stored file, renewed before it expires. null path: nothing to show. */
export function useSignedUrl(kind: ProjectFileKind, path: string | null, download?: string) {
  return useQuery({
    queryKey: ['projects', 'file-url', kind, path, download ?? null],
    enabled: Boolean(path),
    staleTime: (SIGNED_URL_SECONDS - 60) * 1000,
    refetchInterval: (SIGNED_URL_SECONDS - 60) * 1000,
    queryFn: () => signedUrl(kind, path ?? '', download),
  });
}

export function useFileInfo(kind: ProjectFileKind, path: string | null) {
  return useQuery({
    queryKey: ['projects', 'file-info', kind, path],
    enabled: Boolean(path),
    queryFn: () => objectInfo(kind, path ?? ''),
  });
}

// Deleting a draft -------------------------------------------------------------------------------

/**
 * Deletes a draft in an order where a failure at any step leaves a consistent project:
 *   1. clear image_path and document_path (a normal update: no path points to a missing file);
 *   2. remove every object in the project's folders (found by listing, so earlier orphans go too);
 *   3. delete_project().
 * After 1 or 2 fail, the project still exists without paths and the student can try again.
 */
export function useDeleteProject(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<null, ProjectFailure, Project>({
    mutationFn: async (project) => {
      try {
        if (project.imagePath || project.documentPath) {
          await updateProjectRow(project.id, { image_path: null, document_path: null });
          queryClient.setQueryData<Project | null>(projectKey(project.id), (old) =>
            old ? { ...old, imagePath: null, documentPath: null } : old,
          );
        }
        for (const kind of ['image', 'document'] as const) {
          await removeObjects(kind, await listProjectObjects(kind, project.id));
        }
        const { error } = await supabase.rpc('delete_project', { p_project_id: project.id });
        if (error) throw error;
        return null;
      } catch (error) {
        throw toFailure(error);
      }
    },
    onSuccess: (_data, project) => {
      // null, not removed: removing a query the page still observes would refetch it.
      queryClient.setQueryData(projectKey(project.id), null);
      void queryClient.invalidateQueries({ queryKey: ownProjectsKey(userId) });
    },
  });
}
