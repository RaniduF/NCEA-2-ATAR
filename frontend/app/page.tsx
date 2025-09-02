'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { SearchStandards } from '../components/SearchStandards';
import { SelectedStandards } from '../components/SelectedStandards';
import { ATARResults } from '../components/ATARResults';
import { PortfolioManager } from '../components/PortfolioManager';
import { calculateATAR, type ATARResult, type Standard } from './services/api';
import { portfolioService } from './services/portfolio';

export type Grade = 'Excellence' | 'Merit' | 'Achieved' | 'Not Achieved';

export interface SelectedItem {
  standard: Standard;
  grade: Grade;
  year_achieved?: number;
  standard_version?: number;
}

export default function Page() {
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [results, setResults] = useState<ATARResult[] | null>(null);
  const [isPortfolioManagerOpen, setIsPortfolioManagerOpen] = useState(false);
  const selectedIds = useMemo(() => new Set(selectedItems.map(i => i.standard.standard_number)), [selectedItems]);

  // Load auto-saved portfolio on component mount
  useEffect(() => {
    const autoSaved = portfolioService.loadAutoSave();
    if (autoSaved && autoSaved.length > 0) {
      setSelectedItems(autoSaved);
    }
  }, []);

  // Auto-save whenever selectedItems changes (with debounce)
  useEffect(() => {
    if (selectedItems.length > 0) {
      const timeoutId = setTimeout(() => {
        portfolioService.autoSave(selectedItems);
      }, 1000); // Debounce for 1 second

      return () => clearTimeout(timeoutId);
    }
  }, [selectedItems]);

  const handleAddStandard = (standard: Standard) => {
    if (selectedIds.has(standard.standard_number)) return;
    setSelectedItems(prev => [...prev, { standard, grade: 'Achieved' }]); // No year_achieved = iterative default
  };

  const handleRemoveStandard = (standardNumber: number) => {
    setSelectedItems(prev => prev.filter(item => item.standard.standard_number !== standardNumber));
  };

  const handleChangeGrade = (standardNumber: number, grade: Grade) => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, grade } : item));
  };

  const handleChangeYear = (standardNumber: number, year_achieved: number | undefined) => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, year_achieved } : item));
  };

  const handleChangeVersion = (standardNumber: number, standard_version: number | undefined) => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, standard_version } : item));
  };

  const handleClearPortfolio = () => {
    setSelectedItems([]);
    setResults(null);
    portfolioService.clearAutoSave();
  };

  const handleSavePortfolio = () => {
    if (selectedItems.length === 0) {
      alert('No standards to save');
      return;
    }

    const name = prompt('Enter a name for this portfolio:');
    if (name) {
      portfolioService.savePortfolio(name.trim(), selectedItems);
      portfolioService.clearAutoSave(); // Clear auto-save after explicit save
      alert(`Portfolio "${name}" saved successfully!`);
    }
  };

  const handleLoadPortfolio = (items: SelectedItem[]) => {
    setSelectedItems(items);
    setResults(null); // Clear previous calculation results
    portfolioService.clearAutoSave(); // Clear auto-save when loading explicit portfolio
  };

  const handleCalculate = async () => {
    setIsCalculating(true);
    setResults(null);
    try {
      const payload = selectedItems.map(item => ({ 
        standard_number: item.standard.standard_number, 
        grade: item.grade,
        year_achieved: item.year_achieved,
        standard_version: item.standard_version
      }));
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
          <SearchStandards onAdd={handleAddStandard} onRemove={handleRemoveStandard} selectedStandardIds={selectedIds} />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/60 border border-white/10">
        <div className="p-6 border-b border-white/10">
          <h2 className="text-xl font-semibold">Selected standards</h2>
          <p className="text-slate-300 mt-1">Adjust grades and remove anything you don't want to include.</p>
        </div>
        <div className="p-6">
          <SelectedStandards items={selectedItems} onRemove={handleRemoveStandard} onChangeGrade={handleChangeGrade} onChangeYear={handleChangeYear} onChangeVersion={handleChangeVersion} />
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={handleSavePortfolio}
                disabled={selectedItems.length === 0}
              >
                Save Portfolio
              </button>
              <button
                className="px-4 py-2 rounded-lg border border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                onClick={() => setIsPortfolioManagerOpen(true)}
              >
                My Portfolios
              </button>
              {selectedItems.length > 0 && (
                <span className="text-xs text-slate-500">Auto-saving...</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-white/10 text-slate-200 hover:bg-white/5"
                onClick={handleClearPortfolio}
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

      <PortfolioManager 
        isOpen={isPortfolioManagerOpen}
        onClose={() => setIsPortfolioManagerOpen(false)}
        onLoadPortfolio={handleLoadPortfolio}
      />
    </div>
  );
} 