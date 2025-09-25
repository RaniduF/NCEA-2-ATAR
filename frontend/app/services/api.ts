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
  grade: Grade;
  year_achieved?: number | null;
  weight_applied: number;
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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function getSuggestions(q: string): Promise<SuggestionsResponse> {
  const url = `${API_BASE}/api/v1/suggestions/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch suggestions');
  return res.json();
}

export async function searchStandards(q: string): Promise<StandardsSearchResponse> {
  const url = `${API_BASE}/api/v1/standards/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to search standards');
  return res.json();
}

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
  return data.results as ATARResult[];
}

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

export async function getAvailableYears(standardNumber: number, version?: number): Promise<number[]> {
  const url = `${API_BASE}/api/v1/standards/${standardNumber}/available-years${version ? `?version=${version}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch available years');
  const data = await res.json();
  return data.available_years;
}

export async function getAvailableVersions(standardNumber: number): Promise<number[]> {
  const url = `${API_BASE}/api/v1/standards/${standardNumber}/available-versions`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch available versions');
  const data = await res.json();
  return data.available_versions;
} 