'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { SearchStandards } from '../components/SearchStandards';
import { SelectedStandards } from '../components/SelectedStandards';
import { ATARResults } from '../components/ATARResults';
import { PortfolioManager } from '../components/PortfolioManager';
import { calculateATAR, type ATARResult, type Standard } from './services/api';
import { portfolioService } from './services/portfolio';
import { 
  BookmarkIcon, 
  FolderOpenIcon, 
  TrashIcon, 
  CalculatorIcon,
  SparklesIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid';
import { useReveal } from './hooks/useReveal';
import { useRipple } from './hooks/useRipple';

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

  // Trigger reveal animations on scroll
  useReveal();
  // Enable ripple on buttons with .ripple class
  useRipple('.ripple');

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

  const totalCredits = selectedItems.reduce((sum, item) => sum + item.standard.credits, 0);
  const hasAutoSave = selectedItems.length > 0;

  return (
    <div className="space-y-8">
      <section className="relative z-50 rounded-2xl bg-slate-900/60 border border-white/10 shadow-xl shadow-black/20 backdrop-blur reveal reveal-up">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <SparklesIcon className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl font-semibold tracking-tight">Build your NCEA profile</h1>
          </div>
          <p className="text-slate-300">Search your subjects or standards, add them, and assign your grades.</p>
        </div>
        <div className="p-6">
          <SearchStandards onAdd={handleAddStandard} onRemove={handleRemoveStandard} selectedStandardIds={selectedIds} />
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur reveal reveal-up">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookmarkSolidIcon className="w-6 h-6 text-brand-400" />
              <div>
                <h2 className="text-xl font-semibold">Selected standards</h2>
                <p className="text-slate-300 text-sm">Adjust grades and remove anything you don't want to include.</p>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="text-right">
                <div className="text-lg font-semibold text-brand-400">{totalCredits} credits</div>
                <div className="text-xs text-slate-400">{selectedItems.length} standards selected</div>
              </div>
            )}
          </div>
        </div>
        <div className="p-6">
          <SelectedStandards items={selectedItems} onRemove={handleRemoveStandard} onChangeGrade={handleChangeGrade} onChangeYear={handleChangeYear} onChangeVersion={handleChangeVersion} />
          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="ripple px-4 py-2.5 rounded-xl border border-brand-500/50 text-brand-400 hover:bg-brand-500/10 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSavePortfolio}
                disabled={selectedItems.length === 0}
              >
                <BookmarkIcon className="w-4 h-4" />
                Save Portfolio
              </button>
              <button
                className="ripple px-4 py-2.5 rounded-xl border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 transition-all duration-200 flex items-center gap-2"
                onClick={() => setIsPortfolioManagerOpen(true)}
              >
                <FolderOpenIcon className="w-4 h-4" />
                My Portfolios
              </button>
              {hasAutoSave && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-800/50 px-3 py-2 rounded-lg">
                  <ClockIcon className="w-3 h-3" />
                  <span>Auto-saving...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                className="ripple px-4 py-2.5 rounded-xl border border-error-500/50 text-error-400 hover:bg-error-500/10 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleClearPortfolio}
                disabled={selectedItems.length === 0}
              >
                <TrashIcon className="w-4 h-4" />
                Clear All
              </button>
              <button
                className="ripple px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-card hover:shadow-card-hover"
                onClick={handleCalculate}
                disabled={selectedItems.length === 0 || isCalculating}
              >
                {isCalculating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Calculating…
                  </>
                ) : (
                  <>
                    <CalculatorIcon className="w-4 h-4" />
                    Calculate ATAR
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur reveal reveal-up">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <CalculatorIcon className="w-6 h-6 text-brand-400" />
            <div>
              <h2 className="text-xl font-semibold">Results</h2>
              <p className="text-slate-300 text-sm">Estimated ATAR by year from your entered standards.</p>
            </div>
          </div>
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