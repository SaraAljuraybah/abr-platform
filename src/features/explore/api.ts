import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { type Project, toProject } from '@/features/projects/api';
import { SIGNED_URL_SECONDS, signedUrls } from '@/features/projects/storage';
import { type Language } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { type DirectoryFilters, isUuid, PAGE_SIZE, searchFilter } from './search-params';

/**
 * The projects directory (SCRUM-20). RLS (projects_select, D-15) is the only gate: for a verified
 * viewer it returns published projects whose owner is verified, and nothing to anyone else.
 *
 * The two explicit filters below (status = published, owner verified) are NOT security. They are
 * there because the same policy also shows an owner their own drafts and an admin every project,
 * and neither belongs in the directory. The owner embed is !inner, so a project whose owner row is
 * hidden by profiles_select never appears either.
 */

const one = <T>(value: T | T[] | null): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : value;

export const directoryKeys = {
  list: (filters: DirectoryFilters) => ['projects', 'directory', filters] as const,
  detail: (id: string) => ['projects', 'directory', 'detail', id] as const,
};

export interface DirectoryCard {
  id: string;
  title: string;
  track: string | null;
  stage: string | null;
  sectors: string[];
  teamSize: number;
  lookingForMembers: boolean;
  imagePath: string | null;
  ownerName: string | null;
}

export interface DirectoryPage {
  cards: DirectoryCard[];
  total: number;
  offset: number;
}

/** One page of cards and the total number of matches. */
export async function fetchDirectoryPage(
  filters: DirectoryFilters,
  offset: number,
): Promise<DirectoryPage> {
  let query = supabase
    .from('projects')
    .select(
      'id, title, track, stage, sectors, team_size, looking_for_members, image_path, owner:profiles!projects_owner_id_fkey!inner(full_name, verification_status)',
      { count: 'exact' },
    )
    .eq('status', 'published')
    .eq('owner.verification_status', 'verified');

  const search = searchFilter(filters.q);
  if (search) query = query.or(search);
  if (filters.track) query = query.eq('track', filters.track);
  if (filters.stage) query = query.eq('stage', filters.stage);
  if (filters.sectors.length > 0) query = query.overlaps('sectors', filters.sectors);
  if (filters.needs.length > 0) query = query.overlaps('needs', filters.needs);
  if (filters.university) query = query.eq('university_id', filters.university);
  if (filters.lookingForMembers) query = query.eq('looking_for_members', true);

  // id breaks ties, so "Load more" never repeats or skips a card between pages.
  query =
    filters.sort === 'title'
      ? query.order('title', { ascending: true }).order('id', { ascending: true })
      : query
          .order('published_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false });

  const { data, error, count } = await query.range(offset, offset + PAGE_SIZE - 1);
  if (error) throw error;
  return {
    offset,
    total: count ?? 0,
    cards: data.map((row) => ({
      id: row.id,
      title: row.title,
      track: row.track,
      stage: row.stage,
      sectors: row.sectors,
      teamSize: row.team_size,
      lookingForMembers: row.looking_for_members,
      imagePath: row.image_path,
      ownerName: one(row.owner)?.full_name ?? null,
    })),
  };
}

/** Cards 24 at a time. Disabled for a viewer who is not verified: nothing is sent at all. */
export function useDirectory(filters: DirectoryFilters, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: directoryKeys.list(filters),
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchDirectoryPage(filters, pageParam),
    getNextPageParam: (last) =>
      last.offset + PAGE_SIZE < last.total ? last.offset + PAGE_SIZE : undefined,
    // Typing a search keeps the current cards on screen until the new ones arrive.
    placeholderData: keepPreviousData,
  });
}

/**
 * Signed URLs for the images of one page of cards, in ONE request, renewed before they expire.
 * A missing entry means "show the generated default".
 */
export function usePageImageUrls(paths: string[]) {
  return useQuery({
    queryKey: ['projects', 'file-urls', 'image', paths],
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_SECONDS - 60) * 1000,
    refetchInterval: (SIGNED_URL_SECONDS - 60) * 1000,
    queryFn: () => signedUrls('image', paths),
  });
}

export interface DirectoryProject extends Project {
  ownerName: string | null;
  universityName: string | null;
  /** A field-of-study code, or null; `majorOther` holds the text when the code is "other". */
  major: string | null;
  majorOther: string | null;
}

/**
 * One published project with its owner. null when it does not exist, is not published, its owner
 * is not verified, or RLS hides it: the page shows the same "not found" for all of them.
 */
export function useDirectoryProject(id: string, language: Language, enabled: boolean) {
  return useQuery({
    queryKey: directoryKeys.detail(id),
    enabled,
    queryFn: async () => {
      // Not a uuid: it cannot exist, and the database would answer with an error instead.
      if (!isUuid(id)) return null;
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, title, status, track, image_path, summary, description, sectors, academic_year, stage, team_size, looking_for_members, wanted_specializations, needs, document_path, video_url, repo_url, demo_url, owner:profiles!projects_owner_id_fkey!inner(full_name, verification_status, student:student_profiles(major, major_other)), university:universities(name_en, name_ar)',
        )
        .eq('id', id)
        .eq('status', 'published')
        .eq('owner.verification_status', 'verified')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    select: (row): DirectoryProject | null => {
      if (!row) return null;
      const { owner, university, ...project } = row;
      const person = one(owner);
      const student = one(person?.student ?? null);
      const uni = one(university);
      return {
        ...toProject(project),
        ownerName: person?.full_name ?? null,
        universityName: uni ? (language === 'ar' ? uni.name_ar : uni.name_en) : null,
        major: student?.major ?? null,
        majorOther: student?.major_other ?? null,
      };
    },
  });
}
