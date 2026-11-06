import { useQuery } from '@tanstack/react-query';
import { ownProjectsQuery, type ProjectSummary } from '@/features/projects/api';
import type { ProjectStatus } from '@/features/projects/options';

/**
 * What the "What's next" card shows: nothing yet, or the student's latest project by status.
 * WhatsNextCard switches exhaustively over every status, so a state that is not rendered fails to
 * compile. Page 8 (submission and review) adds the copy for the states after draft.
 */
export type NextStep = { kind: 'none' } | { kind: ProjectStatus; projectId: string };

export function nextStepFor(projects: readonly ProjectSummary[]): NextStep {
  const latest = projects[0];
  return latest ? { kind: latest.status, projectId: latest.id } : { kind: 'none' };
}

/** The student's own projects (the same cached query as "Your projects"), as the next step. */
export function useNextStep(userId: string) {
  return useQuery({ ...ownProjectsQuery(userId), select: nextStepFor });
}
