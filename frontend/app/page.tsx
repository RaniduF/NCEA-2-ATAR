'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SearchStandards } from '../components/SearchStandards';
import { SelectedStandards } from '../components/SelectedStandards';
import { ATARResults } from '../components/ATARResults';
import { PortfolioManager } from '../components/PortfolioManager';
import { calculateATAR, calculateATARBreakdown, type ATARResult, type Standard, type CalculationBreakdownResponse } from './services/api';
import { portfolioService } from './services/portfolio';
import {
  BookmarkIcon,
  FolderOpenIcon,
  TrashIcon,
  CalculatorIcon,
  SparklesIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { useReveal } from './hooks/useReveal';
import { useRipple } from './hooks/useRipple';
import type { SavedPortfolio } from './services/portfolio';
import { useToast } from './providers/ToastProvider';

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
  const [breakdown, setBreakdown] = useState<CalculationBreakdownResponse | null>(null);
  const [isPortfolioManagerOpen, setIsPortfolioManagerOpen] = useState(false);
  const [currentPortfolioId, setCurrentPortfolioId] = useState<string | undefined>(undefined);
  const [currentPortfolioName, setCurrentPortfolioName] = useState<string | undefined>(undefined);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [justSaved, setJustSaved] = useState<null | 'saved' | 'renamed'>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const selectedIds = useMemo(() => new Set(selectedItems.map(i => i.standard.standard_number)), [selectedItems]);
  const [existingPortfolios, setExistingPortfolios] = useState<SavedPortfolio[]>([]);

  // Helper to deeply compare item arrays ignoring order
  const areItemArraysEqual = (a: SelectedItem[], b: SelectedItem[]): boolean => {
    if (a.length !== b.length) return false;
    const sortKey = (x: SelectedItem) => x.standard.standard_number;
    const sa = [...a].sort((x, y) => sortKey(x) - sortKey(y));
    const sb = [...b].sort((x, y) => sortKey(x) - sortKey(y));
    for (let i = 0; i < sa.length; i++) {
      const ia = sa[i];
      const ib = sb[i];
      if (ia.standard.standard_number !== ib.standard.standard_number) return false;
      if (ia.grade !== ib.grade) return false;
      if ((ia.year_achieved ?? null) !== (ib.year_achieved ?? null)) return false;
      if ((ia.standard_version ?? null) !== (ib.standard_version ?? null)) return false;
    }
    return true;
  };

  const hasUnsavedChanges = useMemo(() => {
    if (selectedItems.length === 0) return false;
    if (!currentPortfolioId) return true; // building a new one
    const current = portfolioService.getPortfolio(currentPortfolioId);
    if (!current) return true;
    return !areItemArraysEqual(selectedItems, current.items);
  }, [selectedItems, currentPortfolioId]);

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

  // Load portfolios when opening the save modal
  useEffect(() => {
    if (showSaveModal) {
      setExistingPortfolios(portfolioService.getPortfolios());
    }
  }, [showSaveModal]);

  // Trigger reveal animations on scroll
  useReveal();
  // Enable ripple on buttons with .ripple class
  useRipple('.ripple');

  const handleAddStandard = (standard: Standard): void => {
    if (selectedIds.has(standard.standard_number)) return;
    setSelectedItems(prev => [...prev, { standard, grade: 'Achieved' }]); // No year_achieved = iterative default
  };

  const handleRemoveStandard = (standardNumber: number): void => {
    setSelectedItems(prev => prev.filter(item => item.standard.standard_number !== standardNumber));
  };

  const handleChangeGrade = (standardNumber: number, grade: Grade): void => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, grade } : item));
  };

  const handleChangeYear = (standardNumber: number, year_achieved: number | undefined): void => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, year_achieved } : item));
  };

  const handleChangeVersion = (standardNumber: number, standard_version: number | undefined): void => {
    setSelectedItems(prev => prev.map(item => item.standard.standard_number === standardNumber ? { ...item, standard_version } : item));
  };

  const handleClearPortfolio = (): void => {
    setSelectedItems([]);
    setResults(null);
    setBreakdown(null);
    portfolioService.clearAutoSave();
    setCurrentPortfolioId(undefined);
    setCurrentPortfolioName(undefined);
  };

  const handleSavePortfolio = (): void => {
    if (selectedItems.length === 0) return;
    setNewPortfolioName(currentPortfolioName || 'My Portfolio');
    setShowSaveModal(true);
  };

  const handleLoadPortfolio = (payload: { id?: string; name?: string; items: SelectedItem[] }): void => {
    setSelectedItems(payload.items);
    setResults(null); // Clear previous calculation results
    setBreakdown(null);
    portfolioService.clearAutoSave(); // Clear auto-save when loading explicit portfolio
    setCurrentPortfolioId(payload.id);
    setCurrentPortfolioName(payload.name);
  };

  const handleConfirmCreate = (): void => {
    const name = newPortfolioName.trim();
    if (!name) return;
    const saved = portfolioService.savePortfolio(name, selectedItems);
    portfolioService.clearAutoSave();
    setCurrentPortfolioId(saved.id);
    setCurrentPortfolioName(saved.name);
    setShowSaveModal(false);
    setJustSaved('saved');
    setTimeout(() => setJustSaved(null), 1500);
  };

  const handleOverwriteExisting = (id: string): void => {
    const updated = portfolioService.updatePortfolio(id, { items: selectedItems });
    if (updated) {
      portfolioService.clearAutoSave();
      setCurrentPortfolioId(updated.id);
      setCurrentPortfolioName(updated.name);
      setShowSaveModal(false);
      setJustSaved('saved');
      setTimeout(() => setJustSaved(null), 1500);
    }
  };

  const { showError } = useToast();

  const handleCalculate = async (): Promise<void> => {
    setIsCalculating(true);
    setResults(null);
    setBreakdown(null);
    try {
      const payload = selectedItems.map(item => ({
        standard_number: item.standard.standard_number,
        grade: item.grade,
        year_achieved: item.year_achieved,
        standard_version: item.standard_version
      }));
      const data = await calculateATAR(payload);
      setResults(data);
      // Fire breakdown fetch in parallel; guard against stale responses
      const reqId = crypto.randomUUID();
      let activeId = reqId;
      calculateATARBreakdown(payload)
        .then((b) => {
          if (activeId === reqId) setBreakdown(b);
        })
        .catch(console.error);

      // On mobile, scroll to results
      if (window.innerWidth < 1024) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        });
      }
    } catch (err) {
      console.error(err);
      showError('Failed to calculate ATAR. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const totalCredits = selectedItems.reduce((sum: number, item: SelectedItem) => sum + item.standard.credits, 0);

  return (
    <div className="grid lg:grid-cols-12 gap-8 items-start relative">
      {/* LEFT COLUMN: Input & Portfolio (Scrollable) */}
      <div className="lg:col-span-7 space-y-8">

        {/* Hero / Intro */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900/50 via-slate-900/50 to-slate-900/50 border border-white/10 p-8 md:p-10 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 tracking-tight font-display">
              Build your <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-300 to-accent-400">NCEA Profile</span>
            </h1>
            <p className="text-lg text-slate-300 max-w-xl leading-relaxed">
              Search for your standards, assign your grades, and instantly estimate your Australian ATAR rank.
            </p>
          </div>
        </section>

        {/* Search Section */}
        <section className="glass-panel p-1">
          <SearchStandards onAdd={handleAddStandard} onRemove={handleRemoveStandard} selectedStandardIds={selectedIds} />
        </section>

        {/* Selected Standards List */}
        <section className="glass-panel p-6 md:p-8 min-h-[400px]">
          <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-500/10 border border-brand-500/20">
                <BookmarkIcon className="w-5 h-5 text-brand-300" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Your Portfolio</h2>
                <p className="text-sm text-slate-400">Manage your standards and grades</p>
              </div>
            </div>
            {selectedItems.length > 0 && (
              <div className="text-right">
                <div className="text-2xl font-bold text-brand-300 font-display">{totalCredits}</div>
                <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Credits</div>
              </div>
            )}
          </div>

          <SelectedStandards
            items={selectedItems}
            onRemove={handleRemoveStandard}
            onChangeGrade={handleChangeGrade}
            onChangeYear={handleChangeYear}
            onChangeVersion={handleChangeVersion}
          />

          {/* Action Bar */}
          <div className="mt-8 pt-6 border-t border-white/5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                className={`btn-ghost gap-2 ${hasUnsavedChanges ? 'text-brand-300 border-brand-500/30 bg-brand-500/5' : ''}`}
                onClick={handleSavePortfolio}
                disabled={selectedItems.length === 0}
              >
                <BookmarkIcon className="w-4 h-4" />
                {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
              </button>
              <button
                className="btn-ghost gap-2"
                onClick={() => setIsPortfolioManagerOpen(true)}
              >
                <FolderOpenIcon className="w-4 h-4" />
                Load
              </button>
              {justSaved && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 animate-reveal-in">
                  <CheckCircleIcon className="w-3.5 h-3.5" />
                  <span>{justSaved === 'saved' ? 'Saved' : 'Renamed'}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                className="btn-danger flex-1 sm:flex-none justify-center"
                onClick={handleClearPortfolio}
                disabled={selectedItems.length === 0}
              >
                <TrashIcon className="w-4 h-4" />
                Clear
              </button>

              {/* Mobile Calculate Button (Hidden on LG) */}
              <button
                className="lg:hidden btn-primary flex-1 sm:flex-none justify-center shadow-glow-sm"
                onClick={handleCalculate}
                disabled={selectedItems.length === 0 || isCalculating}
              >
                {isCalculating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Calculating...
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
        </section>
      </div>

      {/* RIGHT COLUMN: Results (Sticky) */}
      <div className="lg:col-span-5 lg:sticky lg:top-24 space-y-6" ref={resultsRef}>
        {/* Calculate Button (Desktop Only) */}
        <div className="hidden lg:block">
          <button
            className="w-full py-4 text-lg font-bold tracking-wide btn-primary shadow-xl shadow-brand-600/20 hover:shadow-brand-600/30 hover:scale-[1.02] transition-all duration-300 group"
            onClick={handleCalculate}
            disabled={selectedItems.length === 0 || isCalculating}
          >
            <div className="flex items-center justify-center gap-3">
              {isCalculating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Crunching the numbers...</span>
                </>
              ) : (
                <>
                  <SparklesIcon className="w-6 h-6 text-brand-200 group-hover:animate-pulse" />
                  <span>Calculate Estimate</span>
                  <ArrowRightIcon className="w-5 h-5 opacity-60 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </div>
          </button>
        </div>

        {/* Results Component */}
        <div className={`transition-all duration-500 ${results ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
          <ATARResults results={results} breakdown={breakdown} />
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] animate-reveal-in p-4">
          <div className="glass-panel w-full max-w-md overflow-hidden shadow-2xl border border-white/10">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-xl font-semibold text-white">Save Portfolio</h3>
              <p className="text-sm text-slate-400 mt-1">Create new or overwrite existing</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Portfolio</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="e.g., Engineering Prerequisites"
                    value={newPortfolioName}
                    onChange={(e) => setNewPortfolioName(e.target.value)}
                    autoFocus
                  />
                </div>
                <button
                  className="btn-primary w-full justify-center"
                  onClick={handleConfirmCreate}
                  disabled={!newPortfolioName.trim()}
                >
                  Save as New
                </button>
              </div>

              {existingPortfolios.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Overwrite Existing</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {existingPortfolios
                      .slice()
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleOverwriteExisting(p.id)}
                          className={`w-full text-left p-3 rounded-xl border border-white/5 hover:bg-white/5 hover:border-white/10 transition-all group ${currentPortfolioId === p.id ? 'bg-brand-500/10 border-brand-500/20' : 'bg-slate-900/40'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-200 group-hover:text-white truncate">{p.name}</span>
                            {currentPortfolioId === p.id && <CheckCircleIcon className="w-4 h-4 text-brand-400" />}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            {new Date(p.updatedAt).toLocaleDateString()} • {p.items.length} standards
                          </div>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-slate-950/30 border-t border-white/5 flex justify-end">
              <button className="btn-ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <PortfolioManager
        isOpen={isPortfolioManagerOpen}
        onClose={() => setIsPortfolioManagerOpen(false)}
        onLoadPortfolio={handleLoadPortfolio}
      />
    </div>
  );
}