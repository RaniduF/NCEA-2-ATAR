'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, DistributionResponse } from '../app/services/api';
import { getDistribution } from '../app/services/api';
import { ATARMethodologyModal } from './ATARMethodologyModal';
import {
  ChartBarIcon,
  InformationCircleIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  QuestionMarkCircleIcon,
  ArrowTrendingUpIcon,
  AcademicCapIcon,
  StarIcon
} from '@heroicons/react/24/outline';

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
      }
    });

    for (const item of yearData.best90) {
      const isUnitStandard = item.standards_type?.toLowerCase().includes('unit');
      const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
      const isAtMax = item.grade === maxGrade;
      if (!item.weight_at_max_grade) continue;

      const weightGap = item.weight_at_max_grade - item.weight_applied;
      const maxContribution = item.credits_used * item.weight_at_max_grade;
      const isExternal: boolean = item.assessment_type?.toLowerCase() === 'external';
      const yearWeights = standardWeightsByYear.get(item.standard_number);

      standards.push({
        standard_number: item.standard_number,
        title: item.title || '',
        subject: item.subject || 'Unknown',
        current_grade: item.grade,
        max_grade: maxGrade,
        current_weight: item.weight_applied,
        max_weight: item.weight_at_max_grade,
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
      const stdDetails = yearData.best90.find(s => s.standard_number === excl.standard_number);
      if (stdDetails && stdDetails.weight_at_max_grade) {
        const isUnitStandard = stdDetails.standards_type?.toLowerCase().includes('unit');
        const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
        const isAtMax = stdDetails.grade === maxGrade;
        const isExternal: boolean = stdDetails.assessment_type?.toLowerCase() === 'external';
        const yearWeights = standardWeightsByYear.get(stdDetails.standard_number);

        standards.push({
          standard_number: stdDetails.standard_number,
          title: stdDetails.title || '',
          subject: stdDetails.subject || 'Unknown',
          current_grade: stdDetails.grade,
          max_grade: maxGrade,
          current_weight: stdDetails.weight_applied,
          max_weight: stdDetails.weight_at_max_grade,
          weight_gap: stdDetails.weight_at_max_grade - stdDetails.weight_applied,
          current_contribution: 0,
          max_contribution: stdDetails.credits_available * stdDetails.weight_at_max_grade,
          credits: stdDetails.credits_available,
          is_external: isExternal,
          is_at_max: isAtMax,
          standards_type: stdDetails.standards_type || null,
          assessment_type: stdDetails.assessment_type || null,
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

    return [...usedStandards.sort((a, b) => b.contribution - a.contribution), ...excludedStandards];
  }, [breakdown, activeYear, yearsMap]);

  const percentileRank = latestResult ? 100 - latestResult.estimated_atar : 0;

  if (!results) {
    return (
      <div className="glass-panel p-12 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-slate-800/50 flex items-center justify-center">
          <ChartBarIcon className="w-10 h-10 text-slate-500" />
        </div>
        <div className="text-slate-300 text-xl font-medium mb-2">Ready to Calculate</div>
        <p className="text-slate-500 max-w-sm mx-auto">
          Add your standards and click calculate to see your estimated ATAR rank across different years.
        </p>
      </div>
    );
  }

  if (!hasAnyResults) {
    return (
      <div className="glass-panel p-12 text-center border-amber-500/20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
          <AcademicCapIcon className="w-10 h-10 text-amber-500" />
        </div>
        <div className="text-amber-400 text-xl font-medium mb-2">No results returned</div>
        <p className="text-slate-500 max-w-sm mx-auto">
          The selected standards did not produce any ATAR estimates. Try adding more Level 3 standards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ATARMethodologyModal isOpen={isMethodologyModalOpen} onClose={() => setIsMethodologyModalOpen(false)} />

      {/* HERO SECTION - Official Text Style */}
      <div className="glass-panel p-8 relative overflow-hidden group border-brand-500/20">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-500/10 transition-colors duration-700"></div>

        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-4">
            <AcademicCapIcon className="w-6 h-6 text-brand-300" />
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Your estimated ATAR is:</h2>
          </div>

          <div className="mb-2">
            <span className="text-7xl md:text-8xl font-black text-white tracking-tighter drop-shadow-2xl">
              {latestResult!.estimated_atar.toFixed(2)}
            </span>
          </div>

          <div className="text-sm text-slate-400 mb-6 font-medium">
            Calculated using <span className="text-brand-300">{latestResult!.year}</span> weights
          </div>

          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full backdrop-blur-sm">
            <SparklesIcon className="w-4 h-4 text-brand-300" />
            <span className="text-sm font-medium text-slate-200">
              Top <span className="text-brand-300">{percentileRank.toFixed(2)}%</span> of students
            </span>
          </div>

          {/* Historical Years Mini-Cards */}
          {data.length > 1 && (
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {data.slice(0, -1).reverse().map((result, idx) => {
                const prevResult = idx < data.length - 2 ? data[data.length - 2 - idx] : null;
                const trend = prevResult ? result.estimated_atar - prevResult.estimated_atar : 0;

                return (
                  <div key={result.year} className="px-4 py-2 rounded-lg bg-slate-900/50 border border-white/5 flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500">{result.year}</span>
                    <span className="font-bold text-slate-300">{result.estimated_atar.toFixed(2)}</span>
                    {trend !== 0 && (
                      <span className={`text-xs flex items-center ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend > 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
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
            <div className="glass-panel p-4">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Credits Used</div>
              <div className="text-2xl font-bold text-white">
                {yearsMap[activeYear].totals.total_credits_used.toFixed(0)} <span className="text-sm text-slate-500 font-normal">/ 90</span>
              </div>
              <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-accent-500 rounded-full"
                  style={{ width: `${(yearsMap[activeYear].totals.total_credits_used / 90) * 100}%` }}
                ></div>
              </div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Statistical Score</div>
              <div className="text-2xl font-bold text-accent-400 font-mono">
                {yearsMap[activeYear].statistical_value.toFixed(4)}
              </div>
            </div>
          </div>

          {/* Ranked Standards List (Contribution) */}
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-brand-400" />
                Contribution Breakdown
              </h3>
              <select
                value={activeYear ?? ''}
                onChange={(e) => setActiveYear(parseInt(e.target.value))}
                className="bg-slate-900 border border-white/10 rounded-lg text-xs py-1 px-2 text-slate-300 outline-none focus:border-brand-500"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y} Weights</option>
                ))}
              </select>
            </div>

            <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
              {allStandardsWithStatus.map((item, index) => {
                const isAtMaxGrade = item.is_used && item.grade === (item.standards_type?.toLowerCase().includes('unit') ? 'Achieved' : 'Excellence');

                return (
                  <div
                    key={`${item.standard_number}-${item.selection_rank}`}
                    className={`p-3 rounded-lg flex items-center gap-3 transition-colors ${!item.is_used ? 'opacity-50 bg-slate-900/20' : 'bg-slate-800/40 hover:bg-slate-800/60'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${item.is_used ? 'bg-brand-500/20 text-brand-300' : 'bg-slate-800 text-slate-600'
                      }`}>
                      {item.is_used ? index + 1 : '-'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex flex-col min-w-0 flex-1 mr-2">
                          <span className={`text-xs font-bold uppercase tracking-wider mb-0.5 truncate ${item.is_used ? 'text-brand-300' : 'text-slate-600'}`}>{item.subject}</span>
                          <span className={`text-sm font-medium truncate ${item.is_used ? 'text-slate-200' : 'text-slate-500'}`}>
                            {item.title}
                          </span>
                          <span className="text-xs text-slate-500">{item.standard_number}</span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2">
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Weight</span>
                          <span className={`text-sm font-mono font-bold ${item.is_used ? 'text-brand-300' : 'text-slate-600'}`}>
                            {(item.weight_applied * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {item.is_used && (
                          <div className="flex items-center gap-1">
                            {isAtMaxGrade && <CheckIcon className="w-3 h-3 text-emerald-500" />}
                            <span className={`text-[10px] px-1.5 rounded ${item.grade === 'Excellence' ? 'bg-amber-500/10 text-amber-500' :
                              item.grade === 'Merit' ? 'bg-sky-500/10 text-sky-500' :
                                'bg-emerald-500/10 text-emerald-500'
                              }`}>
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

          {/* Best Potential Standards Section */}
          <div className="glass-panel overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <StarIcon className="w-5 h-5 text-amber-400" />
                Best Potential Standards
              </h3>
              <span className="text-xs text-slate-500">Sorted by 2024 Weight</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
              {standardsByWeight.standards.map((item, index) => (
                <div key={`best-${item.standard_number}`} className="p-3 rounded-lg flex items-center gap-3 bg-slate-800/20 hover:bg-slate-800/40 transition-colors">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-amber-500/10 text-amber-400">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex flex-col min-w-0 flex-1 mr-2">
                        <span className="text-xs font-bold text-brand-300 uppercase tracking-wider mb-0.5 truncate">{item.subject}</span>
                        <span className="text-sm font-medium text-slate-200 truncate">{item.title}</span>
                        <span className="text-xs text-slate-500">{item.standard_number}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-900/30 p-2 rounded-md">
                      <div className="flex flex-col">
                        <span className="text-brand-400 font-bold text-[10px] mb-0.5">2024 Weight</span>
                        <span className="font-mono text-brand-300 font-bold">{item.weight_2024 ? (item.weight_2024 * 100).toFixed(2) + '%' : '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] mb-0.5">2023 Weight</span>
                        <span className="font-mono text-slate-300">{item.weight_2023 ? (item.weight_2023 * 100).toFixed(2) + '%' : '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-slate-500 text-[10px] mb-0.5">2022 Weight</span>
                        <span className="font-mono text-slate-300">{item.weight_2022 ? (item.weight_2022 * 100).toFixed(2) + '%' : '-'}</span>
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