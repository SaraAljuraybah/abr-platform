import { z } from '@/lib/zod-i18n';
import {
  ACADEMIC_YEARS,
  NEEDS,
  PROJECT_LIMITS as L,
  SECTORS,
  SPECIALIZATIONS,
  STAGES,
  TRACKS,
  URL_PATTERNS,
} from './options';

/**
 * Form state of the edit page. Selects and radios hold '' until chosen; links hold '' when empty.
 * Messages are i18n keys (zod-i18n). The image and document are not form fields: they save on
 * their own when uploaded.
 */
export interface ProjectValues {
  title: string;
  summary: string;
  description: string;
  track: string;
  sectors: string[];
  academicYear: string;
  stage: string;
  teamSize: number;
  lookingForMembers: boolean;
  wantedSpecializations: string[];
  needs: string[];
  videoUrl: string;
  repoUrl: string;
  demoUrl: string;
}

// min(1) first, so an empty title says "required" rather than "too short".
const title = z.string().trim().min(1).min(L.title.min).max(L.title.max);

export const newProjectSchema = z.object({ title });
export type NewProjectValues = z.infer<typeof newProjectSchema>;

/** Empty, or a link matching the database CHECK for that column. */
const link = (pattern: RegExp, message: string) =>
  z
    .string()
    .trim()
    .max(L.url.max)
    .refine((value) => value === '' || pattern.test(value), { message });

export const projectSchema = z.object({
  title,
  summary: z.string().trim().max(L.summary.max),
  description: z.string().trim().max(L.description.max),
  track: z.union([z.enum(TRACKS), z.literal('')]),
  sectors: z.array(z.enum(SECTORS)).max(L.sectors.max),
  academicYear: z.union([z.enum(ACADEMIC_YEARS), z.literal('')]),
  stage: z.union([z.enum(STAGES), z.literal('')]),
  teamSize: z.number().int().min(L.teamSize.min).max(L.teamSize.max),
  lookingForMembers: z.boolean(),
  wantedSpecializations: z.array(z.enum(SPECIALIZATIONS)).max(L.wantedSpecializations.max),
  needs: z.array(z.enum(NEEDS)).max(L.needs.max),
  videoUrl: link(URL_PATTERNS.videoUrl, 'validation.videoUrl'),
  repoUrl: link(URL_PATTERNS.repoUrl, 'validation.repoUrl'),
  demoUrl: link(URL_PATTERNS.demoUrl, 'validation.demoUrl'),
});
