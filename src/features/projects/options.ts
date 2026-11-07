/**
 * Project option codes and limits (SCRUM-18, SCRUM-27). Sectors reuse the onboarding interest codes
 * and the academic year the shared graduation-year list. options.test.ts compares every list,
 * limit and URL pattern with the CHECK constraints in the projects migrations. Labels live in
 * src/locales: projects.options.*, onboarding.options.interest and the field-of-study names.
 */
import { FIELD_OF_STUDY, GRADUATION_YEARS, INTERESTS } from '@/features/onboarding/options';
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

export const STAGES = ['idea', 'prototype', 'mvp', 'revenue', 'startup'] as const;

/** The field-of-study tech codes keep their names (forms.interest.options.field_of_study). */
export const TECH_SPECIALIZATIONS = FIELD_OF_STUDY.filter(
  (code): code is Exclude<(typeof FIELD_OF_STUDY)[number], 'other'> => code !== 'other',
);
export const SPECIALIZATIONS = [
  ...TECH_SPECIALIZATIONS,
  'design',
  'business',
  'marketing',
  'other',
] as const;

export const NEEDS = [
  'funding',
  'investor',
  'mentor',
  'legal_advisor',
  'financial_advisor',
  'workspace',
  'marketing',
  'design',
  'programming',
  'manufacturing',
  'tech_partner',
] as const;

export type ProjectStatus = Database['public']['Enums']['project_status'];
export const PROJECT_STATUSES = Constants.public.Enums.project_status;

/** The statuses in which the owner may edit (policy projects_update_own). */
export const EDITABLE_STATUSES: readonly ProjectStatus[] = ['draft', 'changes_requested'];
export const isEditable = (status: ProjectStatus) => EDITABLE_STATUSES.includes(status);

export const projectEditPath = (id: string) => `/app/projects/${id}/edit`;

const MB = 1024 * 1024;

export const PROJECT_LIMITS = {
  title: { min: 3, max: 140 },
  summary: { max: 300 },
  description: { max: 5000 },
  sectors: { max: 5 },
  teamSize: { min: 1, max: 10 },
  wantedSpecializations: { max: 8 },
  needs: { max: 11 },
  url: { max: 500 },
} as const;

/**
 * What submit_project() requires, as database column names in form order (its error lists the
 * missing ones in this order). options.test.ts compares the list and the length with the migration.
 */
export const REQUIRED_FOR_SUBMIT = [
  'title',
  'summary',
  'description',
  'track',
  'academic_year',
  'stage',
] as const;
export type RequiredField = (typeof REQUIRED_FOR_SUBMIT)[number];
export const DESCRIPTION_MIN = 100;

/** The form field of each required column (for focusing it from the checklist). */
export const REQUIRED_FORM_FIELD = {
  title: 'title',
  summary: 'summary',
  description: 'description',
  track: 'track',
  academic_year: 'academicYear',
  stage: 'stage',
} as const satisfies Record<RequiredField, string>;

/** The same rule as submit_project(), on the form's current values. */
export function missingForSubmit(values: {
  title: string;
  summary: string;
  description: string;
  track: string;
  academicYear: string;
  stage: string;
}): RequiredField[] {
  return REQUIRED_FOR_SUBMIT.filter((field) => {
    switch (field) {
      case 'description':
        return values.description.trim().length < DESCRIPTION_MIN;
      case 'academic_year':
        return values.academicYear === '';
      default:
        return values[field].trim() === '';
    }
  });
}

/** The two private buckets (migration 20261106090424_project_details_and_media). */
export const PROJECT_FILES = {
  image: {
    bucket: 'project-images',
    maxBytes: 2 * MB,
    types: ['image/jpeg', 'image/png', 'image/webp'],
    /** Images are re-encoded in the browser; the longest side is scaled down to this. */
    maxSide: 1600,
  },
  document: {
    bucket: 'project-documents',
    maxBytes: 10 * MB,
    types: ['application/pdf'],
  },
} as const;
export type ProjectFileKind = keyof typeof PROJECT_FILES;

/** The CHECKs on projects.video_url, repo_url and demo_url, as JavaScript RegExps. */
export const URL_PATTERNS = {
  videoUrl: /^https:\/\/((www|m)\.)?(youtube\.com|youtu\.be|vimeo\.com|loom\.com)\/[^\s]+$/,
  repoUrl: /^https:\/\/(www\.)?(github\.com|gitlab\.com)\/[^\s]+$/,
  demoUrl: /^https:\/\/([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}(\/[^\s]*)?$/,
} as const;
