'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, DistributionResponse } from '../app/services/api';
import { getDistribution } from '../app/services/api';
import { ATARMethodologyModal } from './ATARMethodologyModal';

interface Props {
  results: ATARResult[] | null;
  breakdown?: CalculationBreakdownResponse | null;
}

interface StandardWeightInfo {
  standard_number: number;
  title: string;
  subject: string;
  current_grade: string;
  max_grade: string;
  current_weight: number;
  max_weight: number;
  weight_gap: number;
  current_contribution: number;
  max_contribution: number;
  credits: number;
  is_external: boolean;
  is_at_max: boolean;
  standards_type: string | null;
  assessment_type: string | null;
  weight_2024?: number;
  weight_2023?: number;
  weight_2022?: number;
}

const gradeColors: Record<string, { bg: string; text: string; border: string }> = {
  'Excellence': { bg: 'bg-[#C4962D]/10', text: 'text-[#C4962D]', border: 'border-[#C4962D]/20' },
  'Merit': { bg: 'bg-[#4A7A8C]/10', text: 'text-[#4A7A8C]', border: 'border-[#4A7A8C]/20' },
  'Achieved': { bg: 'bg-[#5B8A3C]/10', text: 'text-[#5B8A3C]', border: 'border-[#5B8A3C]/20' },
  'Not Achieved': { bg: 'bg-[#B33A3A]/10', text: 'text-[#B33A3A]', border: 'border-[#B33A3A]/20' },
};

function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const startVal = 0;
    const endVal = value;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(startVal + (endVal - startVal) * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };

    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [value, duration]);

  return <>{display.toFixed(2)}</>;
}

export function ATARResults({ results, breakdown }: Props) {
  const data = useMemo(() => {
    const normalized = Array.isArray(results) ? results : [];
    return [...normalized].sort((a, b) => a.year - b.year);
  }, [results]);
  const hasAnyResults = data.length > 0;

  const yearsMap: Record<number, YearlyBreakdown> = {};
  if (breakdown) {
    for (const y of breakdown.years) yearsMap[y.year] = y;
  }
  const availableYears = useMemo(() => data.map(d => d.year), [data]);
  const [activeYear, setActiveYear] = useState<number | null>(
    availableYears.length ? availableYears[availableYears.length - 1] : null
  );
  const [isMethodologyModalOpen, setIsMethodologyModalOpen] = useState(false);

  const latestResult = data.length > 0 ? data[data.length - 1] : null;
  const [histogramYear, setHistogramYear] = useState<number>(latestResult?.year || 2024);
  const [distributionData, setDistributionData] = useState<DistributionResponse | null>(null);
  const [isLoadingDistribution, setIsLoadingDistribution] = useState(false);

  useEffect(() => {
    setActiveYear(prev => {
      if (prev && availableYears.includes(prev)) return prev;
      return availableYears.length ? availableYears[availableYears.length - 1] : null;
    });
  }, [availableYears]);

  useEffect(() => {
    if (latestResult && histogramYear === 2024 && latestResult.year !== 2024) {
      setHistogramYear(latestResult.year);
    }
  }, [latestResult, histogramYear]);

  useEffect(() => {
    if (!hasAnyResults) return;
    const fetchDistribution = async () => {
      setIsLoadingDistribution(true);
      try {
        const dist = await getDistribution(histogramYear);
        setDistributionData(dist);
      } catch (error) {
        console.error('Failed to fetch distribution data:', error);
      } finally {
        setIsLoadingDistribution(false);
      }
    };
    fetchDistribution();
  }, [histogramYear, hasAnyResults]);

  const histogramChartData = useMemo(() => {
    if (!distributionData || distributionData.distribution.length === 0) return [];
    const binSize = 0.005;
    const bins = new Map<number, number>();
    const values = distributionData.distribution.map(d => d.statistical_value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);

    for (const point of distributionData.distribution) {
      const binKey = Math.floor(point.statistical_value / binSize) * binSize;
      bins.set(binKey, (bins.get(binKey) || 0) + point.frequency);
    }

    const binnedData = Array.from(bins.entries())
      .map(([value, freq]) => ({ value, freq }))
      .sort((a, b) => a.value - b.value);

    if (binnedData.length === 0) return [];

    const bandwidth = 0.015;
    const totalFrequency = distributionData.distribution.reduce((sum, d) => sum + d.frequency, 0);
    const result: { statistical_value: number; density: number }[] = [];
    const numPoints = 500;
    const step = (maxVal - minVal) / numPoints;

    for (let i = 0; i <= numPoints; i++) {
      const x = minVal + i * step;
      let densitySum = 0;
      for (const bin of binnedData) {
        const u = (x - bin.value) / bandwidth;
        const kernel = Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        densitySum += kernel * bin.freq;
      }
      const density = (densitySum / (bandwidth * totalFrequency)) * 100;
      result.push({ statistical_value: x, density: density });
    }
    return result;
  }, [distributionData]);

  const standardsByWeight = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return { standards: [], top90CutoffIndex: -1 };

    const yearData = yearsMap[activeYear];
    const standards: Array<StandardWeightInfo & { is_used: boolean; exclusion_reason: string | null }> = [];
    const standardWeightsByYear = new Map<number, Map<number, number>>();

    [2024, 2023, 2022].forEach(year => {
      if (yearsMap[year]) {
        yearsMap[year].best90.forEach(item => {
          if (!standardWeightsByYear.has(item.standard_number)) {
            standardWeightsByYear.set(item.standard_number, new Map());
          }
          standardWeightsByYear.get(item.standard_number)!.set(year, item.weight_at_max_grade || item.weight_applied);
        });
        yearsMap[year].excluded.forEach(excl => {
          if (!standardWeightsByYear.has(excl.standard_number)) {
            standardWeightsByYear.set(excl.standard_number, new Map());
          }
          const exclMaxW = excl.weight_at_max_grade ?? excl.weight_applied;
          if (exclMaxW != null) {
            standardWeightsByYear.get(excl.standard_number)!.set(year, exclMaxW);
          }
        });
      }
    });

    for (const item of yearData.best90) {
      const isUnitStandard = item.standards_type?.toLowerCase().includes('unit');
      const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
      const isAtMax = item.grade === maxGrade;
      // weight_at_max_grade is always populated by the backend for best90 items
      const effectiveMaxWeight = item.weight_at_max_grade ?? item.weight_applied;

      const weightGap = effectiveMaxWeight - item.weight_applied;
      const maxContribution = item.credits_used * effectiveMaxWeight;
      const isExternal: boolean = item.assessment_type?.toLowerCase() === 'external';
      const yearWeights = standardWeightsByYear.get(item.standard_number);

      standards.push({
        standard_number: item.standard_number,
        title: item.title || '',
        subject: item.subject || 'Unknown',
        current_grade: item.grade,
        max_grade: maxGrade,
        current_weight: item.weight_applied,
        max_weight: effectiveMaxWeight,
        weight_gap: weightGap,
        current_contribution: item.contribution,
        max_contribution: maxContribution,
        credits: item.credits_available,
        is_external: isExternal,
        is_at_max: isAtMax,
        standards_type: item.standards_type || null,
        assessment_type: item.assessment_type || null,
        weight_2024: yearWeights?.get(2024),
        weight_2023: yearWeights?.get(2023),
        weight_2022: yearWeights?.get(2022),
        is_used: true,
        exclusion_reason: null
      });
    }

    for (const excl of yearData.excluded) {
      if (excl.weight_applied != null || excl.weight_at_max_grade != null) {
        const isUnitStandard = excl.standards_type?.toLowerCase().includes('unit');
        const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
        const isAtMax = excl.grade === maxGrade;
        const isExternal: boolean = excl.assessment_type?.toLowerCase() === 'external';
        const yearWeights = standardWeightsByYear.get(excl.standard_number);
        // Use the true max-grade weight from the backend; fall back to weight_applied only if unavailable
        const effectiveMaxWeight = excl.weight_at_max_grade ?? excl.weight_applied ?? 0;
        const currentWeight = excl.weight_applied ?? 0;
        const weightGap = effectiveMaxWeight - currentWeight;

        standards.push({
          standard_number: excl.standard_number,
          title: excl.title || '',
          subject: excl.subject || 'Unknown',
          current_grade: excl.grade || 'N/A',
          max_grade: maxGrade,
          current_weight: currentWeight,
          max_weight: effectiveMaxWeight,
          weight_gap: weightGap,
          current_contribution: 0,
          max_contribution: (excl.credits_available || 0) * effectiveMaxWeight,
          credits: excl.credits_available || 0,
          is_external: isExternal,
          is_at_max: isAtMax,
          standards_type: excl.standards_type || null,
          assessment_type: excl.assessment_type || null,
          weight_2024: yearWeights?.get(2024),
          weight_2023: yearWeights?.get(2023),
          weight_2022: yearWeights?.get(2022),
          is_used: false,
          exclusion_reason: excl.reason
        });
      }
    }

    const sortedStandards = [...standards].sort((a, b) => {
      const weightA = a.weight_2024 ?? a.max_weight;
      const weightB = b.weight_2024 ?? b.max_weight;
      return weightB - weightA;
    });

    let creditsAccumulated = 0;
    let cutoffIndex = -1;
    const subjectCredits: Record<string, number> = {};

    for (let i = 0; i < sortedStandards.length; i++) {
      const std = sortedStandards[i];
      const subjectUsed = subjectCredits[std.subject] || 0;
      const canUse = Math.min(std.credits, 24 - subjectUsed, 90 - creditsAccumulated);

      if (canUse > 0) {
        creditsAccumulated += canUse;
        subjectCredits[std.subject] = subjectUsed + canUse;
        if (creditsAccumulated >= 90 && cutoffIndex === -1) {
          cutoffIndex = i;
        }
      }
    }

    return { standards: sortedStandards, top90CutoffIndex: cutoffIndex };
  }, [breakdown, activeYear, yearsMap]);

  const allStandardsWithStatus = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return [];
    const yearData = yearsMap[activeYear];

    const usedStandards = [...yearData.best90].map(item => ({
      ...item,
      is_used: true,
      exclusion_reason: null
    }));

    const excludedStandards = yearData.excluded.map(excl => ({
      selection_rank: 999,
      standard_number: excl.standard_number,
      title: excl.title || null,
      subject: excl.subject || null,
      is_ue: null,
      standards_type: excl.standards_type,
      assessment_type: excl.assessment_type,
      grade: excl.grade || 'N/A',
      year_achieved: null,
      weight_applied: excl.weight_applied || 0,
      weight_at_max_grade: null,
      credits_available: excl.credits_available || 0,
      credits_used: 0,
      pro_rated: false,
      contribution: 0,
      subject_credits_used_to_date: 0,
      subject_capped: false,
      priority_tier: 999,
      is_used: false,
      exclusion_reason: excl.reason
    }));

    return [...usedStandards.sort((a, b) => b.weight_applied - a.weight_applied), ...excludedStandards];
  }, [breakdown, activeYear, yearsMap]);

  const percentileRank = latestResult ? 100 - latestResult.estimated_atar : 0;

  if (!results) {
    return (
      <div className="panel p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-5 bg-surface-elevated border border-border flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-text-muted">bar_chart</span>
        </div>
        <div className="text-text-secondary text-lg font-bold mb-2">Ready to calculate</div>
        <p className="text-text-muted max-w-sm mx-auto text-sm">
          Add your standards and click calculate to see your estimated ATAR rank across different years.
        </p>
      </div>
    );
  }

  if (!hasAnyResults) {
    return (
      <div className="panel p-12 text-center border-warning-200">
        <div className="w-16 h-16 mx-auto mb-5 bg-warning-50 border border-warning-200 flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl text-grade-excellence">school</span>
        </div>
        <div className="text-grade-excellence text-lg font-bold mb-2">No results returned</div>
        <p className="text-text-muted max-w-sm mx-auto text-sm">
          The selected standards did not produce any ATAR estimates. Try adding more Level 3 standards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ATARMethodologyModal isOpen={isMethodologyModalOpen} onClose={() => setIsMethodologyModalOpen(false)} />

      {/* HERO SECTION */}
      <div className="panel p-8 relative overflow-hidden border-primary/20 animate-slide-up">
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-xl text-primary">school</span>
            <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">Your estimated ATAR</h2>
          </div>

          <div className="mb-2">
            <span className="text-7xl md:text-8xl font-black text-primary tracking-tighter font-mono">
              <AnimatedCounter value={latestResult!.estimated_atar} />
            </span>
          </div>

          <div className="text-xs text-text-muted mb-6">
            Calculated using <span className="text-primary font-bold">{latestResult!.year}</span> weights
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-surface-elevated border border-border">
            <span className="material-symbols-outlined text-sm text-primary">auto_awesome</span>
            <span className="text-xs font-medium text-text-secondary">
              Top <span className="text-primary font-bold font-mono">{percentileRank.toFixed(2)}%</span> of students
            </span>
          </div>

          {/* Historical Years */}
          {data.length > 1 && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {data.slice(0, -1).reverse().map((result, idx) => {
                const prevResult = idx < data.length - 2 ? data[data.length - 2 - idx] : null;
                const trend = prevResult ? result.estimated_atar - prevResult.estimated_atar : 0;

                return (
                  <div key={result.year} className="px-4 py-2 bg-surface-elevated border border-border flex items-center gap-3 stagger-item" style={{ '--stagger-index': idx } as React.CSSProperties}>
                    <span className="text-[10px] font-medium text-text-muted uppercase">{result.year}</span>
                    <span className="font-bold text-text-primary font-mono">{result.estimated_atar.toFixed(2)}</span>
                    {trend !== 0 && (
                      <span className={`text-xs flex items-center font-bold ${trend > 0 ? 'text-grade-achieved' : 'text-grade-notAchieved'}`}>
                        <span className="material-symbols-outlined text-sm">{trend > 0 ? 'arrow_upward' : 'arrow_downward'}</span>
                        {Math.abs(trend).toFixed(2)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Section */}
      {breakdown && activeYear && yearsMap[activeYear] && (
        <div className="space-y-6 animate-reveal-up">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="panel p-4">
              <div className="text-xs text-text-muted font-medium mb-1">Credits used</div>
              <div className="text-2xl font-bold text-text-primary font-mono">
                {yearsMap[activeYear].totals.total_credits_used.toFixed(0)} <span className="text-sm text-text-muted font-normal">/ 90</span>
              </div>
              <div className="mt-2 h-2 bg-surface-base overflow-hidden border border-border">
                <div
                  className="h-full bg-primary transition-all duration-700 ease-out"
                  style={{ width: `${(yearsMap[activeYear].totals.total_credits_used / 90) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="panel p-4">
              <div className="text-xs text-text-muted font-medium mb-1">Statistical score</div>
              <div className="text-2xl font-bold text-primary font-mono">
                {yearsMap[activeYear].statistical_value.toFixed(4)}
              </div>
            </div>
          </div>

          {/* Contribution Breakdown */}
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-elevated">
              <h3 className="font-bold text-text-primary flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-lg text-primary">bar_chart</span>
                Contribution breakdown
              </h3>
              <select
                value={activeYear ?? ''}
                onChange={(e) => setActiveYear(parseInt(e.target.value))}
                className="bg-surface-card border border-border text-xs py-1 px-2 text-text-primary outline-none focus:border-primary font-medium"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y} weights</option>
                ))}
              </select>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
              {allStandardsWithStatus.map((item, index) => {
                const isAtMaxGrade = item.is_used && item.grade === (item.standards_type?.toLowerCase().includes('unit') ? 'Achieved' : 'Excellence');
                const colors = gradeColors[item.grade] || gradeColors['Achieved'];

                return (
                  <div
                    key={`${item.standard_number}-${item.selection_rank}`}
                    className={`p-3 flex items-center gap-3 transition-colors stagger-item ${!item.is_used ? 'opacity-40 bg-surface-base' : index % 2 === 0 ? 'bg-surface-card hover:bg-surface-hover' : 'bg-surface-elevated hover:bg-surface-hover'}`}
                    style={{ '--stagger-index': index } as React.CSSProperties}
                  >
                    <div className={`w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 ${item.is_used ? 'bg-primary-subtle text-primary' : 'bg-surface-elevated text-text-muted'}`}>
                      {item.is_used ? index + 1 : '-'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col min-w-0 flex-1 mr-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 truncate ${item.is_used ? 'text-primary' : 'text-text-muted'}`}>{item.subject}</span>
                          <span className={`text-sm font-bold truncate tracking-tight ${item.is_used ? 'text-text-primary' : 'text-text-muted'}`}>
                            {item.title}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono">{item.standard_number}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5 font-medium">Weight</span>
                          <span className={`text-sm font-mono font-bold ${item.is_used ? 'text-primary' : 'text-text-muted'}`}>
                            {(item.weight_applied * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {item.is_used && (
                          <div className="flex items-center gap-1">
                            {isAtMaxGrade && <span className="material-symbols-outlined text-xs text-grade-achieved">check</span>}
                            <span className={`text-[10px] px-1.5 font-bold uppercase border ${colors.bg} ${colors.text} ${colors.border}`}>
                              {item.grade}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Best Potential Standards */}
          <div className="panel overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-surface-elevated">
              <h3 className="font-bold text-text-primary flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-lg text-grade-excellence">star</span>
                Best potential standards
              </h3>
              <span className="text-[10px] text-text-muted font-medium">Sorted by 2024 weight</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
              {standardsByWeight.standards.map((item, index) => (
                <div key={`best-${item.standard_number}`} className="p-3 flex items-center gap-3 bg-surface-card hover:bg-surface-hover transition-colors border-b border-border/50 stagger-item" style={{ '--stagger-index': index } as React.CSSProperties}>
                  <div className="w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 bg-[#C4962D]/10 text-grade-excellence">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col min-w-0 flex-1 mr-2">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5 truncate">{item.subject}</span>
                        <span className="text-sm font-bold text-text-primary truncate tracking-tight">{item.title}</span>
                        <span className="text-[10px] text-text-muted font-mono">{item.standard_number}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-surface-base p-2 border border-border">
                      <div className="flex flex-col">
                        <span className="text-primary font-bold text-[10px] mb-0.5">2024</span>
                        <span className="font-mono text-primary font-bold">{item.weight_2024 ? (item.weight_2024 * 100).toFixed(2) + '%' : '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-text-muted text-[10px] mb-0.5 font-medium">2023</span>
                        <span className="font-mono text-text-secondary">{item.weight_2023 ? (item.weight_2023 * 100).toFixed(2) + '%' : '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-text-muted text-[10px] mb-0.5 font-medium">2022</span>
                        <span className="font-mono text-text-secondary">{item.weight_2022 ? (item.weight_2022 * 100).toFixed(2) + '%' : '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}