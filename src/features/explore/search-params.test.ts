import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  containsPattern,
  isFiltered,
  NO_FILTERS,
  parseFilters,
  searchFilter,
  toSearchParams,
} from './search-params';

const UNI = 'aaaaaaaa-0000-4000-8000-000000000001';
const parse = (query: string) => parseFilters(new URLSearchParams(query));

describe('directory URL state', () => {
  it('an empty query is the default directory', () => {
    expect(parse('')).toEqual(NO_FILTERS);
    expect(toSearchParams(NO_FILTERS).toString()).toBe('');
  });

  it('reads every filter and writes the same canonical query back', () => {
    const query = `q=campus&track=ai&stage=mvp&sector=fintech&sector=education&need=mentor&university=${UNI}&members=1&sort=title`;
    const filters = parse(query);
    expect(filters).toEqual({
      q: 'campus',
      track: 'ai',
      stage: 'mvp',
      sectors: ['fintech', 'education'],
      needs: ['mentor'],
      university: UNI,
      lookingForMembers: true,
      sort: 'title',
    });
    expect(toSearchParams(filters).toString()).toBe(query);
    expect(activeFilterCount(filters)).toBe(7);
  });

  it('drops unknown codes, duplicates and a malformed university, and keeps option order', () => {
    const filters = parse(
      'track=hacking&stage=x&sector=education&sector=evil&sector=fintech&sector=education&need=a,b&university=1%20or%201=1&members=yes&sort=drop',
    );
    expect(filters.track).toBeNull();
    expect(filters.stage).toBeNull();
    expect(filters.sectors).toEqual(['fintech', 'education']);
    expect(filters.needs).toEqual([]);
    expect(filters.university).toBeNull();
    expect(filters.lookingForMembers).toBe(false);
    expect(filters.sort).toBe('newest');
  });

  it('trims the search and caps it at 100 characters', () => {
    expect(parse('q=%20%20مشروع%20%20').q).toBe('مشروع');
    expect(parse(`q=${'a'.repeat(150)}`).q).toHaveLength(100);
  });

  it('search alone counts as filtered, sort does not', () => {
    expect(isFiltered({ ...NO_FILTERS, q: 'x' })).toBe(true);
    expect(isFiltered({ ...NO_FILTERS, sort: 'title' })).toBe(false);
    expect(activeFilterCount({ ...NO_FILTERS, q: 'x' })).toBe(0);
  });
});

describe('search filter', () => {
  it('no text, no filter', () => {
    expect(searchFilter('   ')).toBeNull();
  });

  it('English and Arabic text search the title or the summary', () => {
    expect(searchFilter(' Campus ')).toBe('title.ilike."%Campus%",summary.ilike."%Campus%"');
    expect(searchFilter('منصة تعليمية')).toBe(
      'title.ilike."%منصة تعليمية%",summary.ilike."%منصة تعليمية%"',
    );
  });

  it('escapes the LIKE wildcards % and _ and the escape character itself', () => {
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
  });

  it('* (a PostgREST alias of %) matches one character instead of anything', () => {
    expect(containsPattern('a*b')).toBe('%a_b%');
  });

  it('quotes the value, so commas, parentheses, dots, colons and quotes stay text', () => {
    const filter = searchFilter('a,b) or (status.eq.draft "x"');
    expect(filter).toBe(
      'title.ilike."%a,b) or (status.eq.draft \\"x\\"%",summary.ilike."%a,b) or (status.eq.draft \\"x\\"%"',
    );
  });
});
