'use client';

import React from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ATARResult, CalculationBreakdownResponse, YearlyBreakdown, SubjectSSPBreakdown } from '../app/services/api';
import { downloadCSV } from '../app/services/csv';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface Props {
  results: ATARResult[] | null;
  breakdown?: CalculationBreakdownResponse | null;
}

export function ATARResults({ results, breakdown }: Props) {
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
  
  if (results.length === 0) {
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

  const data = [...results].sort((a, b) => a.year - b.year);
  const latestResult = data[data.length - 1];
  const earliestResult = data[0];
  const trend = latestResult.estimated_atar - earliestResult.estimated_atar;

  const yearsMap: Record<number, YearlyBreakdown> = {};
  const subjectsByYear: Record<number, SubjectSSPBreakdown[]> = {};
  if (breakdown) {
    for (const y of breakdown.years) yearsMap[y.year] = y;
    for (const s of breakdown.subjects) {
      if (!subjectsByYear[s.year]) subjectsByYear[s.year] = [];
      subjectsByYear[s.year].push(s);
    }
  }
  const availableYears = data.map(d => d.year);
  const [activeYear, setActiveYear] = React.useState<number | null>(availableYears.length ? availableYears[availableYears.length - 1] : null);

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-5 animate-reveal-in">
          <div className="flex items-center gap-3 mb-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-slate-200">Latest ATAR</h3>
          </div>
          <div className="text-2xl font-bold text-brand-400">{latestResult.estimated_atar.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">{latestResult.year}</div>
        </div>
        
        <div className="panel p-5 animate-reveal-in" style={{ animationDelay: '80ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <CalendarDaysIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-200">Year Range</h3>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {earliestResult.year} - {latestResult.year}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.length} years</div>
        </div>
        
        <div className="panel p-5 animate-reveal-in" style={{ animationDelay: '160ms' }}>
          <div className="flex items-center gap-3 mb-2">
            <ChartBarIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-slate-200">Trend</h3>
          </div>
          <div className={`${trend >= 0 ? 'text-success-400' : 'text-error-400'} text-2xl font-bold`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {trend >= 0 ? 'Improving' : 'Declining'} over time
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6 animate-reveal-up">
        <div className="flex items-center gap-3 mb-6">
          <ChartBarIcon className="w-6 h-6 text-brand-400" />
          <h3 className="text-lg font-semibold text-slate-200">ATAR Trend</h3>
        </div>
        <div className="h-80 w-full reveal reveal-in">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="year" 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                domain={[0, 100]} 
                stroke="#94a3b8" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
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
                formatter={(value: number | string): [string, string] => [
                  `${parseFloat(String(value)).toFixed(2)}`,
                  'ATAR Score'
                ]}
                labelFormatter={(label: number | string) => `Year ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="estimated_atar" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ fill: '#6366f1', strokeWidth: 2, r: 6 }}
                activeDot={{ r: 8, fill: '#6366f1', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="card overflow-hidden animate-reveal-up" style={{ animationDelay: '120ms' }}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <InformationCircleIcon className="w-6 h-6 text-brand-400" />
            <h3 className="text-lg font-semibold text-slate-200">Detailed Results</h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  <div className="flex items-center gap-2">
                    <CalendarDaysIcon className="w-4 h-4" />
                    Year
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  <div className="flex items-center gap-2">
                    <ArrowTrendingUpIcon className="w-4 h-4" />
                    Estimated ATAR
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                  <div className="flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4" />
                    Statistical Value
                  </div>
                </th>
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

      {/* Credit Breakdown and Year Toggle */}
      {breakdown && activeYear && yearsMap[activeYear] && (
        <div className="card animate-reveal-up" style={{ animationDelay: '160ms' }}>
          <div className="p-6 border-b border-white/10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ChartBarIcon className="w-6 h-6 text-brand-400" />
              <h3 className="text-lg font-semibold text-slate-200">Credit Breakdown (Top 90, subject cap 24, pro‑rating)</h3>
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
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="meta">Estimated ATAR: <span className="font-semibold text-brand-300">{yearsMap[activeYear].estimated_atar.toFixed(2)}</span></div>
              <div className="meta">Stat. value: <span className="font-mono text-slate-200">{yearsMap[activeYear].statistical_value.toFixed(6)}</span></div>
              <div className="meta">Credits used: <span className="font-semibold">{yearsMap[activeYear].totals.total_credits_used.toFixed(2)}</span> / 90</div>
              <div className="meta">Prorated items: <span className="font-semibold">{yearsMap[activeYear].totals.prorated_count}</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Standard</th>
                    <th className="px-4 py-3 text-left">Subject</th>
                    <th className="px-4 py-3 text-left">UE</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Grade</th>
                    <th className="px-4 py-3 text-right">Credits (used)</th>
                    <th className="px-4 py-3 text-right">Weight</th>
                    <th className="px-4 py-3 text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {yearsMap[activeYear].best90.map(item => (
                    <tr key={`${item.standard_number}-${item.selection_rank}`}>
                      <td className="px-4 py-3 text-slate-300">{item.selection_rank}</td>
                      <td className="px-4 py-3">
                        <div className="text-slate-200 font-medium">{item.standard_number}{item.title ? `: ${item.title}` : ''}</div>
                        <div className="text-xs text-slate-400">Year {item.year_achieved} • Tier {item.priority_tier}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{item.subject}</td>
                      <td className="px-4 py-3">{item.is_ue ? <span className="badge-ue">UE</span> : '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{item.standards_type || '-'}</td>
                      <td className="px-4 py-3 text-slate-300">{item.grade}</td>
                      <td className="px-4 py-3 text-right text-slate-200">
                        {item.credits_available}
                        <span className="text-slate-400"> → </span>
                        <span className="font-semibold">{item.credits_used.toFixed(2)}</span>
                        {item.pro_rated && <span className="ml-2 badge-warning">Pro‑rated</span>}
                        {item.subject_capped && <span className="ml-2 badge-info">Subject 24 cap hit</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{item.weight_applied.toFixed(3)}</td>
                      <td className="px-4 py-3 text-right font-mono">{item.contribution.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subject SSP Rankings */}
      {breakdown && activeYear && subjectsByYear[activeYear] && (
        <div className="card animate-reveal-up" style={{ animationDelay: '200ms' }}>
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <AcademicCapIcon className="w-6 h-6 text-brand-400" />
            <h3 className="text-lg font-semibold text-slate-200">Subject Rankings (SSP, 18 credits)</h3>
            <button
              onClick={() => {
                const subs = subjectsByYear[activeYear] || [];
                const headers = ['Subject','Eligible','SSP score'];
                const rows = subs
                  .slice()
                  .sort((a, b) => (b.ssp_score ?? -1) - (a.ssp_score ?? -1))
                  .map(s => [s.subject, s.eligible ? 'Yes' : 'No', s.ssp_score ?? '']);
                downloadCSV(`ssp_${activeYear}.csv`, headers, rows);
              }}
              className="ml-auto btn-ghost text-xs"
            >Export CSV</button>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Eligible</th>
                  <th className="px-4 py-3 text-right">SSP score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {subjectsByYear[activeYear]
                  .slice()
                  .sort((a, b) => (b.ssp_score ?? -1) - (a.ssp_score ?? -1))
                  .map(s => (
                    <tr key={s.subject}>
                      <td className="px-4 py-3 text-slate-200 font-medium">{s.subject}</td>
                      <td className="px-4 py-3">{s.eligible ? <span className="badge-success">Yes</span> : <span className="badge-error">No (\u2265 18 credits required)</span>}</td>
                      <td className="px-4 py-3 text-right font-mono">{s.ssp_score != null ? s.ssp_score.toFixed(3) : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="panel p-4 border border-info-500/20 animate-reveal-in" style={{ animationDelay: '200ms' }}>
        <div className="flex items-start gap-3">
          <InformationCircleIcon className="w-5 h-5 text-info-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-info-200">
            <p className="font-medium mb-1">About these estimates</p>
            <p className="text-info-300">
              ATAR estimates are calculated using historical data and statistical modeling. 
              Results may vary based on actual university entrance requirements and annual cohort performance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 