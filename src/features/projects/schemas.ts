import { z } from '@/lib/zod-i18n';
import { ACADEMIC_YEARS, PROJECT_LIMITS as L, SECTORS, TRACKS } from './options';

/** Form state of the edit page. Selects hold '' until chosen. Messages are i18n keys (zod-i18n). */
export interface ProjectValues {
  title: string;
  summary: string;
  description: string;
  track: string;
  sectors: string[];
  academicYear: string;
}

// min(1) first, so an empty title says "required" rather than "too short".
const title = z.string().trim().min(1).min(L.title.min).max(L.title.max);

export const newProjectSchema = z.object({ title });
export type NewProjectValues = z.infer<typeof newProjectSchema>;

export const projectSchema = z.object({
  title,
  summary: z.string().trim().max(L.summary.max),
  description: z.string().trim().max(L.description.max),
  track: z.union([z.enum(TRACKS), z.literal('')]),
  sectors: z.array(z.enum(SECTORS)).max(L.sectors.max),
  academicYear: z.union([z.enum(ACADEMIC_YEARS), z.literal('')]),
});
