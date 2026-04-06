'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { SearchStandards } from '../components/SearchStandards';
import { SelectedStandards } from '../components/SelectedStandards';
import { ATARResults } from '../components/ATARResults';
import { PortfolioManager } from '../components/PortfolioManager';
import { calculateATAR, calculateATARBreakdown, type ATARResult, type Standard, type CalculationBreakdownResponse } from './services/api';
import { portfolioService } from './services/portfolio';
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
    if (!currentPortfolioId) return true;
    const current = portfolioService.getPortfolio(currentPortfolioId);
    if (!current) return true;
    return !areItemArraysEqual(selectedItems, current.items);
  }, [selectedItems, currentPortfolioId]);

  useEffect(() => {
    const autoSaved = portfolioService.loadAutoSave();
    if (autoSaved && autoSaved.length > 0) {
      setSelectedItems(autoSaved);
    }
  }, []);

  useEffect(() => {
    if (selectedItems.length > 0) {
      const timeoutId = setTimeout(() => {
        portfolioService.autoSave(selectedItems);
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [selectedItems]);

  useEffect(() => {
    if (showSaveModal) {
      setExistingPortfolios(portfolioService.getPortfolios());
    }
  }, [showSaveModal]);

  useReveal();
  useRipple('.ripple');

  const handleAddStandard = (standard: Standard): void => {
    if (selectedIds.has(standard.standard_number)) return;
    setSelectedItems(prev => [...prev, { standard, grade: 'Achieved' }]);
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
    setResults(null);
    setBreakdown(null);
    portfolioService.clearAutoSave();
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
      const reqId = crypto.randomUUID();
      let activeId = reqId;
      calculateATARBreakdown(payload)
        .then((b) => {
          if (activeId === reqId) setBreakdown(b);
        })
        .catch(console.error);

      requestAnimationFrame(() => {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      });
    } catch (err) {
      console.error(err);
      showError('Failed to calculate ATAR. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const totalCredits = selectedItems.reduce((sum: number, item: SelectedItem) => sum + item.standard.credits, 0);

  return (
    <div className="space-y-6 relative">
      {/* Introduction */}
      <section className="panel p-8 md:p-10 animate-reveal-up">
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-3 tracking-tight">
          NCEA results to an <span className="text-primary">ATAR.</span>
        </h1>
        <p className="text-sm text-text-secondary max-w-xl leading-relaxed">
          Search for your standards, assign your grades, and estimate your ATAR using historical data.
        </p>
      </section>

      {/* Search Section */}
      <section>
        <SearchStandards onAdd={handleAddStandard} onRemove={handleRemoveStandard} selectedStandardIds={selectedIds} />
      </section>

      {/* Selected Standards List */}
      <section className="panel p-6 md:p-8 min-h-[400px]">
        <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg text-text-inverse">bookmark</span>
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">Your portfolio</h2>
              <p className="text-xs text-text-muted">Manage your standards and grades</p>
            </div>
          </div>
          {selectedItems.length > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary font-mono">{totalCredits}</div>
              <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Credits</div>
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
        <div className="mt-8 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              className={`btn-ghost gap-2 ${hasUnsavedChanges ? 'text-primary border-primary/30 bg-primary-subtle' : ''}`}
              onClick={handleSavePortfolio}
              disabled={selectedItems.length === 0}
            >
              <span className="material-symbols-outlined text-base">bookmark</span>
              {hasUnsavedChanges ? 'Save changes' : 'Saved'}
            </button>
            <button
              className="btn-ghost gap-2"
              onClick={() => setIsPortfolioManagerOpen(true)}
            >
              <span className="material-symbols-outlined text-base">folder_open</span>
              Load
            </button>
            {justSaved && (
              <div className="flex items-center gap-1.5 text-xs text-grade-achieved bg-success-50 px-3 py-1.5 border border-grade-achieved/20 animate-reveal-in font-medium">
                <span className="material-symbols-outlined text-sm">check_circle</span>
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
              <span className="material-symbols-outlined text-base">delete</span>
              Clear
            </button>
          </div>
        </div>
      </section>

      {/* Calculate Section */}
      <section className="space-y-6" ref={resultsRef}>
        <button
          className="w-full py-5 bg-primary text-text-inverse font-bold uppercase tracking-[0.2em] text-sm border border-primary hover:bg-primary-light hover:-translate-y-0.5 hover:shadow-card-hover active:translate-y-0 active:shadow-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleCalculate}
          disabled={selectedItems.length === 0 || isCalculating}
        >
          <div className="flex items-center justify-center gap-3">
            {isCalculating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white animate-spin" />
                <span>Calculating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl">calculate</span>
                <span>Calculate estimate</span>
              </>
            )}
          </div>
        </button>

        {/* Results Component */}
        <div className={`transition-all duration-500 ${results ? 'opacity-100 translate-y-0' : 'opacity-100'}`}>
          <ATARResults results={results} breakdown={breakdown} />
        </div>
      </section>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[100] animate-reveal-in p-4">
          <div className="bg-surface-card border border-border shadow-modal w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-6 border-b border-border bg-surface-elevated">
              <h3 className="text-base font-bold text-text-primary">Save portfolio</h3>
              <p className="text-xs text-text-muted mt-1">Create new or overwrite existing</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em]">New portfolio</label>
                <div className="flex gap-2">
                  <input
                    className="input"
                    placeholder="e.g., Engineering prerequisites"
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
                  Save as new
                </button>
              </div>

              {existingPortfolios.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <label className="text-[10px] font-bold text-text-muted uppercase tracking-[0.15em]">Overwrite existing</label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {existingPortfolios
                      .slice()
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleOverwriteExisting(p.id)}
                          className={`w-full text-left p-3 border hover:bg-surface-hover hover:border-border-strong transition-all group ${currentPortfolioId === p.id ? 'bg-primary-subtle border-primary/20' : 'bg-surface-base border-border'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-text-primary group-hover:text-text-primary truncate text-xs tracking-wide">{p.name}</span>
                            {currentPortfolioId === p.id && <span className="material-symbols-outlined text-primary text-base">check_circle</span>}
                          </div>
                          <div className="text-[10px] text-text-muted mt-1">
                            {new Date(p.updatedAt).toLocaleDateString()} · {p.items.length} standards
                          </div>
                        </button>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 bg-surface-elevated border-t border-border flex justify-end">
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