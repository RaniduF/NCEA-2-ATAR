'use client';

import React from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import type { ATARResult } from '../app/services/api';

interface Props {
  results: ATARResult[] | null;
}

export function ATARResults({ results }: Props) {
  if (!results) {
    return <div className="text-slate-400">No results yet. Add standards and calculate to see your estimated ATAR across years.</div>;
  }
  if (results.length === 0) {
    return <div className="text-slate-400">No results returned for the selected standards.</div>;
  }

  const data = [...results].sort((a, b) => a.year - b.year);

  return (
    <div className="space-y-6">
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="year" stroke="#94a3b8" />
            <YAxis domain={[0, 100]} stroke="#94a3b8" />
            <Tooltip contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }} />
            <Line type="monotone" dataKey="estimated_atar" stroke="#0ea5e9" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-300">
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Estimated ATAR</th>
              <th className="px-3 py-2">Statistical Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.year} className="border-t border-white/10">
                <td className="px-3 py-2">{r.year}</td>
                <td className="px-3 py-2">{r.estimated_atar.toFixed(2)}</td>
                <td className="px-3 py-2">{r.statistical_value.toFixed(6)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 