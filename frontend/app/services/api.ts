// Public data API used by the UI. There is no backend in the static (GitHub Pages)
// build: every function below runs the client-side port of the FastAPI endpoint it
// is named after (see ./engine) against the bundled database snapshot (./static-data).
// Signatures and return shapes are unchanged from the HTTP client this replaced.

import { ATARCalculator } from './engine/atar-engine';
import * as search from './engine/search';
import type {
  ATARResult,
  CalculationBreakdownResponse,
  DistributionResponse,
  Grade,
  StandardsSearchResponse,
  SuggestionsResponse,
  UserStandardInput,
} from './engine/types';
import { loadAtar, loadStandards, loadWeightings } from './static-data';

export type {
  ATARResult,
  BreakdownTotals,
  CalculationBreakdownResponse,
  DistributionResponse,
  ExcludedItem,
  Grade,
  HistogramBin,
  Standard,
  StandardContribution,
  StandardGroup,
  StandardsSearchResponse,
  SubjectSSPBreakdown,
  SuggestionsResponse,
  YearlyBreakdown,
} from './engine/types';
export { prefetchStaticData } from './static-data';

type StandardInput = { standard_number: number; grade: Grade; year_achieved?: number; standard_version?: number };

const versionsCache = new Map<number, Promise<number[]>>();
const yearsCache = new Map<string, Promise<number[]>>();

/** Memoise per key; failed lookups are evicted so they can be retried. */
function cached<K, V>(cache: Map<K, Promise<V>>, key: K, compute: () => Promise<V>): Promise<V> {
  const hit = cache.get(key);
  if (hit) return hit;
  const promise = compute().catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, promise);
  return promise;
}

async function makeCalculator(standards: StandardInput[]): Promise<ATARCalculator> {
  const [standardsIndex, weightings, atar] = await Promise.all([loadStandards(), loadWeightings(), loadAtar()]);
  return new ATARCalculator(standards as UserStandardInput[], standardsIndex, weightings, atar);
}

/**
 * Fetches subject and standard suggestions matching the query.
 *
 * @param q - Search query string to match against subjects and standards
 * @returns SuggestionsResponse containing matching `subjects` and `standards`
 */
export async function getSuggestions(q: string): Promise<SuggestionsResponse> {
  return search.getSuggestions(await loadStandards(), q);
}

/**
 * Search standards matching the provided query string.
 *
 * @param q - The search query
 * @returns The standards search response containing direct results, related groups, an optional suggestion, and an optional subject match
 */
export async function searchStandards(q: string): Promise<StandardsSearchResponse> {
  return search.searchStandards(await loadStandards(), q);
}

/**
 * Calculate estimated ATAR results for a set of standards.
 *
 * @param standards - Array of standards to evaluate. Each item must include `standard_number` and `grade`, and may include `year_achieved` and `standard_version`.
 * @returns An array of ATARResult objects containing year, estimated_atar, and statistical_value for the provided standards.
 * @throws Error if no standards are provided or no year could be calculated.
 */
export async function calculateATAR(standards: StandardInput[]): Promise<ATARResult[]> {
  if (!standards.length) throw new Error('Failed to calculate ATAR: No standards provided');
  const results = (await makeCalculator(standards)).calculateForAllYears();
  if (!results.length) {
    throw new Error('Failed to calculate ATAR: Could not calculate ATAR for any year with the provided standards.');
  }
  return results;
}

/**
 * Computes a detailed ATAR calculation breakdown for the provided standards.
 *
 * @param standards - An array of standard inputs, each with `standard_number`, `grade`, and optional `year_achieved` and `standard_version`.
 * @returns A CalculationBreakdownResponse containing yearly breakdowns and subject-level SSP breakdowns.
 * @throws Error if no standards are provided or no year could be calculated.
 */
export async function calculateATARBreakdown(standards: StandardInput[]): Promise<CalculationBreakdownResponse> {
  if (!standards.length) throw new Error('Failed to fetch ATAR breakdown: No standards provided');
  const breakdown = (await makeCalculator(standards)).calculateBreakdown();
  if (!breakdown.years.length) {
    throw new Error('Failed to fetch ATAR breakdown: Could not calculate ATAR breakdown for any year with the provided standards.');
  }
  return breakdown;
}

/**
 * Available years for a given standard, optionally scoped to a specific version.
 *
 * @param standardNumber - The numeric identifier of the standard
 * @param version - Optional standard version to filter available years
 * @returns An array of available years for the requested standard or version, newest first
 */
export async function getAvailableYears(standardNumber: number, version?: number): Promise<number[]> {
  return cached(yearsCache, `${standardNumber}-${version || 'any'}`, async () =>
    search.getAvailableYears(await loadWeightings(), standardNumber, version || null));
}

/**
 * Available version numbers for a given standard.
 *
 * @param standardNumber - The numeric identifier of the standard
 * @returns An array of available version numbers, newest first
 */
export async function getAvailableVersions(standardNumber: number): Promise<number[]> {
  return cached(versionsCache, standardNumber, async () =>
    search.getAvailableVersions(await loadWeightings(), standardNumber));
}

/**
 * ATAR distribution data for a given academic year, pre-binned for the histogram.
 *
 * @param year - The academic year to fetch distribution data for
 * @returns Histogram bins and participation data for that year
 * @throws If there is no distribution data for the year
 */
export async function getDistribution(year: number): Promise<DistributionResponse> {
  const data = (await loadAtar()).years.get(year);
  if (!data) throw new Error('Failed to fetch distribution data');
  return {
    year,
    bins: data.histogram.bins.map(([value, freq]) => ({ value, freq })),
    min_value: data.histogram.min_value,
    max_value: data.histogram.max_value,
    total_frequency: data.histogram.total_frequency,
    weighted_statnz_population: data.weighted_statnz_population,
    nz_total_candidature: data.nz_total_candidature,
    participation_rate: data.participation_rate,
  };
}
