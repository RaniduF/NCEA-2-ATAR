// Response shapes, identical to the FastAPI backend's JSON responses
// (backend/app/schemas/calculation.py and backend/app/api/*.py).

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

export interface UserStandardInput {
  standard_number: number;
  grade: Grade;
  year_achieved?: number | null;
  standard_version?: number | null;
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
  fallback_reason?: string | null;
}

export interface BreakdownTotals {
  total_contribution: number;
  denominator_credits: number;
  total_credits_used: number;
  subject_caps: Record<string, number>;
  prorated_count: number;
}

export interface ExcludedItem {
  standard_number: number;
  reason: string;
  title?: string | null;
  subject?: string | null;
  grade?: string | null;
  weight_applied?: number | null;
  weight_at_max_grade?: number | null;  // Weight at Excellence (Achievement) or Achieved (Unit Standard)
  standards_type?: string | null;
  assessment_type?: string | null;
  credits_available?: number | null;
  fallback_reason?: string | null;
}

export interface YearlyBreakdown {
  year: number;
  estimated_atar: number;
  statistical_value: number;
  best90: StandardContribution[];
  totals: BreakdownTotals;
  excluded: ExcludedItem[];
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

export interface HistogramBin {
  value: number;
  freq: number;
}

/**
 * The full distribution (tens of thousands of rows per year) is no longer shipped to the
 * browser; it is pre-binned at export time with the same 0.005 bins the histogram used.
 */
export interface DistributionResponse {
  year: number;
  bins: HistogramBin[];
  min_value: number;
  max_value: number;
  total_frequency: number;
  weighted_statnz_population: number | null;
  nz_total_candidature: number | null;
  participation_rate: number | null;
}
