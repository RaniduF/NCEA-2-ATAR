'use client';

import React, { useMemo, useState } from 'react';
import { SearchStandards } from '../components/SearchStandards';
import { SelectedStandards } from '../components/SelectedStandards';
import { ATARResults } from '../components/ATARResults';
import { calculateATAR, type ATARResult, type Standard } from './services/api';

export type Grade = 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved';

export interface SelectedItem {
  standard: Standard;
  grade: Grade;
}

export default function Page() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<ATARResult[] | null>(null);
  const selectedIds = useMemo(() => new Set(selectedItems.map(i => i.standard.standard_number)), [selectedItems]);

  const handleAddStandard = (standard: Standard) => {
    if (selectedIds.has(standard.standard_number)) return;
    setSelectedItems(prev => [...prev, { standard, grade: 'Achieved' }]);
  };

  const handleRemoveStandard = (standardNumber: number) => {
    setSelectedItems(prev => prev.filter(item => item.standard.standard_number !== standardNumber));
  };

  const handleChangeGrade = (standardNumber: number, grade: Grade) => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, grade } : item));
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setResults(null);
    try {
      const payload = selectedItems.map(item => ({ standard_number: item.standard.standard_number, grade: item.grade }));
      const data = await calculateATAR(payload);
      setResults(data);
    } catch (err) {
      console.error(err);
      alert('Failed to calculate ATAR. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl shadow-black/20">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-2xl font-semibold tracking-tight">Build your NCEA profile</h1>
          <p className="text-slate-300 mt-1">Search your subjects or standards, add them, and assign your grades.</p>
        </div>
        <div className="p-6">
          <SearchStandards onAdd={handleAddStandard} selectedStandardIds={selectedIds} />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/60 border border-white/10">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Selected standards</h2>
          <p className="text-slate-300 mt-1">Adjust grades and remove anything you don't want to include.</p>
        </div>
        <div className="p-6">
          <SelectedStandards items={selectedItems} onRemove={handleRemoveStandard} onChangeGrade={handleChangeGrade} />
          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              className="px-4 py-2 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5"
              onClick={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              Clear
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCalculate}
              disabled={selectedItems.length === 0 || isCalculating}
            >
              {isCalculating ? 'Calculating…' : 'Calculate ATAR'}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/60 border border-white/10">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Results</h2>
          <p className="text-slate-300 mt-1">Estimated ATAR by year from your entered standards.</p>
        </div>
        <div className="p-6">
          <ATARResults results={results} />
        </div>
      </section>
    </div>
  );
} 