export type Grade = 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved';

export interface Standard {
  standard_number: number;
  title: string;
  credits: number;
  assessment_type: string | null;
  standards_type: string | null;
  is_ue: boolean;
  subject: string | null;
}

export interface StandardGroup {
  name: string;
  standards: Standard[];
}

export interface SuggestionsResponse {
  subjects: string[];
  standards: string[];
}

export interface StandardsSearchResponse {
  direct_results: Standard[];
  related_groups: StandardGroup[];
  suggestion: null | { type: string; value: string };
  subject_match: null | { name: string; standards: Standard[] };
}

export interface ATARResult {
  year: number;
  estimated_atar: number;
  statistical_value: number;
}

// --- Breakdown types ---
export interface StandardContribution {
  selection_rank: number;
  standard_number: number;
  title?: string | null;
  subject?: string | null;
  is_ue?: boolean;
  standards_type?: string | null;
  assessment_type?: string | null;  // Internal or External from database
  grade: Grade;
  year_achieved?: number | null;
  weight_applied: number;
  weight_at_max_grade?: number | null;  // Weight if standard was at Excellence (or Achieved for Unit Standards)
  credits_available: number;
  credits_used: number;
  pro_rated: boolean;
  contribution: number;
  subject_credits_used_to_date: number;
  subject_capped: boolean;
  priority_tier: number;
}

export interface BreakdownTotals {
  total_contribution: number;
  denominator_credits: number;
  total_credits_used: number;
  subject_caps: Record<string, number>;
  prorated_count: number;
}

export interface YearlyBreakdown {
  year: number;
  estimated_atar: number;
  statistical_value: number;
  best90: StandardContribution[];
  totals: BreakdownTotals;
  excluded: { standard_number: number; reason: string }[];
}

export interface SubjectSSPBreakdown {
  subject: string;
  year: number;
  eligible: boolean;
  ssp_score?: number | null;
  denominator_credits: number;
  items: StandardContribution[];
}

export interface CalculationBreakdownResponse {
  years: YearlyBreakdown[];
  subjects: SubjectSSPBreakdown[];
}

export interface DistributionDataPoint {
  statistical_value: number;
  frequency: number;
}

export interface DistributionResponse {
  year: number;
  distribution: DistributionDataPoint[];
  participation_rate: number | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetches subject and standard suggestions matching the query.
 *
 * @param q - Search query string to match against subjects and standards
 * @returns SuggestionsResponse containing matching `subjects` and `standards`
 */
export async function getSuggestions(q: string): Promise<SuggestionsResponse> {
  const url = `${API_BASE}/api/v1/suggestions/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json();
}

/**
 * Search standards matching the provided query string.
 *
 * @param q - The search query to send to the standards endpoint
 * @returns The standards search response containing direct results, related groups, an optional suggestion, and an optional subject match
 */
export async function searchStandards(q: string): Promise<StandardsSearchResponse> {
  const url = `${API_BASE}/api/v1/standards/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to search standards');
  return res.json();
}

/**
 * Calculate estimated ATAR results for a set of standards.
 *
 * @param standards - Array of standards to evaluate. Each item must include `standard_number` and `grade`, and may include `year_achieved` and `standard_version`.
 * @returns An array of ATARResult objects containing year, estimated_atar, and statistical_value for the provided standards; returns an empty array if the response contains no results.
 * @throws Error if the API responds with a non-OK status (includes HTTP status and response text).
 */
export async function calculateATAR(standards: { standard_number: number; grade: Grade; year_achieved?: number; standard_version?: number }[]): Promise<ATARResult[]> {
  const url = `${API_BASE}/api/v1/calculate-atar/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ standards }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to calculate ATAR: ${res.status} ${text}`);
  }
  const data = await res.json();
  // Extract the results array from the response object
  return Array.isArray(data.results) ? data.results : [];
}

/**
 * Fetches a detailed ATAR calculation breakdown for the provided standards.
 *
 * @param standards - An array of standard inputs, each with `standard_number`, `grade`, and optional `year_achieved` and `standard_version`.
 * @returns A CalculationBreakdownResponse containing yearly breakdowns and subject-level SSP breakdowns.
 * @throws Error if the API responds with a non-OK status; the error message includes the HTTP status and response text.
 */
export async function calculateATARBreakdown(standards: { standard_number: number; grade: Grade; year_achieved?: number; standard_version?: number }[]): Promise<CalculationBreakdownResponse> {
  const url = `${API_BASE}/api/v1/calculate-atar/breakdown`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ standards }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch ATAR breakdown: ${res.status} ${text}`);
  }
  return res.json() as Promise<CalculationBreakdownResponse>;
}

/**
 * Fetches available years for a given standard, optionally scoped to a specific version.
 *
 * @param standardNumber - The numeric identifier of the standard
 * @param version - Optional standard version to filter available years
 * @returns An array of available years for the requested standard or version
 * @throws Error if the network request fails or returns a non-OK response
 */
export async function getAvailableYears(standardNumber: number, version?: number): Promise<number[]> {
  const url = `${API_BASE}/api/v1/standards/${standardNumber}/available-years${version ? `?version=${version}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch available years');
  const data = await res.json();
  return data.available_years;
}

/**
 * Fetches the available version numbers for a given standard.
 *
 * @param standardNumber - The numeric identifier of the standard
 * @returns An array of available version numbers for the specified standard
 * @throws If the HTTP request fails or returns a non-OK response
 */
export async function getAvailableVersions(standardNumber: number): Promise<number[]> {
  const url = `${API_BASE}/api/v1/standards/${standardNumber}/available-versions`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch available versions');
  const data = await res.json();
  return data.available_versions;
}

/**
 * Fetches the ATAR distribution data for a given academic year.
 *
 * @param year - The academic year to fetch distribution data for
 * @returns Distribution data including statistical values, frequencies, and participation rate
 * @throws If the HTTP request fails or returns a non-OK response
 */
export async function getDistribution(year: number): Promise<DistributionResponse> {
  const url = `${API_BASE}/api/v1/calculate-atar/distributions/${year}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch distribution data');
  return res.json();
} 