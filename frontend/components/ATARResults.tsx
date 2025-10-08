'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, SubjectSSPBreakdown, DistributionResponse } from '../app/services/api';
import { getDistribution } from '../app/services/api';
import { downloadCSV } from '../app/services/csv';
import { ATARMethodologyModal } from './ATARMethodologyModal';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  MinusIcon,
  QuestionMarkCircleIcon
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
  weight_2024?: number;
  weight_2023?: number;
  weight_2022?: number;
}

/**
 * Render an interactive ATAR results view including summary cards, a statistical distribution histogram, detailed yearly results,
 * optional credit breakdown (Top 90) and subject SSP rankings, and CSV export controls.
 *
 * Displays ATAR as a ranking system where each year is independent. The histogram shows the density distribution
 * of statistical values for a selected year with an indicator for the user's position. Years can be cycled through.
 *
 * Renders appropriate empty states when `results` is null or contains no entries. When `breakdown` is
 * provided the component exposes a year selector to view per-year breakdown details and subject SSP data.
 *
 * @param results - An array of ATARResult objects (or null). If not an array the component treats it as empty; results are sorted by year.
 * @param breakdown - Optional CalculationBreakdownResponse providing per-year breakdowns and subject SSP data used by the Credit Breakdown and Subject Rankings sections.
 * @returns A React element that displays the ATAR UI (cards, histogram, tables, and export controls).
 */
export function ATARResults({ results, breakdown }: Props) {
  const data = useMemo(() => {
    // Ensure results is always an array, even if API returns unexpected format
    const normalized = Array.isArray(results) ? results : [];
    return [...normalized].sort((a, b) => a.year - b.year);
  }, [results]);
  const hasAnyResults = data.length > 0;

  const yearsMap: Record<number, YearlyBreakdown> = {};
  const subjectsByYear: Record<number, SubjectSSPBreakdown[]> = {};
  if (breakdown) {
    for (const y of breakdown.years) yearsMap[y.year] = y;
    for (const s of breakdown.subjects) {
      if (!subjectsByYear[s.year]) subjectsByYear[s.year] = [];
      subjectsByYear[s.year].push(s);
    }
  }
  const availableYears = useMemo(() => data.map(d => d.year), [data]);
  const [activeYear, setActiveYear] = useState<number | null>(
    availableYears.length ? availableYears[availableYears.length - 1] : null
  );
  const [activeYearForSubjects, setActiveYearForSubjects] = useState<number | null>(
    availableYears.length ? availableYears[availableYears.length - 1] : null
  );
  const [isCreditBreakdownExpanded, setIsCreditBreakdownExpanded] = useState(false);
  const [showAllTopStandards, setShowAllTopStandards] = useState(false);
  const [standardsFilter, setStandardsFilter] = useState<'all' | 'top10' | 'needsImprovement'>('all');
  const [weightSortBy, setWeightSortBy] = useState<'max_weight' | 'weight_gap' | 'current_contribution'>('max_weight');
  const [isMethodologyModalOpen, setIsMethodologyModalOpen] = useState(false);
  
  // ALL HOOKS MUST BE AT THE TOP - State for histogram visualization
  const latestResult = data.length > 0 ? data[data.length - 1] : null;
  const [histogramYear, setHistogramYear] = useState<number>(latestResult?.year || 2024);
  const [distributionData, setDistributionData] = useState<DistributionResponse | null>(null);
  const [isLoadingDistribution, setIsLoadingDistribution] = useState(false);
  
  useEffect(() => {
    setActiveYear(prev => {
      if (prev && availableYears.includes(prev)) return prev;
      return availableYears.length ? availableYears[availableYears.length - 1] : null;
    });
    setActiveYearForSubjects(prev => {
      if (prev && availableYears.includes(prev)) return prev;
      return availableYears.length ? availableYears[availableYears.length - 1] : null;
    });
  }, [availableYears]);
  
  // Update histogram year when results change
  useEffect(() => {
    if (latestResult && histogramYear === 2024 && latestResult.year !== 2024) {
      setHistogramYear(latestResult.year);
    }
  }, [latestResult, histogramYear]);
  
  // Fetch distribution data when histogram year changes
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
  
  // Prepare histogram data - properly bin and smooth the discrete data
  const histogramChartData = useMemo(() => {
    if (!distributionData || distributionData.distribution.length === 0) return [];
    
    // Step 1: Aggregate data into bins (handle discrete/clumped values)
    const binSize = 0.005; // Bin width - adjust for smoothness (smaller = more detail)
    const bins = new Map<number, number>();
    
    // Find min and max for binning
    const values = distributionData.distribution.map(d => d.statistical_value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    
    // Bin the data
    for (const point of distributionData.distribution) {
      const binKey = Math.floor(point.statistical_value / binSize) * binSize;
      bins.set(binKey, (bins.get(binKey) || 0) + point.frequency);
    }
    
    // Step 2: Convert to array and sort
    const binnedData = Array.from(bins.entries())
      .map(([value, freq]) => ({ value, freq }))
      .sort((a, b) => a.value - b.value);
    
    if (binnedData.length === 0) return [];
    
    // Step 3: Apply Gaussian kernel smoothing (simple KDE)
    const bandwidth = 0.015; // Kernel bandwidth - larger = smoother
    const totalFrequency = distributionData.distribution.reduce((sum, d) => sum + d.frequency, 0);
    const result: { statistical_value: number; density: number }[] = [];
    
    // Create evaluation points
    const numPoints = 500; // Number of points to evaluate density at
    const step = (maxVal - minVal) / numPoints;
    
    for (let i = 0; i <= numPoints; i++) {
      const x = minVal + i * step;
      let densitySum = 0;
      
      // Gaussian kernel: K(u) = (1/sqrt(2π)) * exp(-u²/2)
      for (const bin of binnedData) {
        const u = (x - bin.value) / bandwidth;
        const kernel = Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        densitySum += kernel * bin.freq;
      }
      
      // Normalize by bandwidth and total frequency
      const density = (densitySum / (bandwidth * totalFrequency)) * 100; // Scale for visibility
      
      result.push({
        statistical_value: x,
        density: density
      });
    }
    
    return result;
  }, [distributionData]);
  
  // Get the result for the current histogram year - memoized for reactivity
  const currentYearResult = useMemo(() => {
    const result = data.find(r => r.year === histogramYear) || latestResult;
    if (result) {
      console.log('Reference line at statistical value:', result.statistical_value, 'for year:', histogramYear, 'Type:', typeof result.statistical_value);
    }
    return result;
  }, [data, histogramYear, latestResult]);
  
  // Extract statistical value as a separate variable for better reactivity
  const userStatisticalValue = useMemo(() => {
    if (!currentYearResult) return null;
    const val = Number(currentYearResult.statistical_value);
    
    // Log chart data bounds for debugging
    if (histogramChartData.length > 0) {
      const minVal = histogramChartData[0].statistical_value;
      const maxVal = histogramChartData[histogramChartData.length - 1].statistical_value;
      console.log('Chart domain:', minVal, 'to', maxVal);
      console.log('User value:', val, 'Within bounds:', val >= minVal && val <= maxVal);
    }
    
    console.log('Parsed statistical value for ReferenceLine:', val, 'isNaN:', isNaN(val));
    return isNaN(val) ? null : val;
  }, [currentYearResult, histogramChartData]);
  
  // Calculate the position of the user's value as a percentage for gradient positioning
  const userPositionPercent = useMemo(() => {
    if (!userStatisticalValue || histogramChartData.length === 0) return 0;
    
    const minVal = histogramChartData[0].statistical_value;
    const maxVal = histogramChartData[histogramChartData.length - 1].statistical_value;
    const range = maxVal - minVal;
    
    if (range === 0) return 0;
    
    const position = ((userStatisticalValue - minVal) / range) * 100;
    return Math.max(0, Math.min(100, position)); // Clamp between 0-100
  }, [userStatisticalValue, histogramChartData]);

  // Calculate standards by weight with multi-year data (MUST be before any early returns)
  const standardsByWeight = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return [];
    
    const yearData = yearsMap[activeYear];
    const standards: StandardWeightInfo[] = [];
    
    // Build a map of standard numbers to their weights across years
    const standardWeightsByYear = new Map<number, Map<number, number>>();
    
    // Get weights from 2024, 2023, 2022
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
      // Determine max grade based on standards type
      const isUnitStandard = item.standards_type?.toLowerCase().includes('unit');
      const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
      const isAtMax = item.grade === maxGrade;
      
      // Skip if no max grade weight data
      if (!item.weight_at_max_grade) continue;
      
      const weightGap = item.weight_at_max_grade - item.weight_applied;
      const maxContribution = item.credits_used * item.weight_at_max_grade;
      
      // Determine if external (externally assessed achievement standards typically have higher weights)
      const isExternal: boolean = (item.standards_type?.toLowerCase().includes('achievement') ?? false) && 
                        item.weight_applied > 0.5;
      
      // Get weights for this standard across years
      const yearWeights = standardWeightsByYear.get(item.standard_number);
      const weight_2024 = yearWeights?.get(2024);
      const weight_2023 = yearWeights?.get(2023);
      const weight_2022 = yearWeights?.get(2022);
      
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
        weight_2024,
        weight_2023,
        weight_2022
      });
    }
    
    // Always sort by 2024 weight (most recent year) descending
    return [...standards].sort((a, b) => {
      const weightA = a.weight_2024 ?? a.max_weight;
      const weightB = b.weight_2024 ?? b.max_weight;
      return weightB - weightA;
    });
  }, [breakdown, activeYear, yearsMap]);

  // Get all contributing standards sorted by contribution (MUST be before any early returns)
  const topContributors = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return [];
    const yearData = yearsMap[activeYear];
    return [...yearData.best90]
      .sort((a, b) => b.contribution - a.contribution);
  }, [breakdown, activeYear, yearsMap]);

  if (!results) {
    return (
      <div className="text-center py-16">
        <ChartBarIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
        <div className="text-slate-400 text-lg font-medium mb-2">No results yet</div>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          Add standards and calculate to see your estimated ATAR across years.
        </p>
      </div>
    );
  }

  if (!hasAnyResults) {
    return (
      <div className="text-center py-16">
        <AcademicCapIcon className="w-16 h-16 text-amber-400 mx-auto mb-4" />
        <div className="text-amber-400 text-lg font-medium mb-2">No results returned</div>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          The selected standards did not produce any ATAR estimates. Try adding more Level 3 standards.
        </p>
      </div>
    );
  }

  // Now we can safely use latestResult since we've passed the early returns
  // TypeScript doesn't know this, so we use non-null assertion
  const earliestResult = data[0];
  // Calculate percentile rank: ATAR 99.95 = top 0.05%, so percentile = 100 - ATAR
  const percentileRank = 100 - latestResult!.estimated_atar;
  
  // Cycle to next year (with looping) - goes from newest to oldest
  const cycleYear = () => {
    const currentIndex = data.findIndex(r => r.year === histogramYear);
    // Decrement to go backwards (2024 -> 2023 -> 2022)
    const nextIndex = (currentIndex - 1 + data.length) % data.length;
    setHistogramYear(data[nextIndex].year);
  };

  // Helper to get all standards sorted by max grade weight (highest to lowest)
  const getStandardsByContribution = (year: number) => {
    if (!breakdown || !yearsMap[year]) return [];
    
    const yearData = yearsMap[year];
    // Sort all standards by their max grade weight only (not contribution)
    return [...yearData.best90].sort((a, b) => {
      // Use max grade weight if available, otherwise fall back to current weight
      const maxWeightA = a.weight_at_max_grade ?? a.weight_applied;
      const maxWeightB = b.weight_at_max_grade ?? b.weight_applied;
      
      // Sort by weight descending (highest first)
      return maxWeightB - maxWeightA;
    });
  };

  // Helper to determine max grade for a standard
  const getMaxGradeForStandard = (standardsType: string | null | undefined) => {
    const isUnitStandard = standardsType === 'Unit Standard';
    return isUnitStandard ? 'Achieved' : 'Excellence';
  };

  // Helper to get filtered standards based on current filter
  const getFilteredStandards = (year: number) => {
    const allStandards = getStandardsByContribution(year);
    
    if (standardsFilter === 'top10') {
      return allStandards.slice(0, 10);
    } else if (standardsFilter === 'needsImprovement') {
      return allStandards.filter(item => {
        const maxGrade = getMaxGradeForStandard(item.standards_type);
        return item.grade !== maxGrade;
      });
    }
    
    return allStandards;
  };

  return (
    <div className="space-y-8">
      {/* Methodology Modal */}
      <ATARMethodologyModal 
        isOpen={isMethodologyModalOpen} 
        onClose={() => setIsMethodologyModalOpen(false)} 
      />
      
      {/* HERO SECTION - ATAR Score */}
      <div className="card overflow-hidden animate-reveal-in">
        <div className="relative bg-gradient-to-br from-brand-600/20 via-brand-500/10 to-transparent p-8 md:p-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <TrophyIcon className="w-8 h-8 text-brand-400" />
                <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Your ATAR Score</h2>
              </div>
              <button
                onClick={() => setIsMethodologyModalOpen(true)}
                className="btn-ghost flex items-center gap-2 text-xs sm:text-sm"
                title="Learn how ATAR is calculated"
              >
                <QuestionMarkCircleIcon className="w-5 h-5" />
                <span className="hidden sm:inline">How is this calculated?</span>
              </button>
            </div>
            
            <div className="flex flex-col lg:flex-row items-start lg:items-end gap-8">
              {/* Primary ATAR - Latest Year */}
              <div className="flex-1 w-full">
                <div className="text-6xl sm:text-7xl lg:text-8xl font-black text-brand-400 leading-none mb-3">
                  {latestResult!.estimated_atar.toFixed(2)}
                </div>
                <div className="text-base sm:text-lg text-slate-300 mb-2">
                  Estimated ATAR for <span className="font-semibold text-slate-100">{latestResult!.year}</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 bg-brand-500/20 border border-brand-500/30 rounded-lg">
                  <SparklesIcon className="w-4 h-4 text-brand-300" />
                  <span className="text-xs sm:text-sm font-medium text-brand-200">
                    Top {percentileRank.toFixed(2)}% of your cohort
                  </span>
                </div>
              </div>
              
              {/* Historical Years */}
              {data.length > 1 && (
                <div className="flex flex-col gap-3 w-full lg:w-auto">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Previous Years</div>
                  <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2">
                    {data.slice(0, -1).reverse().map((result, idx) => {
                      const prevResult = idx < data.length - 2 ? data[data.length - 2 - idx] : null;
                      const trend = prevResult ? result.estimated_atar - prevResult.estimated_atar : 0;
                      
                      return (
                        <div key={result.year} className="panel p-3 sm:p-4 min-w-[100px] sm:min-w-[120px] flex-shrink-0">
                          <div className="text-xs text-slate-400 mb-1">{result.year}</div>
                          <div className="text-xl sm:text-2xl font-bold text-slate-200 mb-1">
                            {result.estimated_atar.toFixed(2)}
                          </div>
                          {trend !== 0 && (
                            <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {trend > 0 ? <ArrowUpIcon className="w-3 h-3" /> : <ArrowDownIcon className="w-3 h-3" />}
                              <span>{Math.abs(trend).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* HOW YOUR ATAR WAS CALCULATED - Two Column Section */}
      {breakdown && activeYear && yearsMap[activeYear] && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-reveal-up" style={{ animationDelay: '80ms' }}>
          
          {/* LEFT COLUMN: Your Ranked Standards */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <ChartBarIcon className="w-6 h-6 text-brand-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200">Your Ranked Standards</h3>
                    <p className="text-xs text-slate-400 mt-0.5">How your standards ranked with your current grades</p>
                  </div>
                </div>
                <select value={activeYear ?? ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActiveYear(parseInt(e.target.value))} className="input text-sm">
                  {availableYears.map(y => (
                    <option key={y} value={y} className="bg-slate-800">{y}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-slate-400 mt-3">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></div>
                  <span>At max grade</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-700/50 border border-slate-600"></div>
                  <span>Can be improved</span>
                </div>
              </div>
            </div>
            
            {/* Standards count indicator */}
            <div className="px-6 py-3 bg-slate-800/30 border-b border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  Showing <span className="font-semibold text-brand-400">{topContributors.length}</span> standard{topContributors.length !== 1 ? 's' : ''}
                </span>
                {topContributors.length > 5 && (
                  <span className="text-xs text-slate-400">
                    Scroll to view all
                  </span>
                )}
              </div>
            </div>
            
            {/* Scrollable standards container */}
            <div className="relative">
              <div className="max-h-[500px] overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {topContributors.map((item, index) => {
                const isAtMaxGrade = item.grade === (item.standards_type?.toLowerCase().includes('unit') ? 'Achieved' : 'Excellence');
                const contributionPercent = (item.contribution / yearsMap[activeYear].totals.total_contribution) * 100;
                
                return (
                  <div
                    key={`${item.standard_number}-${item.selection_rank}`}
                    className={`p-4 rounded-lg border transition-all ${
                      isAtMaxGrade
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-800/50 border-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                          isAtMaxGrade ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-200 mb-0.5">{item.standard_number}</div>
                          {item.title && (
                            <div className="text-xs text-slate-300 mb-1 line-clamp-2">{item.title}</div>
                          )}
                          <div className="text-xs text-slate-400 truncate">{item.subject}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          item.grade === 'Excellence' ? 'bg-emerald-500/20 text-emerald-300' :
                          item.grade === 'Merit' ? 'bg-blue-500/20 text-blue-300' :
                          item.grade === 'Achieved' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {item.grade[0]}
                        </span>
                        {isAtMaxGrade && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30">
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                          </div>
                        )}
                        {!isAtMaxGrade && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-500/30">
                            <ArrowUpIcon className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                          <span>Contribution to total</span>
                          <span className="font-semibold text-brand-300">{contributionPercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(contributionPercent * 2, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-400">Weight</div>
                        <div className="text-sm font-mono font-semibold text-slate-200">{item.weight_applied.toFixed(3)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              
              {/* Scroll fade indicator */}
              {topContributors.length > 5 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none"></div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Quick Stats + Improvement Opportunities Preview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Stats */}
            <div className="card overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <InformationCircleIcon className="w-6 h-6 text-brand-400" />
                  <h3 className="text-lg font-semibold text-slate-200">Quick Stats</h3>
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                {/* Credits Used */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-slate-300">Credits Used</span>
                    <span className="font-semibold text-slate-200">
                      {yearsMap[activeYear].totals.total_credits_used.toFixed(1)} / 90
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all duration-500"
                      style={{ width: `${(yearsMap[activeYear].totals.total_credits_used / 90) * 100}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Statistical Score */}
                <div className="panel p-4">
                  <div className="text-xs text-slate-400 mb-1">Statistical Score</div>
                  <div className="text-xl font-mono font-bold text-brand-400">
                    {yearsMap[activeYear].statistical_value.toFixed(6)}
                  </div>
                </div>
                
                {/* Other Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="panel p-4">
                    <div className="text-xs text-slate-400 mb-1">Subjects Used</div>
                    <div className="text-2xl font-bold text-slate-200">
                      {Object.keys(yearsMap[activeYear].totals.subject_caps).length}
                    </div>
                  </div>
                  <div className="panel p-4">
                    <div className="text-xs text-slate-400 mb-1">Prorated</div>
                    <div className="text-2xl font-bold text-slate-200">
                      {yearsMap[activeYear].totals.prorated_count}
                    </div>
                  </div>
                </div>
                
                {/* Estimated ATAR */}
                <div className="panel p-4 border-2 border-brand-500/30 bg-brand-500/5">
                  <div className="text-xs text-brand-300 font-semibold mb-1">Estimated ATAR ({activeYear})</div>
                  <div className="text-3xl font-black text-brand-400">
                    {yearsMap[activeYear].estimated_atar.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* STANDARDS BY WEIGHT & IMPACT Section */}
      {breakdown && activeYear && yearsMap[activeYear] && standardsByWeight.length > 0 && (
        <div className="card overflow-hidden animate-reveal-up" style={{ animationDelay: '120ms' }}>
          <div className="p-6 border-b border-white/10">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 text-brand-400" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">Standard Weights & Yearly Comparison</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Difficulty weights from the last 3 years (2024-2022) sorted by most recent</p>
                </div>
              </div>
              
              {/* Legend */}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30"></div>
                  <span>At max grade</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-slate-700/50 border border-slate-600"></div>
                  <span>Can improve</span>
                </div>
              </div>
            </div>
            
            {/* Info Box */}
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-4 h-4 text-blue-300 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-200">
                  Each standard gets a <strong>difficulty weight</strong> based on how the whole cohort performed that year. 
                  Harder standards get higher weights. These weights vary year-to-year because they depend on how everyone did, 
                  not on the standard itself. External exams usually end up with higher weights than internals.
                </p>
              </div>
            </div>
          </div>
          
          {/* Standards count indicator */}
          <div className="px-6 py-3 bg-slate-800/30 border-b border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-300">
                Showing <span className="font-semibold text-brand-400">{standardsByWeight.length}</span> standard{standardsByWeight.length !== 1 ? 's' : ''}
              </span>
              <span className="text-xs text-slate-400">
                Scroll to view all
              </span>
            </div>
          </div>
          
          {/* Scrollable standards container with fixed height */}
          <div className="relative">
            <div className="max-h-[600px] overflow-y-auto p-6 space-y-3 custom-scrollbar">
              {standardsByWeight.map((std, index) => {
                return (
                  <div
                    key={std.standard_number}
                    className={`p-4 rounded-lg border transition-all ${
                      std.is_at_max
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                          std.is_at_max ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-slate-200">{std.standard_number}</span>
                            <span className={`text-[0.625rem] px-2 py-0.5 rounded font-medium ${
                              std.is_external 
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                : 'bg-slate-700/50 text-slate-400'
                            }`}>
                              {std.is_external ? 'External' : 'Internal'}
                            </span>
                          </div>
                          {std.title && (
                            <div className="text-xs text-slate-300 mb-1 line-clamp-2">{std.title}</div>
                          )}
                          <div className="text-xs text-slate-400 truncate">{std.subject}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          std.current_grade === 'Excellence' ? 'bg-emerald-500/20 text-emerald-300' :
                          std.current_grade === 'Merit' ? 'bg-blue-500/20 text-blue-300' :
                          std.current_grade === 'Achieved' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {std.current_grade[0]}
                        </span>
                        {std.is_at_max && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30">
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Multi-year weights comparison */}
                      <div className="panel p-3 bg-slate-800/40">
                        <div className="text-xs text-slate-400 mb-2 font-medium">Difficulty Weights (Last 3 Years)</div>
                        <div className="grid grid-cols-3 gap-3">
                          {std.weight_2024 !== undefined && (
                            <div>
                              <div className="text-[0.625rem] text-slate-400 mb-0.5">2024</div>
                              <div className="font-mono text-xs font-semibold text-brand-400">
                                {std.weight_2024.toFixed(4)}
                              </div>
                            </div>
                          )}
                          {std.weight_2023 !== undefined && (
                            <div>
                              <div className="text-[0.625rem] text-slate-400 mb-0.5">2023</div>
                              <div className="font-mono text-xs font-semibold text-slate-200">
                                {std.weight_2023.toFixed(4)}
                              </div>
                            </div>
                          )}
                          {std.weight_2022 !== undefined && (
                            <div>
                              <div className="text-[0.625rem] text-slate-400 mb-0.5">2022</div>
                              <div className="font-mono text-xs font-semibold text-slate-200">
                                {std.weight_2022.toFixed(4)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Current Grade Info */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-400 mb-1">Your Weight</div>
                          <div className="font-mono font-semibold text-slate-200">{std.current_weight.toFixed(4)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 mb-1">Your Grade</div>
                          <div className="font-semibold text-slate-200">{std.current_grade}</div>
                        </div>
                      </div>
                      
                      {/* Max grade indicator */}
                      {std.is_at_max ? (
                        <div className="text-xs text-emerald-300 font-medium flex items-center gap-1 p-2 bg-emerald-500/10 rounded-lg">
                          <CheckIcon className="w-3 h-3" />
                          <span>You got the best possible grade ({std.max_grade})</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 p-2 bg-slate-700/30 rounded-lg">
                          Getting <span className="text-slate-200 font-semibold">{std.max_grade}</span> would give you a weight of <span className="font-mono text-brand-400 font-semibold">{std.max_weight.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Scroll fade indicators */}
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900 to-transparent pointer-events-none"></div>
          </div>
        </div>
      )}

      {/* Distribution Histogram - More Compact */}
      <div className="card p-6 animate-reveal-up" style={{ animationDelay: '200ms' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-6 h-6 text-brand-400" />
            <h3 className="text-lg font-semibold text-slate-200">Statistical Value Distribution</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">{histogramYear}</span>
            <button 
              onClick={cycleYear}
              className="btn-ghost p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
              title="Cycle to next year"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {isLoadingDistribution ? (
          <div className="h-64 w-full flex items-center justify-center">
            <div className="text-slate-400">Loading distribution...</div>
          </div>
        ) : histogramChartData.length > 0 ? (
          <div className="h-48 w-full reveal reveal-in">
            <ResponsiveContainer>
              <AreaChart 
                key={`chart-${histogramYear}-${histogramChartData.length}-${userPositionPercent.toFixed(2)}`}
                data={histogramChartData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <defs>
                  {/* Horizontal gradient that's shaded left of user's line, transparent to the right */}
                  <linearGradient id="densityGradient" x1="0" y1="0" x2="1" y2="0">
                    {/* Shaded from start to user's position */}
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6}/>
                    <stop offset={`${userPositionPercent}%`} stopColor="#6366f1" stopOpacity={0.5}/>
                    {/* Transition to transparent after user's position */}
                    <stop offset={`${userPositionPercent}%`} stopColor="#6366f1" stopOpacity={0.05}/>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="statistical_value"
                  type="number"
                  domain={['dataMin', 'dataMax']}
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => value.toFixed(2)}
                  label={{ value: 'Statistical Value', position: 'insideBottom', offset: -10, fill: '#94a3b8' }}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Density (KDE)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
                />
                {/* Single area chart with uniform gradient */}
                <Area 
                  type="monotone" 
                  dataKey="density" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fill="url(#densityGradient)"
                  isAnimationActive={false}
                  activeDot={{ r: 5, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
                  dot={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(15,23,42,0.95)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: 12, 
                    color: 'white',
                    fontSize: 14
                  }} 
                  labelStyle={{ color: '#94a3b8' }}
                  formatter={(value: number) => [value.toFixed(4), 'Density']}
                  labelFormatter={(label: number) => `Stat Value: ${label.toFixed(6)}`}
                  wrapperStyle={{ zIndex: 100 }}
                />
                {userStatisticalValue !== null && currentYearResult && histogramChartData.length > 0 && (
                  <ReferenceLine 
                    key={`refline-${userStatisticalValue}`}
                    x={userStatisticalValue} 
                    stroke="#f59e0b" 
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    ifOverflow="extendDomain"
                    label={{ 
                      value: `Your Score: ${currentYearResult.estimated_atar.toFixed(2)} ATAR`, 
                      position: 'top',
                      fill: '#f59e0b',
                      fontSize: 13,
                      fontWeight: 'bold',
                      offset: 10
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 w-full flex items-center justify-center">
            <div className="text-slate-400">No distribution data available</div>
          </div>
        )}
        
        <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <p className="text-xs text-slate-300 mb-2">
            <strong>About this distribution:</strong> This density plot uses Kernel Density Estimation (KDE) to show 
            the smoothed distribution of statistical values for {histogramYear}. 
            The <span className="text-[#f59e0b] font-semibold">orange dashed line</span> indicates your statistical value and corresponding ATAR. 
            The <span className="text-[#6366f1] font-semibold">shaded area to the left</span> represents students you performed better than.
          </p>
          <p className="text-xs text-slate-400">
            <strong>Note on the left spike:</strong> The spike at low statistical values represents students in the age cohort 
            who didn&apos;t sit NCEA (left school at 16 or studied under other systems). This is included to accurately 
            represent the full cohort as per NZQA methodology. Click the arrow button to cycle through years.
          </p>
        </div>
      </div>

      {/* Detailed Breakdown - Collapsible */}
      <details className="card overflow-hidden animate-reveal-up" style={{ animationDelay: '240ms' }}>
        <summary className="p-6 cursor-pointer hover:bg-slate-700/20 transition-colors list-none group">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <InformationCircleIcon className="w-6 h-6 text-brand-400" />
              <div>
                <h3 className="text-lg font-semibold text-slate-200">Detailed Breakdown</h3>
                <p className="text-xs text-slate-400 mt-0.5">Full credit breakdown, yearly results, and subject rankings</p>
              </div>
            </div>
            <ChevronDownIcon className="w-5 h-5 text-slate-400 transition-transform group-open:rotate-180" />
          </div>
        </summary>
        
        <div className="p-6 space-y-8 border-t border-white/10">
          {/* Full Credit Breakdown (Top 90) */}
          {breakdown && activeYear && yearsMap[activeYear] && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <ChartBarIcon className="w-4 h-4" />
                  Complete Credit Breakdown (Top 90)
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const y = yearsMap[activeYear];
                      const headers = ['Rank','Standard','Subject','UE','Type','Grade','Year','Credits Available','Credits Used','Pro-rated','Weight','Contribution'];
                      const rows = y.best90.map(i => [
                        i.selection_rank,
                        `${i.standard_number}${i.title ? `: ${i.title}` : ''}`,
                        i.subject ?? '',
                        i.is_ue ? 'UE' : '',
                        i.standards_type ?? '',
                        i.grade,
                        i.year_achieved ?? '',
                        i.credits_available,
                        i.credits_used,
                        i.pro_rated ? 'Yes' : 'No',
                        i.weight_applied,
                        i.contribution
                      ]);
                      downloadCSV(`breakdown_${activeYear}.csv`, headers, rows);
                    }}
                    className="btn-ghost text-xs"
                  >Export CSV</button>
                  <select value={activeYear ?? ''} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActiveYear(parseInt(e.target.value))} className="input text-sm">
                    {availableYears.map(y => (
                      <option key={y} value={y} className="bg-slate-800">{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Standard</th>
                      <th className="px-4 py-3 text-left">Subject</th>
                      <th className="px-4 py-3 text-left">Grade</th>
                      <th className="px-4 py-3 text-right">Credits</th>
                      <th className="px-4 py-3 text-right">Weight</th>
                      <th className="px-4 py-3 text-right">Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {yearsMap[activeYear].best90.map(item => (
                      <tr key={`${item.standard_number}-${item.selection_rank}`} className="hover:bg-slate-700/20 transition-colors">
                        <td className="px-4 py-3 text-slate-400">{item.selection_rank}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-200 font-medium">{item.standard_number}</div>
                          {item.title && (
                            <div className="text-xs text-slate-300 mb-1 line-clamp-2">{item.title}</div>
                          )}
                          <div className="text-xs text-slate-400">Year {item.year_achieved} • Tier {item.priority_tier}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{item.subject}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${
                            item.grade === 'Excellence' ? 'bg-emerald-500/20 text-emerald-300' :
                            item.grade === 'Merit' ? 'bg-blue-500/20 text-blue-300' :
                            item.grade === 'Achieved' ? 'bg-amber-500/20 text-amber-300' :
                            'bg-red-500/20 text-red-300'
                          }`}>{item.grade[0]}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-200">
                          <span className="font-semibold">{item.credits_used.toFixed(1)}</span>
                          {item.pro_rated && <span className="ml-1 text-[0.6rem] text-slate-400">*</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm">{item.weight_applied.toFixed(3)}</td>
                        <td className="px-4 py-3 text-right font-mono text-sm text-brand-400">{item.contribution.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        
          {/* Yearly ATAR Results */}
          <div>
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" />
              Yearly ATAR Results
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left">Year</th>
                    <th className="px-6 py-3 text-left">Estimated ATAR</th>
                    <th className="px-6 py-3 text-left">Statistical Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {data.map((result, index) => (
                    <tr key={result.year} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-slate-200">
                        {result.year}
                        {index === data.length - 1 && (
                          <span className="ml-2 badge-brand">Latest</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-lg font-bold text-brand-400">
                          {result.estimated_atar.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 font-mono">
                        {result.statistical_value.toFixed(6)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Subject Rankings */}
          {breakdown && activeYearForSubjects && subjectsByYear[activeYearForSubjects] && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <AcademicCapIcon className="w-4 h-4" />
                  Subject Rankings (SSP, 18 credits)
                </h4>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const subs = subjectsByYear[activeYearForSubjects] || [];
                      const headers = ['Subject','Eligible','SSP score'];
                      const rows = subs
                        .slice()
                        .sort((a, b) => (b.ssp_score ?? -1) - (a.ssp_score ?? -1))
                        .map(s => [s.subject, s.eligible ? 'Yes' : 'No', s.ssp_score ?? '']);
                      downloadCSV(`ssp_${activeYearForSubjects}.csv`, headers, rows);
                    }}
                    className="btn-ghost text-xs"
                  >Export CSV</button>
                  <select 
                    value={activeYearForSubjects ?? ''} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setActiveYearForSubjects(parseInt(e.target.value))} 
                    className="input text-sm"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y} className="bg-slate-800">{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left">Subject</th>
                      <th className="px-4 py-3 text-left">Eligible</th>
                      <th className="px-4 py-3 text-right">SSP score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {subjectsByYear[activeYearForSubjects]
                      .slice()
                      .sort((a, b) => (b.ssp_score ?? -1) - (a.ssp_score ?? -1))
                      .map(s => (
                        <tr key={s.subject} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3 text-slate-200 font-medium">{s.subject}</td>
                          <td className="px-4 py-3">{s.eligible ? <span className="badge-success">Yes</span> : <span className="badge-error">No (≥ 18 credits required)</span>}</td>
                          <td className="px-4 py-3 text-right font-mono">{s.ssp_score != null ? s.ssp_score.toFixed(3) : '-'}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>

      {/* Info Note */}
      <div className="panel p-4 border border-slate-700/50 animate-reveal-in" style={{ animationDelay: '200ms' }}>
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300 flex-1">
            <div className="flex items-start justify-between gap-4 mb-1">
              <p className="font-medium text-slate-200">How ATAR Works</p>
              <button
                onClick={() => setIsMethodologyModalOpen(true)}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1 flex-shrink-0 transition-colors"
              >
                <QuestionMarkCircleIcon className="w-4 h-4" />
                <span>View full methodology</span>
              </button>
            </div>
            <p className="text-slate-400 mb-2">
              Your ATAR is calculated from your <strong className="text-slate-200">best 90 Level 3 credits</strong> (max 24 per subject). 
              NZQA calculates a <strong className="text-slate-200">statistical score</strong> (credit-weighted average of difficulty weights), 
              ranks everyone by this score, then assigns you an <strong className="text-slate-200">ITARS</strong> (your percentile rank). 
              This ITARS percentile is then mapped to an ATAR based on your cohort&apos;s participation rate.
            </p>
            <p className="text-slate-400 mb-2">
              Each standard gets a <strong className="text-slate-200">difficulty weight</strong> based on how hard it was relative to others 
              that year—if fewer people got Excellence, the weight goes up. These weights change every year because they reflect 
              how the whole cohort performed, not the standard itself.
            </p>
            <p className="text-slate-400">
              An ATAR of 99.95 means you&apos;re in the top 0.05% of everyone your age (not just people who did NCEA). 
              These are estimates based on historical data—your official ATAR comes from NZQA in January.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 