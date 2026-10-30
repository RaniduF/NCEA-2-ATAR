// Client-side port of backend/app/services/atar_engine.py (ATARCalculator).
// Structure, iteration order, tie-breaking and float arithmetic deliberately
// mirror the Python so results are bit-for-bit identical. If you change the
// backend engine, change this file to match (scripts/check_static_parity.py
// compares the two).

import type { AtarIndex, StandardRecord, StandardsIndex, WeightingRecord, WeightingsIndex } from './dataset';
import { pyMax, pySortBy, pySum } from './py';
import type {
  ATARResult,
  BreakdownTotals,
  CalculationBreakdownResponse,
  ExcludedItem,
  Grade,
  StandardContribution,
  SubjectSSPBreakdown,
  UserStandardInput,
  YearlyBreakdown,
} from './types';

const GRADES: readonly Grade[] = ['Excellence', 'Merit', 'Achieved', 'Not Achieved'];
const GRADE_PRIORITY: Record<Grade, number> = { 'Excellence': 4, 'Merit': 3, 'Achieved': 2, 'Not Achieved': 1 };

interface Candidate {
  std_info: StandardRecord;
  std_num: number;
  grade: Grade;
  year_achieved: number;
  version: number | null;
  credits: number;
  weight: number;
  tier: number;
  fallback_reason: string | null;
}

/**
 * Statistical value -> ATAR via the precomputed step table (see scripts/export_static_data.py).
 * Equivalent to ATARCalculator._estimate_atar_from_stat.
 */
export function lookupAtar(atar: AtarIndex, statValue: number, year: number): number | null {
  const data = atar.years.get(year);
  if (!data || !data.bands || data.bands.length === 0) return null;
  if (statValue < data.min_value) return 0.0;

  const bands = data.bands;
  let lo = 0;
  let hi = bands.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (statValue >= bands[mid][0] - atar.epsilon) hi = mid;
    else lo = mid + 1;
  }
  return bands[lo][1];
}

export class ATARCalculator {
  private readonly userStandards: UserStandardInput[];
  private readonly allStandardsInfo: Map<number, StandardRecord>;
  private readonly allWeightings: Map<number, WeightingRecord[]>;
  private readonly latestWeightYear: number | null;

  constructor(
    userStandards: UserStandardInput[],
    standards: StandardsIndex,
    weightings: WeightingsIndex,
    private readonly atar: AtarIndex,
  ) {
    for (const us of userStandards) {
      if (!GRADES.includes(us.grade)) throw new Error(`Invalid grade: ${us.grade}`);
    }
    this.userStandards = userStandards;
    this.allStandardsInfo = new Map();
    this.allWeightings = new Map();
    for (const us of userStandards) {
      const info = standards.byNumber.get(us.standard_number);
      if (info) this.allStandardsInfo.set(us.standard_number, info);
      const w = weightings.byStandard.get(us.standard_number);
      if (w) this.allWeightings.set(us.standard_number, w);
    }
    this.latestWeightYear = weightings.latestYear;
  }

  private weightingsFor(stdNum: number): WeightingRecord[] {
    return this.allWeightings.get(stdNum) ?? [];
  }

  private getWeightForGrade(w: WeightingRecord, g: Grade): number | null {
    const m: Record<Grade, number | null> = {
      'Excellence': w.weight_excellence,
      'Merit': w.weight_merit,
      'Achieved': w.weight_achieved,
      'Not Achieved': w.weight_not_achieved,
    };
    const weightValue = m[g];
    if (weightValue === null || weightValue === undefined) return null;
    return weightValue;
  }

  private availableYears(): number[] {
    return Array.from(this.atar.years.keys()).sort((a, b) => b - a);
  }

  private groupByNumber(): Map<number, UserStandardInput[]> {
    const byNumber = new Map<number, UserStandardInput[]>();
    for (const us of this.userStandards) {
      let list = byNumber.get(us.standard_number);
      if (!list) {
        list = [];
        byNumber.set(us.standard_number, list);
      }
      list.push(us);
    }
    return byNumber;
  }

  calculateForAllYears(): ATARResult[] {
    const allYearResults: ATARResult[] = [];
    for (const year of this.availableYears()) {
      const userStatValue = this.calculateStatisticalValueForYear(year);
      if (userStatValue === null) continue;

      const estimatedAtar = lookupAtar(this.atar, userStatValue, year);
      if (estimatedAtar === null) continue;

      allYearResults.push({ year, estimated_atar: estimatedAtar, statistical_value: userStatValue });
    }
    return allYearResults;
  }

  calculateBreakdown(): CalculationBreakdownResponse {
    const yearsBreakdown: YearlyBreakdown[] = [];
    const subjectsBreakdowns: SubjectSSPBreakdown[] = [];

    for (const year of this.availableYears()) {
      const [best90, totals, excluded, statValue] = this.buildBest90Breakdown(year);
      if (statValue === null) continue;

      const estimatedAtar = lookupAtar(this.atar, statValue, year);
      if (estimatedAtar === null) continue;

      yearsBreakdown.push({
        year,
        estimated_atar: estimatedAtar,
        statistical_value: statValue,
        best90,
        totals,
        excluded,
      });

      subjectsBreakdowns.push(...this.buildSubjectSspBreakdowns(year));
    }

    return { years: yearsBreakdown, subjects: subjectsBreakdowns };
  }

  private calculateStatisticalValueForYear(year: number): number | null {
    const processedStandards: { credits: number; weight: number; hierarchy: number }[] = [];

    for (const [stdNum, stdResults] of this.groupByNumber()) {
      const stdInfo = this.allStandardsInfo.get(stdNum);
      if (!stdInfo) continue;

      const bestResult = this.selectBestStandardResult(stdResults, stdNum);
      if (!bestResult) continue;

      const weightYear = bestResult.year_achieved ? bestResult.year_achieved : year;
      const weightVersion = bestResult.standard_version ?? null;

      let yearWeightings = this.weightingsFor(stdNum).filter((w) => w.academic_year === weightYear);

      if (weightVersion !== null) {
        const versionWeightings = yearWeightings.filter((w) => w.standard_version === weightVersion);
        if (versionWeightings.length) yearWeightings = versionWeightings;
        // If specified version not found, fall back to any version for that year
      }

      if (weightVersion === null && yearWeightings.length) {
        yearWeightings = [pyMax(yearWeightings, (w) => w.standard_version || 0)];
      }

      if (!yearWeightings.length) {
        const currentYearWeightings = this.weightingsFor(stdNum).filter((w) => w.academic_year === year);
        if (currentYearWeightings.length) {
          yearWeightings = [pyMax(currentYearWeightings, (w) => w.standard_version)];
        }
      }

      if (!yearWeightings.length) continue;

      const weighting = this.getWeightForGrade(yearWeightings[0], bestResult.grade);
      if (weighting === null || weighting <= 0.001) continue;

      processedStandards.push({ credits: stdInfo.credits, weight: weighting, hierarchy: this.priorityTier(stdInfo) });
    }

    const sortedStandards = pySortBy(processedStandards, (x) => [x.hierarchy, -x.weight]);

    const bestStandardsForCalc: { credits: number; weight: number }[] = [];
    let creditsCounted = 0;
    for (const std of sortedStandards) {
      if (creditsCounted >= 90) break;
      let creditsToAdd = std.credits;
      if (creditsCounted + creditsToAdd > 90) creditsToAdd = 90 - creditsCounted;
      bestStandardsForCalc.push({ credits: creditsToAdd, weight: std.weight });
      creditsCounted += creditsToAdd;
    }

    if (creditsCounted === 0) return 0.0;

    const totalWeightedScore = pySum(bestStandardsForCalc.map((s) => s.credits * s.weight));
    return totalWeightedScore / 90;
  }

  private selectBestStandardResult(stdResults: UserStandardInput[], stdNum: number): UserStandardInput | null {
    if (!stdResults.length) return null;

    const getSortKey = (userStd: UserStandardInput): number[] => {
      const weightYear = userStd.year_achieved ? userStd.year_achieved : this.latestWeightYear;
      const weightVersion = userStd.standard_version ?? null;

      let yearWeightings = this.weightingsFor(stdNum).filter((w) => w.academic_year === weightYear);

      if (weightVersion !== null) {
        const versionWeightings = yearWeightings.filter((w) => w.standard_version === weightVersion);
        if (versionWeightings.length) yearWeightings = versionWeightings;
      } else if (yearWeightings.length) {
        yearWeightings = [pyMax(yearWeightings, (w) => w.standard_version || 0)];
      }

      let weight = 0.0;
      if (yearWeightings.length) {
        const weightValue = this.getWeightForGrade(yearWeightings[0], userStd.grade);
        if (weightValue !== null && weightValue > 0.001) weight = weightValue;
      }

      return [GRADE_PRIORITY[userStd.grade] ?? 0, weight];
    };

    return pyMax(stdResults, getSortKey);
  }

  private priorityTier(stdInfo: StandardRecord): number {
    const stype = (stdInfo.standards_type || '').toLowerCase();
    const isAchievement = stype.startsWith('achievement');
    const isUnit = stype.startsWith('unit');
    if (stdInfo.is_ue && isAchievement) return 1;
    if (stdInfo.is_ue && isUnit) return 2;
    if (!stdInfo.is_ue && isAchievement) return 3;
    return 4;
  }

  /** Returns [weight, used year, used version]; falls back to `fallbackYear` if `year` has no weightings. */
  private getWeightInfo(
    stdNum: number, grade: Grade, year: number, version: number | null, fallbackYear: number | null = null,
  ): [number | null, number | null, number | null] {
    let yearWeightings = this.weightingsFor(stdNum).filter((w) => w.academic_year === year);
    let usedYear = year;

    if (!yearWeightings.length && fallbackYear !== null) {
      yearWeightings = this.weightingsFor(stdNum).filter((w) => w.academic_year === fallbackYear);
      usedYear = fallbackYear;
    }

    if (version !== null) {
      const filtered = yearWeightings.filter((w) => w.standard_version === version);
      if (filtered.length) {
        yearWeightings = filtered;
      } else if (yearWeightings.length) {
        yearWeightings = [pyMax(yearWeightings, (w) => w.standard_version || 0)];
      }
    } else if (yearWeightings.length) {
      yearWeightings = [pyMax(yearWeightings, (w) => w.standard_version || 0)];
    }

    if (!yearWeightings.length) return [null, null, null];

    const usedVersion = yearWeightings[0].standard_version;
    return [this.getWeightForGrade(yearWeightings[0], grade), usedYear, usedVersion];
  }

  private getMaxGradeWeight(stdNum: number, year: number, version: number | null, standardsType: string | null): number | null {
    const isUnitStandard = (standardsType || '').toLowerCase().startsWith('unit');
    const maxGrade: Grade = isUnitStandard ? 'Achieved' : 'Excellence';
    return this.getWeightInfo(stdNum, maxGrade, year, version)[0];
  }

  private fallbackReason(best: UserStandardInput, year: number, usedY: number | null, usedV: number | null): string | null {
    const reasons: string[] = [];
    if (best.year_achieved && usedY !== best.year_achieved) {
      reasons.push(`No ${best.year_achieved} weight available, used ${usedY}`);
    } else if (usedY !== year) {
      reasons.push(`Using ${usedY} weight in ${year} calculation`);
    }
    const version = best.standard_version ?? null;
    if (version !== null && usedV !== version) {
      reasons.push(`Version ${version} unattainable, defaulted to v${usedV}`);
    }
    return reasons.length ? reasons.join(' & ') : null;
  }

  private buildCandidate(stdNum: number, results: UserStandardInput[], year: number): Candidate | null {
    const stdInfo = this.allStandardsInfo.get(stdNum);
    if (!stdInfo) return null;
    const best = this.selectBestStandardResult(results, stdNum);
    if (!best) return null;
    const weightYear = best.year_achieved ? best.year_achieved : year;
    const version = best.standard_version ?? null;
    const [weight, usedY, usedV] = this.getWeightInfo(stdNum, best.grade, weightYear, version, year);
    if (weight === null || weight <= 0.001) return null;

    return {
      std_info: stdInfo,
      std_num: stdNum,
      grade: best.grade,
      year_achieved: weightYear,
      version,
      credits: stdInfo.credits,
      weight: Math.min(Math.max(weight, 0.0), 1.0),
      tier: this.priorityTier(stdInfo),
      fallback_reason: this.fallbackReason(best, year, usedY, usedV),
    };
  }

  private excludedItem(c: Candidate, reason: string): ExcludedItem {
    const maxW = this.getMaxGradeWeight(c.std_num, c.year_achieved, c.version, c.std_info.standards_type);
    return {
      standard_number: c.std_num,
      reason,
      title: c.std_info.title,
      subject: c.std_info.subject,
      grade: c.grade,
      weight_applied: c.weight,
      weight_at_max_grade: maxW,
      standards_type: c.std_info.standards_type,
      assessment_type: c.std_info.assessment_type,
      credits_available: c.credits,
      fallback_reason: null,
    };
  }

  private buildBest90Breakdown(year: number): [StandardContribution[], BreakdownTotals, ExcludedItem[], number | null] {
    const candidates: Candidate[] = [];
    for (const [stdNum, results] of this.groupByNumber()) {
      const c = this.buildCandidate(stdNum, results, year);
      if (c) candidates.push(c);
    }

    const sorted = pySortBy(candidates, (x) => [x.tier, -x.weight]);

    const best90: StandardContribution[] = [];
    const excluded: ExcludedItem[] = [];
    const subjectUsed = new Map<string, number>();
    let totalUsed = 0.0;
    let proratedCount = 0;
    let rank = 0;

    for (const c of sorted) {
      if (totalUsed >= 90) {
        excluded.push(this.excludedItem(c, 'not in top 90'));
        continue;
      }
      const subject = c.std_info.subject || 'Unknown';
      const subjUsed = subjectUsed.get(subject) ?? 0.0;
      const subjRemaining = Math.max(0.0, 24.0 - subjUsed);
      if (subjRemaining <= 0.0) {
        excluded.push(this.excludedItem(c, 'subject cap 24 reached'));
        continue;
      }

      const globalRemaining = Math.max(0.0, 90.0 - totalUsed);
      if (globalRemaining <= 0.0) {
        excluded.push(this.excludedItem(c, 'not in top 90'));
        continue;
      }

      const creditsAvail = c.credits;
      const creditsToTake = Math.min(creditsAvail, subjRemaining, globalRemaining);
      if (creditsToTake <= 0.0) {
        excluded.push(this.excludedItem(c, 'no remaining capacity'));
        continue;
      }

      rank += 1;
      const proRated = creditsToTake < creditsAvail;
      if (proRated) proratedCount += 1;

      const contribution = creditsToTake * c.weight;
      const newSubjUsed = subjUsed + creditsToTake;
      subjectUsed.set(subject, newSubjUsed);
      totalUsed += creditsToTake;

      const maxWeight = this.getMaxGradeWeight(c.std_num, c.year_achieved, c.version, c.std_info.standards_type);

      best90.push({
        selection_rank: rank,
        standard_number: c.std_num,
        title: c.std_info.title,
        subject,
        is_ue: Boolean(c.std_info.is_ue),
        standards_type: c.std_info.standards_type,
        assessment_type: c.std_info.assessment_type,
        grade: c.grade,
        year_achieved: c.year_achieved,
        weight_applied: c.weight,
        weight_at_max_grade: maxWeight,
        credits_available: creditsAvail,
        credits_used: creditsToTake,
        pro_rated: proRated,
        contribution,
        subject_credits_used_to_date: newSubjUsed,
        subject_capped: newSubjUsed >= 24.0,
        priority_tier: c.tier,
        fallback_reason: c.fallback_reason,
      });
    }

    const totalContribution = pySum(best90.map((x) => x.contribution));
    const totals: BreakdownTotals = {
      total_contribution: totalContribution,
      denominator_credits: 90,
      total_credits_used: totalUsed,
      subject_caps: Object.fromEntries(subjectUsed),
      prorated_count: proratedCount,
    };

    if (totalUsed <= 0.0) return [best90, totals, excluded, null];

    return [best90, totals, excluded, totalContribution / 90.0];
  }

  private buildSubjectSspBreakdowns(year: number): SubjectSSPBreakdown[] {
    const bySubject = new Map<string, Candidate[]>();
    for (const [stdNum, results] of this.groupByNumber()) {
      const c = this.buildCandidate(stdNum, results, year);
      if (!c) continue;
      const subject = c.std_info.subject || 'Unknown';
      let list = bySubject.get(subject);
      if (!list) {
        list = [];
        bySubject.set(subject, list);
      }
      list.push(c);
    }

    const outputs: SubjectSSPBreakdown[] = [];
    for (const [subject, unsortedItems] of bySubject) {
      const items = pySortBy(unsortedItems, (x) => [x.tier, -x.weight]);
      const used: StandardContribution[] = [];
      let creditsMapped = 0.0;
      let rank = 0;
      for (const c of items) {
        if (creditsMapped >= 18.0) break;
        const avail = c.credits;
        const remain = Math.max(0.0, 18.0 - creditsMapped);
        const take = Math.min(avail, remain);
        if (take <= 0.0) continue;
        rank += 1;
        const isPr = take < avail;
        const contrib = take * c.weight;
        creditsMapped += take;

        const maxWeight = this.getMaxGradeWeight(c.std_num, c.year_achieved, null, c.std_info.standards_type);

        used.push({
          selection_rank: rank,
          standard_number: c.std_num,
          title: c.std_info.title,
          subject,
          is_ue: Boolean(c.std_info.is_ue),
          standards_type: c.std_info.standards_type,
          assessment_type: c.std_info.assessment_type,
          grade: c.grade,
          year_achieved: c.year_achieved,
          weight_applied: c.weight,
          weight_at_max_grade: maxWeight,
          credits_available: avail,
          credits_used: take,
          pro_rated: isPr,
          contribution: contrib,
          subject_credits_used_to_date: creditsMapped,
          subject_capped: false,
          priority_tier: c.tier,
          fallback_reason: c.fallback_reason,
        });
      }

      const totalCreditsAvailable = pySum(items.map((x) => x.credits));
      const eligible = totalCreditsAvailable >= 18.0;
      const sspScore = eligible ? pySum(used.map((u) => u.contribution)) / 18.0 : null;
      outputs.push({
        subject,
        year,
        eligible,
        ssp_score: sspScore,
        denominator_credits: 18,
        items: used,
      });
    }
    return outputs;
  }
}
