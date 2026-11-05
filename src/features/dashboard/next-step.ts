/**
 * What the "What's next" card shows. Every state the project journey will have is typed now, so
 * pages 6–8 only add data and a case in WhatsNextCard; the switch there is exhaustive, so a new
 * state that is not rendered fails to compile.
 */
export type NextStep =
  | { kind: 'none' }
  | { kind: 'draft'; projectId: string }
  | { kind: 'pending_review'; projectId: string }
  | { kind: 'changes_requested'; projectId: string }
  | { kind: 'published'; projectId: string };

/**
 * TODO(SCRUM-17): read the student's own latest project once the projects table exists. Until
 * then there is no project, so nothing is queried.
 */
export function useNextStep(): { data: NextStep; isPending: false } {
  return { data: { kind: 'none' }, isPending: false };
}
