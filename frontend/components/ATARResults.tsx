'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, SubjectSSPBreakdown, DistributionResponse } from '../app/services/api';
import { getDistribution } from '../app/services/api';
import { downloadCSV } from '../app/services/csv';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

interface Props {
  results: ATARResult[] | null;
  breakdown?: CalculationBreakdownResponse | null;
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
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-5 animate-reveal-in">
          <div className="flex items-center gap-3 mb-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-slate-200">Latest ATAR</h3>
          </div>
          <div className="text-2xl font-bold text-brand-400">{latestResult!.estimated_atar.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">{latestResult!.year}</div>
        </div>
        
        <div className="panel p-5 animate-reveal-in" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <CalendarDaysIcon className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-200">Year Range</h3>
          </div>
          <div className="text-2xl font-bold text-slate-200">
            {earliestResult.year} - {latestResult!.year}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.length} years</div>
        </div>
        
        <div className="panel p-5 animate-reveal-in" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <ChartBarIcon className="w-5 h-5 text-brand-300" />
            <h3 className="font-semibold text-slate-200">Percentile Rank</h3>
          </div>
          <div className="text-2xl font-bold text-brand-300">
            Top {percentileRank.toFixed(2)}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Of the cohort ({latestResult!.year})
          </div>
        </div>
      </div>

      {/* Two-Column Main Section: Credit Breakdown + Standards Focus */}
      {breakdown && activeYear && yearsMap[activeYear] && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-reveal-up" style={{ animationDelay: '80ms' }}>
          
          {/* LEFT COLUMN (60%): Credit Breakdown */}
          <div className="lg:col-span-3 card overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <ChartBarIcon className="w-6 h-6 text-brand-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200">Credit Breakdown (Top 90)</h3>
                    <p className="text-xs text-slate-400 mt-0.5">How your ATAR is calculated</p>
                  </div>
                </div>
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
              
              {/* Summary Stats */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="meta">Estimated ATAR: <span className="font-semibold text-brand-300">{yearsMap[activeYear].estimated_atar.toFixed(2)}</span></div>
                <div className="meta">Stat. value: <span className="font-mono text-slate-200">{yearsMap[activeYear].statistical_value.toFixed(6)}</span></div>
                <div className="meta">Credits used: <span className="font-semibold">{yearsMap[activeYear].totals.total_credits_used.toFixed(2)}</span> / 90</div>
                <div className="meta">Prorated: <span className="font-semibold">{yearsMap[activeYear].totals.prorated_count}</span></div>
              </div>
            </div>
            
            {/* Scrollable Table Container */}
            <div className="relative max-h-[60vh] overflow-y-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-700/50 sticky top-0 z-10">
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

          {/* RIGHT COLUMN (40%): Standards to Improve */}
          {activeYearForSubjects && yearsMap[activeYearForSubjects] && (
            <div className="lg:col-span-2 card overflow-hidden">
              <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <ArrowTrendingUpIcon className="w-6 h-6 text-amber-400" />
                  <div>
                    <h3 className="text-lg font-semibold text-slate-200">Focus Areas</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Standards you can improve</p>
                  </div>
                </div>
                
                {/* Filter Controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStandardsFilter('all')}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      standardsFilter === 'all' 
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' 
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    All ({getStandardsByContribution(activeYearForSubjects).length})
                  </button>
                  <button
                    onClick={() => setStandardsFilter('top10')}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      standardsFilter === 'top10' 
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' 
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Top 10
                  </button>
                  <button
                    onClick={() => setStandardsFilter('needsImprovement')}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      standardsFilter === 'needsImprovement' 
                        ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30' 
                        : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    Need Work ({getStandardsByContribution(activeYearForSubjects).filter(item => {
                      const maxGrade = getMaxGradeForStandard(item.standards_type);
                      return item.grade !== maxGrade;
                    }).length})
                  </button>
                </div>
              </div>
              
              {/* Scrollable Standards List */}
              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
                {getFilteredStandards(activeYearForSubjects).map((item, index) => {
                  const maxGrade = getMaxGradeForStandard(item.standards_type);
                  const isAtMaxGrade = item.grade === maxGrade;
                  const maxWeight = item.weight_at_max_grade ?? item.weight_applied;
                  const weightPercentage = (maxWeight * 100).toFixed(1);
                  
                  return (
                    <div
                      key={`${item.standard_number}-${item.selection_rank}`}
                      className={`p-3 rounded-lg border transition-all ${
                        isAtMaxGrade
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            isAtMaxGrade ? 'bg-emerald-500/20' : 'bg-slate-700/50'
                          }`}>
                            <span className={`font-bold text-xs ${
                              isAtMaxGrade ? 'text-emerald-300' : 'text-slate-300'
                            }`}>#{index + 1}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-200 text-sm leading-tight">
                              {item.standard_number}
                            </div>
                            <div className="text-xs text-slate-400">{item.subject}</div>
                          </div>
                        </div>
                        {isAtMaxGrade && (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-emerald-500/20 border border-emerald-500/30">
                            <CheckIcon className="w-4 h-4 text-emerald-300 stroke-[2.5]" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-slate-400 text-xs">Credits</div>
                          <div className="text-slate-200 font-semibold text-sm">{item.credits_available}</div>
                        </div>
                        <div>
                          <div className="text-slate-400 text-xs">Max Weight</div>
                          <div className="text-brand-400 font-bold text-base">{weightPercentage}%</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Distribution Histogram - Made More Compact */}
      <div className="card p-6 animate-reveal-up" style={{ animationDelay: '120ms' }}>
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
          <div className="h-64 w-full reveal reveal-in">
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

      {/* Secondary Data: Detailed Results Table & Subject Rankings (Collapsed Accordion Style) */}
      <details className="card overflow-hidden animate-reveal-up" style={{ animationDelay: '160ms' }}>
        <summary className="p-6 border-b border-white/10 cursor-pointer hover:bg-slate-700/20 transition-colors list-none">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <InformationCircleIcon className="w-6 h-6 text-brand-400" />
              <h3 className="text-lg font-semibold text-slate-200">Additional Details</h3>
              <span className="text-xs text-slate-400">(Yearly Results & Subject Rankings)</span>
            </div>
            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
          </div>
        </summary>
        
        <div className="p-6 space-y-6">
          {/* Detailed Results Table */}
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
          <div className="text-sm text-slate-300">
            <p className="font-medium mb-1 text-slate-200">About ATAR Rankings</p>
            <p className="text-slate-400 mb-2">
              ATAR is a <strong className="text-slate-200">ranking system</strong>, not a score. Each year is independent—your ATAR depends on how 
              you perform relative to your entire age cohort, including those who left school or study under other systems.
            </p>
            <p className="text-slate-400">
              An ATAR of 99.95 means you&apos;re in the top 0.05% of your cohort. These estimates use historical distributions 
              and may vary from official calculations. Each year&apos;s distribution reflects that cohort&apos;s performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 