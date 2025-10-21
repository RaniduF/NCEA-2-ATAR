'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, DistributionResponse } from '../app/services/api';
import { getDistribution } from '../app/services/api';
import { ATARMethodologyModal } from './ATARMethodologyModal';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
  ChevronRightIcon,
  CheckIcon,
  SparklesIcon,
  TrophyIcon,
  ArrowUpIcon,
  ArrowDownIcon,
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
  assessment_type: string | null;
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
  if (breakdown) {
    for (const y of breakdown.years) yearsMap[y.year] = y;
  }
  const availableYears = useMemo(() => data.map(d => d.year), [data]);
  const [activeYear, setActiveYear] = useState<number | null>(
    availableYears.length ? availableYears[availableYears.length - 1] : null
  );
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
  // This includes ALL standards (used and excluded) to show improvement opportunities
  const standardsByWeight = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return { standards: [], top90CutoffIndex: -1 };
    
    const yearData = yearsMap[activeYear];
    const standards: Array<StandardWeightInfo & { is_used: boolean; exclusion_reason: string | null }> = [];
    
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
    
    // Process USED standards from best90
    for (const item of yearData.best90) {
      // Determine max grade based on standards type
      const isUnitStandard = item.standards_type?.toLowerCase().includes('unit');
      const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
      const isAtMax = item.grade === maxGrade;
      
      // Skip if no max grade weight data
      if (!item.weight_at_max_grade) continue;
      
      const weightGap = item.weight_at_max_grade - item.weight_applied;
      const maxContribution = item.credits_used * item.weight_at_max_grade;
      
      // Use database assessment_type field (Internal or External)
      const isExternal: boolean = item.assessment_type?.toLowerCase() === 'external';
      
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
        assessment_type: item.assessment_type || null,
        weight_2024,
        weight_2023,
        weight_2022,
        is_used: true,
        exclusion_reason: null
      });
    }
    
    // Process EXCLUDED standards
    for (const excl of yearData.excluded) {
      // Try to find this standard in best90 to get its details (it might be there from calculation)
      const stdDetails = yearData.best90.find(s => s.standard_number === excl.standard_number);
      
      if (stdDetails && stdDetails.weight_at_max_grade) {
        const isUnitStandard = stdDetails.standards_type?.toLowerCase().includes('unit');
        const maxGrade = isUnitStandard ? 'Achieved' : 'Excellence';
        const isAtMax = stdDetails.grade === maxGrade;
        const isExternal: boolean = stdDetails.assessment_type?.toLowerCase() === 'external';
        
        const yearWeights = standardWeightsByYear.get(stdDetails.standard_number);
        const weight_2024 = yearWeights?.get(2024);
        const weight_2023 = yearWeights?.get(2023);
        const weight_2022 = yearWeights?.get(2022);
        
        standards.push({
          standard_number: stdDetails.standard_number,
          title: stdDetails.title || '',
          subject: stdDetails.subject || 'Unknown',
          current_grade: stdDetails.grade,
          max_grade: maxGrade,
          current_weight: stdDetails.weight_applied,
          max_weight: stdDetails.weight_at_max_grade,
          weight_gap: stdDetails.weight_at_max_grade - stdDetails.weight_applied,
          current_contribution: 0, // Not used in final calc
          max_contribution: stdDetails.credits_available * stdDetails.weight_at_max_grade,
          credits: stdDetails.credits_available,
          is_external: isExternal,
          is_at_max: isAtMax,
          standards_type: stdDetails.standards_type || null,
          assessment_type: stdDetails.assessment_type || null,
          weight_2024,
          weight_2023,
          weight_2022,
          is_used: false,
          exclusion_reason: excl.reason
        });
      }
    }
    
    // Sort all standards by their 2024 max weight (most recent year) descending
    const sortedStandards = [...standards].sort((a, b) => {
      const weightA = a.weight_2024 ?? a.max_weight;
      const weightB = b.weight_2024 ?? b.max_weight;
      return weightB - weightA;
    });
    
    // Find the cutoff index - where we'd reach 90 credits at max grades
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
    
    return { 
      standards: sortedStandards, 
      top90CutoffIndex: cutoffIndex 
    };
  }, [breakdown, activeYear, yearsMap]);

  // Get all contributing standards sorted by contribution (MUST be before any early returns)
  const topContributors = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return [];
    const yearData = yearsMap[activeYear];
    return [...yearData.best90]
      .sort((a, b) => b.contribution - a.contribution);
  }, [breakdown, activeYear, yearsMap]);

  // Get ALL standards including excluded ones for "How your standards were ranked"
  const allStandardsWithStatus = useMemo(() => {
    if (!breakdown || !activeYear || !yearsMap[activeYear]) return [];
    const yearData = yearsMap[activeYear];
    
    // Used standards
    const usedStandards = [...yearData.best90].map(item => ({
      ...item,
      is_used: true,
      exclusion_reason: null
    }));
    
    // Excluded standards - use the data directly from backend now that it includes all fields
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

  // Prepare data for rendering (used in final JSX after early returns)
  // Now we can safely use latestResult since we've passed the early returns
  // TypeScript doesn't know this, so we use non-null assertion
  const earliestResult = data[0];
  // Calculate percentile rank: ATAR 99.95 = top 0.05%, so percentile = 100 - ATAR
  const percentileRank = latestResult ? 100 - latestResult.estimated_atar : 0;
  
  // Cycle to next year (with looping) - goes from newest to oldest
  const cycleYear = (): void => {
    const currentIndex = data.findIndex(r => r.year === histogramYear);
    // Decrement to go backwards (2024 -> 2023 -> 2022)
    const nextIndex = (currentIndex - 1 + data.length) % data.length;
    setHistogramYear(data[nextIndex].year);
  };

  // Early return checks
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
                <h2 className="text-2xl md:text-3xl font-bold text-slate-100">Your ATAR is:</h2>
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
          
          {/* LEFT COLUMN: How your standards were ranked */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="flex items-center gap-3">
                  <ChartBarIcon className="w-6 h-6 text-brand-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200">How your standards were ranked</h3>
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
                  <span>At Excellence</span>
                </div>
              </div>
            </div>
            
            {/* Standards count indicator */}
            <div className="px-6 py-3 bg-slate-800/30 border-b border-white/10">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-300">
                  Showing <span className="font-semibold text-brand-400">{allStandardsWithStatus.filter(s => s.is_used).length}</span> used
                  {allStandardsWithStatus.filter(s => !s.is_used).length > 0 && (
                    <span className="text-slate-500"> + <span className="font-semibold">{allStandardsWithStatus.filter(s => !s.is_used).length}</span> excluded</span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Scrollable standards container */}
            <div className="relative">
              <div className="max-h-[500px] overflow-y-auto p-6 space-y-3 custom-scrollbar">
                {allStandardsWithStatus.map((item, index) => {
                const isAtMaxGrade = item.is_used && item.grade === (item.standards_type?.toLowerCase().includes('unit') ? 'Achieved' : 'Excellence');
                const contributionPercent = item.is_used ? (item.contribution / yearsMap[activeYear].totals.total_contribution) * 100 : 0;
                
                return (
                  <div
                    key={`${item.standard_number}-${item.selection_rank}`}
                    className={`p-4 rounded-lg border transition-all ${
                      !item.is_used
                        ? 'bg-slate-900/30 border-slate-700/30 opacity-60'
                        : isAtMaxGrade
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-800/50 border-slate-700/50'
                    }`}
                  >
                    {!item.is_used && (
                      <div className="mb-3 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Not Used in ATAR</div>
                        <div className="text-[0.65rem] text-slate-500">{item.exclusion_reason}</div>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                          !item.is_used 
                            ? 'bg-slate-800/50 text-slate-500'
                            : isAtMaxGrade ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          {item.is_used ? index - allStandardsWithStatus.filter((s, i) => !s.is_used && i < index).length + 1 : '—'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`font-semibold mb-0.5 ${item.is_used ? 'text-slate-200' : 'text-slate-400'}`}>{item.standard_number}</div>
                          {item.title && (
                            <div className={`text-xs mb-1 line-clamp-2 ${item.is_used ? 'text-slate-300' : 'text-slate-500'}`}>{item.title}</div>
                          )}
                          <div className={`text-xs truncate ${item.is_used ? 'text-slate-400' : 'text-slate-500'}`}>{item.subject}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.grade && item.grade !== 'N/A' && (
                          <>
                            <span className={`text-xs px-2 py-1 rounded font-medium ${
                              !item.is_used 
                                ? 'bg-slate-800/50 text-slate-500'
                                : item.grade === 'Excellence' ? 'bg-emerald-500/20 text-emerald-300' :
                              item.grade === 'Merit' ? 'bg-blue-500/20 text-blue-300' :
                              item.grade === 'Achieved' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-red-500/20 text-red-300'
                        }`}>
                          {item.grade[0]}
                        </span>
                        {item.is_used && isAtMaxGrade && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/30">
                            <CheckIcon className="w-3.5 h-3.5 text-emerald-300 stroke-[2.5]" />
                          </div>
                        )}
                        {item.is_used && !isAtMaxGrade && (
                          <div className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/20 border border-amber-500/30">
                            <ArrowUpIcon className="w-3.5 h-3.5 text-amber-300 stroke-[2.5]" />
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    </div>
                    
                    {/* Show contribution and weight - contribution only for used standards */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        {item.is_used && (
                          <>
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
                          </>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`text-xs ${item.is_used ? 'text-slate-400' : 'text-slate-500'}`}>Weight</div>
                        <div className={`text-sm font-mono font-semibold ${item.is_used ? 'text-slate-200' : 'text-slate-500'}`}>
                          {item.weight_applied.toFixed(3)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              
              {/* Scroll fade indicator */}
              {allStandardsWithStatus.length > 5 && (
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
      {breakdown && activeYear && yearsMap[activeYear] && standardsByWeight.standards.length > 0 && (
        <div className="card overflow-hidden animate-reveal-up" style={{ animationDelay: '120ms' }}>
          <div className="p-6 border-b border-white/10">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 text-brand-400" />
                <div>
                  <h3 className="text-lg font-semibold text-slate-200">Your Standards with highest potential weight</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Difficulty weights if at an Excellence</p>
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
                Showing <span className="font-semibold text-brand-400">{standardsByWeight.standards.length}</span> standard{standardsByWeight.standards.length !== 1 ? 's' : ''}
                {standardsByWeight.standards.filter(s => !s.is_used).length > 0 && (
                  <span className="text-slate-500 ml-2">
                    (<span className="font-semibold">{standardsByWeight.standards.filter(s => !s.is_used).length}</span> not used)
                  </span>
                )}
              </span>
            </div>
          </div>
          
          {/* Scrollable standards container with fixed height */}
          <div className="relative">
            <div className="max-h-[600px] overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {standardsByWeight.standards.map((std, index) => {
                // Check if this is right after the cutoff
                const isAtCutoff = index === standardsByWeight.top90CutoffIndex;
                
                return (
                  <div key={std.standard_number}>
                    {/* Show cutoff indicator */}
                    {isAtCutoff && (
                      <div className="relative py-4 my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t-2 border-dashed border-amber-500/50"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-bold text-amber-300 uppercase tracking-wide">
                            Top 90 Credits Cutoff (at max grades)
                          </span>
                        </div>
                        <div className="text-center mt-2">
                          <p className="text-[0.65rem] text-amber-400/70">
                            Standards below this line would count if improved to max grade
                          </p>
                        </div>
                      </div>
                    )}
                    
                    <div
                      className={`relative overflow-hidden rounded-xl border transition-all ${
                        !std.is_used
                          ? 'bg-gradient-to-br from-slate-900/50 via-slate-900/30 to-slate-900/20 border-slate-700/30 opacity-70'
                          : std.is_at_max
                          ? 'bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-emerald-500/40'
                          : 'bg-gradient-to-br from-slate-800/80 via-slate-800/40 to-slate-800/20 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      {/* Not used indicator */}
                      {!std.is_used && (
                        <div className="absolute top-3 right-3 z-10">
                          <div className="px-2 py-1 bg-slate-800/80 border border-slate-700/50 rounded-md">
                            <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-wide">Not Used</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Decorative gradient accent */}
                      <div className={`absolute top-0 left-0 right-0 h-1 ${
                        !std.is_used
                          ? 'bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700'
                          : std.is_at_max
                        ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600' 
                        : 'bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600'
                    }`}></div>
                    
                    <div className="p-5">
                      {/* Header with Standard Info and Current Grade */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                            std.is_at_max 
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                              : 'bg-slate-700/60 text-slate-300 border border-slate-600/50'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-base text-slate-100">{std.standard_number}</span>
                              <span className={`text-[0.625rem] px-2 py-0.5 rounded-md font-semibold ${
                                std.is_external 
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                  : 'bg-slate-700/60 text-slate-400 border border-slate-600/50'
                              }`}>
                                {std.is_external ? 'EXT' : 'INT'}
                              </span>
                            </div>
                            {std.title && (
                              <div className="text-xs text-slate-300 mb-1 line-clamp-2 leading-relaxed">{std.title}</div>
                            )}
                            <div className="text-xs text-slate-400 truncate font-medium">{std.subject} • {std.credits} credits</div>
                          </div>
                        </div>
                        
                        {/* Current Grade Badge with Status Indicator */}
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <div className={`px-3 py-1.5 rounded-lg font-bold text-sm border ${
                            std.current_grade === 'Excellence' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                            std.current_grade === 'Merit' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                            std.current_grade === 'Achieved' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                            'bg-red-500/20 text-red-300 border-red-500/40'
                          }`}>
                            {std.current_grade}
                          </div>
                          {std.is_at_max && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/30">
                              <CheckIcon className="w-3.5 h-3.5 text-emerald-400 stroke-[2.5]" />
                              <span className="text-[0.625rem] font-semibold text-emerald-300">MAX</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Current Grade Weight Card */}
                      <div className={`mb-4 p-4 rounded-xl border ${
                        std.is_at_max
                          ? 'bg-emerald-500/5 border-emerald-500/20'
                          : 'bg-slate-800/60 border-slate-700/40'
                      }`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Your Current Performance</span>
                          {std.is_at_max && (
                            <CheckIcon className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[0.65rem] text-slate-400 mb-1 font-medium">Grade Achieved</div>
                            <div className="text-xl font-black text-slate-100">{std.current_grade}</div>
                          </div>
                          <div>
                            <div className="text-[0.65rem] text-slate-400 mb-1 font-medium">Weight @ {std.current_grade}</div>
                            <div className="text-xl font-black font-mono text-brand-400">{(std.current_weight * 100).toFixed(2)}%</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Historical Weights Comparison (2024-2022) */}
                      <div className="mb-4 p-4 rounded-xl bg-slate-900/40 border border-slate-700/30">
                        <div className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-3 flex items-center gap-2">
                          <CalendarDaysIcon className="w-3.5 h-3.5" />
                          Maximum Grade Weights Across Years
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { year: 2024, weight: std.weight_2024, highlight: true },
                            { year: 2023, weight: std.weight_2023, highlight: false },
                            { year: 2022, weight: std.weight_2022, highlight: false }
                          ].map(({ year, weight, highlight }) => (
                            weight !== undefined && (
                              <div key={year} className={`p-3 rounded-lg border ${
                                highlight 
                                  ? 'bg-brand-500/10 border-brand-500/30' 
                                  : 'bg-slate-800/50 border-slate-700/40'
                              }`}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="text-[0.65rem] text-slate-400 font-bold uppercase">{year}</div>
                                  {highlight && std.is_at_max && (
                                    <CheckIcon className="w-3 h-3 text-emerald-400" />
                                  )}
                                </div>
                                <div className={`text-base font-black font-mono ${
                                  highlight ? 'text-brand-400' : 'text-slate-200'
                                }`}>
                                  {(weight * 100).toFixed(2)}%
                                </div>
                                <div className="text-[0.6rem] text-slate-500 mt-1">@ {std.max_grade}</div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                      
                      {/* Status Message */}
                      {std.is_at_max ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                          <CheckIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-emerald-300">Achieved Maximum Grade</div>
                            <div className="text-[0.65rem] text-emerald-400/80 mt-0.5">
                              You earned the best possible weight for this standard ({std.max_grade})
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                          <ArrowUpIcon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-xs font-bold text-amber-300 mb-1">Improvement Opportunity</div>
                            <div className="text-[0.65rem] text-slate-400 leading-relaxed">
                              Achieving <span className="text-slate-200 font-bold">{std.max_grade}</span> would increase your weight to{' '}
                              <span className="font-mono text-brand-400 font-bold">{(std.max_weight * 100).toFixed(2)}%</span>
                              {' '}(+{((std.max_weight - std.current_weight) * 100).toFixed(2)}%)
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
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
            <p className="text-slate-400">
              Your ATAR is calculated from your <strong className="text-slate-200">best 90 Level 3 credits</strong> (by weight).
            </p>
            <p className="text-slate-400 mb-1">
              Each standard gets a <strong className="text-slate-200">difficulty weight</strong> based on how hard it was relative to others 
              that year; if fewer people got Excellence, the weight goes up. These weights change every year because they reflect 
              how the whole cohort performed, not the standard itself.
            </p>
            <p className="text-slate-400 mb-1">
              NZQA calculates a <strong className="text-slate-200">statistical score</strong> by taking the sum of your 90 best credits multiplied by their respective weights and then dividing the total by 90. 
              NZQA then ranks everyone by this score. The top 0.05% (around 30-40 students) get an ATAR of 99.95, the next 0.05% get an ATAR of 99.90, and so on.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 