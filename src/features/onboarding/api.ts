import { OTHER } from '@shared/interest-options';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ownProfileKey, type OwnProfile } from '@/features/auth/profile-api';
import { type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';
import { GITHUB_URL_PATTERN, normalizeGithubUrl, type OnboardingStep } from './options';
import { type OnboardingValues } from './schemas';

export interface OnboardingData {
  /** Steps already completed (profiles.onboarding_step, 0–4). */
  completedSteps: number;
  universityName: string | null;
  values: OnboardingValues;
}

export const onboardingKey = (userId: string) => ['onboarding', userId] as const;

/** What the UI may say when a save fails. Technical detail goes to the console. */
export type SaveErrorKind = 'network' | 'unexpected';
export class SaveFailure extends Error {
  constructor(readonly kind: SaveErrorKind) {
    super(kind);
    this.name = 'SaveFailure';
  }
}
function toSaveFailure(error: unknown): SaveFailure {
  if (error instanceof SaveFailure) return error;
  if (error instanceof TypeError) return new SaveFailure('network');
  console.error('Onboarding save failed', error);
  return new SaveFailure('unexpected');
}

/** The student's own rows (RLS) plus the university name, as form values. */
export function useOnboardingData(userId: string, language: Language) {
  return useQuery({
    queryKey: onboardingKey(userId),
    // The form keeps its own state once loaded; never refetch underneath it.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [profile, student] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, bio, onboarding_step')
          .eq('id', userId)
          .single(),
        supabase
          .from('student_profiles')
          .select(
            'major, major_other, academic_level, graduation_year, skills, interests, github_url, universities(name_ar, name_en)',
          )
          .eq('user_id', userId)
          .single(),
      ]);
      if (profile.error) throw profile.error;
      if (student.error) throw student.error;
      return { profile: profile.data, student: student.data };
    },
    select: ({ profile, student }): OnboardingData => ({
      completedSteps: profile.onboarding_step,
      universityName: universityName(student.universities, language),
      values: {
        fullName: profile.full_name ?? '',
        bio: profile.bio ?? '',
        major: student.major ?? '',
        majorOther: student.major_other ?? '',
        academicLevel: student.academic_level ?? '',
        graduationYear: student.graduation_year ?? '',
        skills: student.skills,
        interests: student.interests,
        githubUrl: student.github_url ?? '',
      },
    }),
  });
}

type Tables = Database['public']['Tables'];
/** Only the columns clients have UPDATE grants on (ADR 0011); anything else fails to compile. */
interface StepColumns {
  profiles?: Pick<Tables['profiles']['Update'], 'full_name' | 'bio'>;
  student?: Pick<
    Tables['student_profiles']['Update'],
    | 'major'
    | 'major_other'
    | 'academic_level'
    | 'graduation_year'
    | 'skills'
    | 'interests'
    | 'github_url'
  >;
}

/** RLS shows active universities only, so the embedded row can be missing at run time. */
function universityName(
  row: { name_ar: string; name_en: string } | null,
  language: Language,
): string | null {
  if (!row) return null;
  return language === 'ar' ? row.name_ar : row.name_en;
}

/** Columns each step writes. */
function stepColumns(step: OnboardingStep, v: OnboardingValues): StepColumns {
  switch (step) {
    case 'about':
      return { profiles: { full_name: v.fullName.trim(), bio: v.bio.trim() || null } };
    case 'studies':
      return {
        student: {
          major: v.major,
          major_other: v.major === OTHER ? v.majorOther.trim() : null,
          academic_level: v.academicLevel,
          graduation_year: v.graduationYear,
        },
      };
    case 'skills':
      return { student: { skills: v.skills, interests: v.interests } };
    case 'links': {
      const url = normalizeGithubUrl(v.githubUrl);
      return { student: { github_url: url && GITHUB_URL_PATTERN.test(url) ? url : null } };
    }
  }
}

interface SaveStepInput {
  step: OnboardingStep;
  /** The new profiles.onboarding_step: the furthest step completed (never lowered on Back). */
  progress: number;
  values: OnboardingValues;
  /** The last step also marks onboarding complete. */
  finish: boolean;
}

/**
 * Saves one step: its data first, then progress, so a refresh never skips unsaved data. Each
 * update must touch exactly one row; RLS turning it into a no-op counts as a failure.
 */
export function useSaveStep(userId: string) {
  const queryClient = useQueryClient();
  return useMutation<null, SaveFailure, SaveStepInput>({
    mutationFn: async ({ step, progress: completed, values, finish }) => {
      try {
        const columns = stepColumns(step, values);
        if (columns.student) {
          const { data, error } = await supabase
            .from('student_profiles')
            .update(columns.student)
            .eq('user_id', userId)
            .select('user_id');
          if (error) throw error;
          if (data.length !== 1) throw new Error('student profile not updated');
        }
        const progress = {
          ...columns.profiles,
          onboarding_step: completed,
          ...(finish ? { onboarding_completed: true } : {}),
        };
        const { data, error } = await supabase
          .from('profiles')
          .update(progress)
          .eq('id', userId)
          .select('id');
        if (error) throw error;
        if (data.length !== 1) throw new Error('profile not updated');
        return null;
      } catch (error) {
        throw toSaveFailure(error);
      }
    },
    onSuccess: (_data, { finish }) => {
      // The guards read onboarded from the profile; update it now so /app opens straight away.
      if (finish) {
        queryClient.setQueryData<OwnProfile | null>(ownProfileKey(userId), (old) =>
          old ? { ...old, onboarded: true } : old,
        );
      }
    },
  });
}
