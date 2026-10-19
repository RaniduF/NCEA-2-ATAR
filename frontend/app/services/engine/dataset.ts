// Shapes of the static JSON files produced by scripts/export_static_data.py,
// and helpers to index them for the engine. Everything here is pure (no fetch)
// so the engine can also be run under Node for parity testing.

export interface SearchKeywords {
  primary?: string[];
  groups?: string[];
}

export interface StandardRecord {
  standard_number: number;
  title: string;
  credits: number;
  assessment_type: string | null;
  standards_type: string | null;
  is_ue: boolean;
  subject: string | null;
  search_keywords: SearchKeywords | null;
}

export interface WeightingRecord {
  standard_number: number;
  academic_year: number;
  standard_version: number;
  weight_not_achieved: number | null;
  weight_achieved: number | null;
  weight_merit: number | null;
  weight_excellence: number | null;
}

export interface YearAtarData {
  min_value: number;
  /** [[min statistical value of the run, ATAR], ...] in descending value order; null if no participation data. */
  bands: [number, number][] | null;
  weighted_statnz_population: number | null;
  nz_total_candidature: number | null;
  participation_rate: number | null;
  histogram: {
    bins: [number, number][];
    min_value: number;
    max_value: number;
    total_frequency: number;
  };
}

export interface RawStandardsFile {
  /** Search alias -> standard number (backend/app/data/search_overrides.json). */
  aliases: Record<string, string>;
  columns: string[];
  rows: unknown[][];
}

export interface RawWeightingsFile {
  latest_year: number | null;
  columns: string[];
  rows: unknown[][];
}

export interface RawAtarFile {
  epsilon: number;
  years: Record<string, YearAtarData>;
}

export interface StandardsIndex {
  /** Physical (ctid) order, matching unordered Postgres scans in the backend. */
  list: StandardRecord[];
  byNumber: Map<number, StandardRecord>;
  /** Lower-cased subject names. */
  subjectsLower: Set<string>;
  aliases: Map<string, string>;
}

export interface WeightingsIndex {
  /** Per standard, in physical (ctid) order. */
  byStandard: Map<number, WeightingRecord[]>;
  latestYear: number | null;
}

export interface AtarIndex {
  epsilon: number;
  /** Keyed by academic year, in the order the backend iterates them. */
  years: Map<number, YearAtarData>;
}

function rowsToObjects<T>(columns: string[], rows: unknown[][]): T[] {
  return rows.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

export function indexStandards(raw: RawStandardsFile): StandardsIndex {
  const list = rowsToObjects<StandardRecord>(raw.columns, raw.rows);
  const byNumber = new Map<number, StandardRecord>();
  const subjectsLower = new Set<string>();
  for (const s of list) {
    byNumber.set(s.standard_number, s);
    if (s.subject) subjectsLower.add(s.subject.toLowerCase());
  }
  return { list, byNumber, subjectsLower, aliases: new Map(Object.entries(raw.aliases)) };
}

export function indexWeightings(raw: RawWeightingsFile): WeightingsIndex {
  const byStandard = new Map<number, WeightingRecord[]>();
  for (const w of rowsToObjects<WeightingRecord>(raw.columns, raw.rows)) {
    let list = byStandard.get(w.standard_number);
    if (!list) {
      list = [];
      byStandard.set(w.standard_number, list);
    }
    list.push(w);
  }
  return { byStandard, latestYear: raw.latest_year };
}

export function indexAtar(raw: RawAtarFile): AtarIndex {
  const years = new Map<number, YearAtarData>();
  for (const key of Object.keys(raw.years).map(Number).sort((a, b) => a - b)) {
    years.set(key, raw.years[String(key)]);
  }
  return { epsilon: raw.epsilon, years };
}
