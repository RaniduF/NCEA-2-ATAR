'use client';

import React from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ATARResult } from '../app/services/api';
import { 
  ChartBarIcon, 
  CalendarDaysIcon, 
  AcademicCapIcon,
  ArrowTrendingUpIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

interface Props {
  results: ATARResult[] | null;
}

export function ATARResults({ results }: Props) {
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

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-brand-400" />
            <h3 className="font-semibold text-slate-200">Latest ATAR</h3>
          </div>
          <div className="text-2xl font-bold text-brand-400">{latestResult.estimated_atar.toFixed(2)}</div>
          <div className="text-xs text-slate-400 mt-1">{latestResult.year}</div>
        </div>
        
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <CalendarDaysIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-slate-200">Year Range</h3>
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {earliestResult.year} - {latestResult.year}
          </div>
          <div className="text-xs text-slate-400 mt-1">{data.length} years</div>
        </div>
        
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-2">
            <ChartBarIcon className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-slate-200">Trend</h3>
          </div>
          <div className={`text-2xl font-bold ${trend >= 0 ? 'text-success-400' : 'text-error-400'}`}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {trend >= 0 ? 'Improving' : 'Declining'} over time
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="card p-6">
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
                formatter={(value: any, name: string) => [
                  `${parseFloat(value).toFixed(2)}`,
                  'ATAR Score'
                ]}
                labelFormatter={(label) => `Year ${label}`}
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
      <div className="card overflow-hidden">
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

      {/* Info Note */}
      <div className="panel p-4 border border-info-500/20">
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