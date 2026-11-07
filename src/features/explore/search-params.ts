/**
 * The directory's search, filters and sort live in the URL query (SCRUM-20), so a result list can
 * be shared and survives a refresh. Parsing keeps only known codes: a crafted URL can never put an
 * unknown value into the query (the database CHECKs would not match it anyway).
 *
 *   ?q=text&track=ai&stage=mvp&sector=fintech&sector=education&need=mentor
 *    &university=<uuid>&members=1&sort=title
 */
import { NEEDS, SECTORS, STAGES, TRACKS } from '@/features/projects/options';

export const PAGE_SIZE = 24;
export const SEARCH_MAX = 100;
export const SORTS = ['newest', 'title'] as const;
export type SortKey = (typeof SORTS)[number];

export interface DirectoryFilters {
  q: string;
  track: string | null;
  stage: string | null;
  sectors: string[];
  needs: string[];
  university: string | null;
  lookingForMembers: boolean;
  sort: SortKey;
}

export const NO_FILTERS: DirectoryFilters = {
  q: '',
  track: null,
  stage: null,
  sectors: [],
  needs: [],
  university: null,
  lookingForMembers: false,
  sort: 'newest',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID.test(value);

const oneOf = (value: string | null, allowed: readonly string[]) =>
  value !== null && allowed.includes(value) ? value : null;

/** Known codes only, without duplicates, in the canonical option order. */
const manyOf = (values: string[], allowed: readonly string[]) =>
  allowed.filter((code) => values.includes(code));

export function parseFilters(params: URLSearchParams): DirectoryFilters {
  const university = params.get('university');
  return {
    q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    track: oneOf(params.get('track'), TRACKS),
    stage: oneOf(params.get('stage'), STAGES),
    sectors: manyOf(params.getAll('sector'), SECTORS),
    needs: manyOf(params.getAll('need'), NEEDS),
    university: university !== null && isUuid(university) ? university.toLowerCase() : null,
    lookingForMembers: params.get('members') === '1',
    sort: params.get('sort') === 'title' ? 'title' : 'newest',
  };
}

/** The canonical query string: defaults are left out, so a clean directory has a clean URL. */
export function toSearchParams(filters: DirectoryFilters): URLSearchParams {
  const params = new URLSearchParams();
  const q = filters.q.trim();
  if (q) params.set('q', q);
  if (filters.track) params.set('track', filters.track);
  if (filters.stage) params.set('stage', filters.stage);
  for (const sector of filters.sectors) params.append('sector', sector);
  for (const need of filters.needs) params.append('need', need);
  if (filters.university) params.set('university', filters.university);
  if (filters.lookingForMembers) params.set('members', '1');
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  return params;
}

/** How many filters are set (search and sort are not filters). */
export function activeFilterCount(filters: DirectoryFilters): number {
  return (
    (filters.track ? 1 : 0) +
    (filters.stage ? 1 : 0) +
    filters.sectors.length +
    filters.needs.length +
    (filters.university ? 1 : 0) +
    (filters.lookingForMembers ? 1 : 0)
  );
}

export const isFiltered = (filters: DirectoryFilters) =>
  filters.q.trim() !== '' || activeFilterCount(filters) > 0;

/**
 * The user's text as a literal ILIKE "contains" pattern: \ % and _ are escaped (backslash is the
 * default LIKE escape), so "50%" matches the text "50%" and not "50 anything". PostgREST turns
 * every * of a like pattern into %, so * becomes _ (any one character, which includes "*").
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`).replace(/\*/g, '_')}%`;
}

/** A value inside a PostgREST logic filter: double-quoted, with " and \ escaped. */
const quoted = (value: string) => `"${value.replace(/[\\"]/g, (c) => `\\${c}`)}"`;

/**
 * The `or` filter for a search on the title or the summary, or null for no search. Quoting keeps
 * commas, parentheses, dots and colons in the text from being read as filter syntax.
 */
export function searchFilter(q: string): string | null {
  const text = q.trim().slice(0, SEARCH_MAX);
  if (!text) return null;
  const pattern = quoted(containsPattern(text));
  return `title.ilike.${pattern},summary.ilike.${pattern}`;
}
