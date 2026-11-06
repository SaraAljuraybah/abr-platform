/**
 * Project option codes and limits (SCRUM-18). Sectors reuse the onboarding interest codes and the
 * academic year the shared graduation-year list. options.test.ts compares every list and limit
 * with the CHECK constraints in supabase/migrations/20261105223146_projects.sql. Labels live in
 * src/locales: projects.options.track, onboarding.options.interest and the graduation years.
 */
import { GRADUATION_YEARS, INTERESTS } from '@/features/onboarding/options';
import { Constants, type Database } from '@/types/database';

export const TRACKS = [
  'ai',
  'web',
  'mobile',
  'cyber',
  'data',
  'iot',
  'games',
  'cloud',
  'robotics',
  'other',
] as const;
export const SECTORS = INTERESTS;
export const ACADEMIC_YEARS = GRADUATION_YEARS;

export type ProjectStatus = Database['public']['Enums']['project_status'];
export const PROJECT_STATUSES = Constants.public.Enums.project_status;

/** The statuses in which the owner may edit (policy projects_update_own). */
export const EDITABLE_STATUSES: readonly ProjectStatus[] = ['draft', 'changes_requested'];
export const isEditable = (status: ProjectStatus) => EDITABLE_STATUSES.includes(status);

export const projectEditPath = (id: string) => `/app/projects/${id}/edit`;

export const PROJECT_LIMITS = {
  title: { min: 3, max: 140 },
  summary: { max: 300 },
  description: { max: 5000 },
  sectors: { max: 5 },
} as const;
