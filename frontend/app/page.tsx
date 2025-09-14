'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
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
  const [currentPortfolioId, setCurrentPortfolioId] = useState<string | undefined>(undefined);
  const [currentPortfolioName, setCurrentPortfolioName] = useState<string | undefined>(undefined);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [justSaved, setJustSaved] = useState<null | 'saved' | 'renamed'>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
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
    if (selectedItems.length === 0) return;
    setNewPortfolioName(currentPortfolioName || 'My Portfolio');
    setShowSaveModal(true);
  };

  const handleLoadPortfolio = (payload: { id?: string; name?: string; items: SelectedItem[] }) => {
    setSelectedItems(payload.items);
    setResults(null); // Clear previous calculation results
    portfolioService.clearAutoSave(); // Clear auto-save when loading explicit portfolio
    setCurrentPortfolioId(payload.id);
    setCurrentPortfolioName(payload.name);
  };

  const handleSaveChangesToCurrent = () => {
    if (!currentPortfolioId) return;
    portfolioService.updatePortfolio(currentPortfolioId, { items: selectedItems });
    setJustSaved('saved');
    setTimeout(() => setJustSaved(null), 1500);
  };

  const handleConfirmCreate = () => {
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

  // Rename handled inline in Portfolio Manager

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
      // Smooth scroll to results after DOM updates
      requestAnimationFrame(() => {
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      });
    } catch (err) {
      console.error(err);
      alert('Failed to calculate ATAR. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const totalCredits = selectedItems.reduce((sum, item) => sum + item.standard.credits, 0);

  return (
    <div className="space-y-10 md:space-y-12">
      <section className="card reveal reveal-up">
        <div className="p-7 md:p-8 border-b border-white/10">
          <div className="flex items-center gap-3 mb-2">
            <SparklesIcon className="w-6 h-6 text-brand-400" />
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Build your NCEA profile</h1>
          </div>
          <p className="text-slate-300">Search your subjects or standards, add them, and assign your grades.</p>
        </div>
        <div className="p-7 md:p-8">
          <SearchStandards onAdd={handleAddStandard} onRemove={handleRemoveStandard} selectedStandardIds={selectedIds} />
        </div>
      </section>

      <section className="card reveal reveal-up">
        <div className="p-7 md:p-8 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookmarkSolidIcon className="w-6 h-6 text-brand-400" />
              <div>
                <h2 className="text-xl md:text-2xl font-semibold">Selected standards</h2>
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
        <div className="p-7 md:p-8">
          <SelectedStandards items={selectedItems} onRemove={handleRemoveStandard} onChangeGrade={handleChangeGrade} onChangeYear={handleChangeYear} onChangeVersion={handleChangeVersion} />
          <div className="mt-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="ripple btn-ghost hover-scale disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSavePortfolio}
                disabled={selectedItems.length === 0}
              >
                <BookmarkIcon className="w-4 h-4" />
                Save Portfolio
              </button>
              <button
                className="ripple btn-ghost hover-scale"
                onClick={() => setIsPortfolioManagerOpen(true)}
              >
                <FolderOpenIcon className="w-4 h-4" />
                My Portfolios
              </button>
              {justSaved && (
                <div className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-600/15 px-3 py-2 rounded-lg border border-emerald-500/20 animate-reveal-in">
                  <CheckCircleIcon className="w-3 h-3" />
                  <span>{justSaved === 'saved' ? 'Saved' : 'Renamed'}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {currentPortfolioId && (
                <button
                  className="ripple btn-primary hover-scale disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSaveChangesToCurrent}
                  disabled={selectedItems.length === 0}
                  title={currentPortfolioName ? `Save changes to ${currentPortfolioName}` : 'Save Changes'}
                >
                  Save Changes
                </button>
              )}
              <button
                className="ripple btn-danger hover-scale disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleClearPortfolio}
                disabled={selectedItems.length === 0}
              >
                <TrashIcon className="w-4 h-4" />
                Clear All
              </button>
              <button
                className="ripple btn-primary hover-scale disabled:opacity-50 disabled:cursor-not-allowed"
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

      <section className="card reveal reveal-up" ref={resultsRef}>
        <div className="p-7 md:p-8 border-b border-white/10">
          <div className="flex items-center gap-3">
            <CalculatorIcon className="w-6 h-6 text-brand-400" />
            <div>
              <h2 className={`text-xl md:text-2xl font-semibold ${isCalculating ? 'animate-pulse' : ''}`}>Results</h2>
              <p className="text-slate-300 text-sm">Estimated ATAR by year from your entered standards.</p>
            </div>
          </div>
        </div>
        <div className="p-7 md:p-8">
          <ATARResults results={results} />
        </div>
      </section>

      {/* Create Portfolio Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-reveal-in">
          <div className="card w-full max-w-md animate-scale-in overflow-hidden">
            <div className="p-5 border-b border-white/10">
              <div className="text-lg font-semibold text-slate-200">Save Portfolio</div>
              <div className="text-xs text-slate-400 mt-1">Give your portfolio a clear name</div>
            </div>
            <div className="p-5 space-y-4">
              <input
                className="input"
                placeholder="Portfolio name"
                value={newPortfolioName}
                onChange={(e) => setNewPortfolioName(e.target.value)}
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button className="btn-ghost" onClick={() => setShowSaveModal(false)}>Cancel</button>
                <button className="btn-primary" onClick={handleConfirmCreate} disabled={!newPortfolioName.trim()}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inline rename moved into Portfolio Manager expansion */}

      <PortfolioManager 
        isOpen={isPortfolioManagerOpen}
        onClose={() => setIsPortfolioManagerOpen(false)}
        onLoadPortfolio={handleLoadPortfolio}
      />
    </div>
  );
} 