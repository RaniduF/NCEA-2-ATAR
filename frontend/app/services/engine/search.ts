// Client-side port of backend/app/api/suggestions.py and backend/app/api/standards.py.
// Postgres queries without ORDER BY are mirrored by iterating rows in physical
// (ctid) order, which is the order the exported JSON is written in.

import type { StandardRecord, StandardsIndex, WeightingsIndex } from './dataset';
import { extractOne } from './fuzz';
import { compareCodePoints, pyIsDigit, pyLen, pySlice, pySortBy, pyTitle } from './py';
import type { StandardGroup, StandardsSearchResponse, SuggestionsResponse } from './types';

const MAX_QUERY_LENGTH = 100;

/**
 * Step 3 of the backend's standards search ("keyword search") never matches anything:
 * standards.py does `cast(json.dumps([term]), JSONB)`, and SQLAlchemy JSON-encodes that
 * string a second time, so Postgres tests the keyword array against a JSON *string*.
 * Kept off to match the behaviour the backend actually has; set to true to enable the
 * intended exact-keyword lookup (and fix standards.py by dropping the json.dumps).
 */
const KEYWORD_LOOKUP_ENABLED = false;

/** Same fields FastAPI serialises from the ORM object. */
function toResponseStandard(s: StandardRecord) {
  return { ...s };
}

function standardsForSubject(standards: StandardsIndex, subjectLower: string): StandardRecord[] {
  return standards.list.filter((s) => s.subject !== null && s.subject.toLowerCase() === subjectLower);
}

function sortedByNumber(list: StandardRecord[]): StandardRecord[] {
  return pySortBy(list, (s) => s.standard_number);
}

export function getSuggestions(standards: StandardsIndex, q: string | null | undefined): SuggestionsResponse {
  if (!q || pyLen(q.trim()) < 2) return { subjects: [], standards: [] };

  let qSanitized = q.trim();
  if (pyLen(qSanitized) > MAX_QUERY_LENGTH) qSanitized = pySlice(qSanitized, MAX_QUERY_LENGTH);

  const searchTerm = qSanitized.toLowerCase();

  // --- 1. Find matching subjects ---
  // SELECT DISTINCT subject ... WHERE lower(subject) LIKE 'term%' (sorted by the DISTINCT)
  const subjectMatches = Array.from(new Set(
    standards.list
      .map((s) => s.subject)
      .filter((subject): subject is string => !!subject && subject.toLowerCase().startsWith(searchTerm)),
  )).sort(compareCodePoints);

  const scoredSubjects: [number, string][] = [];
  for (const subject of subjectMatches) {
    const subjectLower = subject.toLowerCase();
    const lengthPenalty = pyLen(subject);
    const matchRatio = pyLen(searchTerm) / pyLen(subject);
    let wordBonus = 0;
    if (subjectLower.startsWith(searchTerm)) wordBonus = -10;
    const score = lengthPenalty - (matchRatio * 50) + wordBonus;
    scoredSubjects.push([score, subject]);
  }

  const subjects = pySortBy(scoredSubjects, (x) => x[0]).slice(0, 3).map(([, subject]) => subject);

  // --- 2. Find matching standards by keywords or standard numbers ---
  let standardsByNumber: StandardRecord[] = [];
  if (pyIsDigit(searchTerm)) {
    standardsByNumber = standards.list
      .filter((s) => String(s.standard_number).startsWith(searchTerm))
      .slice(0, 5);
  }

  const remainingSlots = Math.max(0, 7 - standardsByNumber.length);
  const excludedNumbers = new Set(standardsByNumber.map((s) => s.standard_number));

  let standardsByKeyword: StandardRecord[] = [];
  if (remainingSlots > 0) {
    standardsByKeyword = sortedByNumber(standards.list.filter((s) =>
      !excludedNumbers.has(s.standard_number) &&
      (s.search_keywords?.primary ?? []).some((kw) => kw.startsWith(searchTerm)),
    )).slice(0, remainingSlots);
  }

  const formattedStandards = [...standardsByNumber, ...standardsByKeyword]
    .map((std) => `${std.standard_number} • ${std.title}`);

  return { subjects, standards: formattedStandards };
}

export function searchStandards(standards: StandardsIndex, q: string | null | undefined): StandardsSearchResponse {
  const empty = { direct_results: [], related_groups: [], suggestion: null };
  if (!q) return empty as unknown as StandardsSearchResponse;

  let qSanitized = q.trim();
  if (pyLen(qSanitized) > MAX_QUERY_LENGTH) qSanitized = pySlice(qSanitized, MAX_QUERY_LENGTH);

  const searchTerm = qSanitized.toLowerCase();

  // --- 1. Subject Match ---
  if (standards.subjectsLower.has(searchTerm)) {
    const subjectStandards = standardsForSubject(standards, searchTerm);
    const internals = sortedByNumber(subjectStandards.filter((s) => s.assessment_type === 'Internal'));
    const externals = sortedByNumber(subjectStandards.filter((s) => s.assessment_type === 'External'));
    const relatedGroups: StandardGroup[] = [];
    if (externals.length) relatedGroups.push({ name: `${pyTitle(q)} Externals`, standards: externals.map(toResponseStandard) });
    if (internals.length) relatedGroups.push({ name: `${pyTitle(q)} Internals`, standards: internals.map(toResponseStandard) });
    return { direct_results: [], related_groups: relatedGroups, suggestion: null } as unknown as StandardsSearchResponse;
  }

  // --- 2. Alias or Standard Number Match ---
  let topStandard: StandardRecord | undefined;
  const numberToFind = standards.aliases.get(searchTerm) || (pyIsDigit(searchTerm) ? searchTerm : null);
  if (numberToFind) {
    topStandard = standards.byNumber.get(Number(numberToFind));
  }

  // --- 3. Keyword Search ---
  if (!topStandard && KEYWORD_LOOKUP_ENABLED) {
    topStandard = standards.list.find((s) => (s.search_keywords?.primary ?? []).includes(searchTerm));
  }

  // --- If a standard was found, return its data and related groups ---
  if (topStandard) {
    const relatedGroups: StandardGroup[] = [];
    const groups = topStandard.search_keywords?.groups;
    if (groups) {
      const subjectCache = new Map<string, StandardRecord[]>();
      for (const groupName of groups) {
        if (!(groupName.endsWith(' Externals') || groupName.endsWith(' Internals'))) continue;

        const subjectName = groupName.split(' Externals').join('').split(' Internals').join('');
        const subjectLower = subjectName.toLowerCase();
        let subjectStandards = subjectCache.get(subjectLower);
        if (!subjectStandards) {
          subjectStandards = standardsForSubject(standards, subjectLower);
          subjectCache.set(subjectLower, subjectStandards);
        }

        const assessment = groupName.endsWith(' Externals') ? 'External' : 'Internal';
        const filtered = sortedByNumber(subjectStandards.filter((s) => s.assessment_type === assessment));
        if (filtered.length) relatedGroups.push({ name: groupName, standards: filtered.map(toResponseStandard) });
      }
    }
    return {
      direct_results: [toResponseStandard(topStandard)],
      related_groups: relatedGroups,
      suggestion: null,
      subject_match: null,
    };
  }

  // --- 4. Fuzzy Search for Suggestions (if all else fails) ---
  // The backend iterates a Python set (arbitrary order); sorting makes ties deterministic.
  const bestMatch = extractOne(searchTerm, Array.from(standards.subjectsLower).sort(compareCodePoints));
  if (bestMatch && bestMatch[1] >= 75) {
    return {
      direct_results: [],
      related_groups: [],
      suggestion: { type: 'subject', value: pyTitle(bestMatch[0]) },
    } as unknown as StandardsSearchResponse;
  }

  // --- Final Fallback: No results and no suggestions ---
  return empty as unknown as StandardsSearchResponse;
}

export function getAvailableYears(weightings: WeightingsIndex, standardNumber: number, version?: number | null): number[] {
  let rows = weightings.byStandard.get(standardNumber) ?? [];
  if (version !== undefined && version !== null) rows = rows.filter((w) => w.standard_version === version);
  return Array.from(new Set(rows.map((w) => w.academic_year))).sort((a, b) => b - a);
}

export function getAvailableVersions(weightings: WeightingsIndex, standardNumber: number): number[] {
  const rows = weightings.byStandard.get(standardNumber) ?? [];
  return Array.from(new Set(rows.map((w) => w.standard_version))).sort((a, b) => b - a);
}
