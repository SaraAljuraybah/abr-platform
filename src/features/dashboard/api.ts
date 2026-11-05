import { useQuery } from '@tanstack/react-query';
import type { VerificationStatus } from '@/features/auth/auth-context';
import { type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

export interface StudentDashboard {
  fullName: string | null;
  verificationStatus: VerificationStatus;
  universityName: string | null;
  major: string | null;
  majorOther: string | null;
  academicLevel: string | null;
  graduationYear: string | null;
  skills: string[];
  interests: string[];
  githubUrl: string | null;
}

export const studentDashboardKey = (userId: string) => ['dashboard', 'student', userId] as const;

/**
 * The signed-in student's own rows only: both queries filter by the session user's id, and RLS
 * is the authority. The university name comes embedded (RLS shows active universities only, so it
 * can be missing).
 */
export function useStudentDashboard(userId: string, language: Language) {
  return useQuery({
    queryKey: studentDashboardKey(userId),
    queryFn: async () => {
      const [profile, student] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, verification_status')
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
    select: ({ profile, student }): StudentDashboard => {
      const university = student.universities as { name_ar: string; name_en: string } | null;
      return {
        fullName: profile.full_name,
        verificationStatus: profile.verification_status,
        universityName: university
          ? language === 'ar'
            ? university.name_ar
            : university.name_en
          : null,
        major: student.major,
        majorOther: student.major_other,
        academicLevel: student.academic_level,
        graduationYear: student.graduation_year,
        skills: student.skills,
        interests: student.interests,
        githubUrl: student.github_url,
      };
    },
  });
}

/** The first word of the full name, for the greeting. */
export function firstName(fullName: string | null): string | null {
  return fullName?.trim().split(/\s+/)[0] ?? null;
}
