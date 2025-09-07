'use client';

import React, { useState, useEffect } from 'react';
import { portfolioService, type SavedPortfolio } from '../app/services/portfolio';
import { nceaParser, type ParseResult } from '../app/services/ncea-parser';
import type { SelectedItem } from '../app/page';
import {
  XMarkIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  TrashIcon,
  FolderOpenIcon,
  PlusIcon,
  LightBulbIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CloudArrowUpIcon,
  AcademicCapIcon,
  BookmarkIcon
} from '@heroicons/react/24/outline';
import { FolderIcon, DocumentTextIcon } from '@heroicons/react/24/solid';

interface Props {
  onLoadPortfolio: (items: SelectedItem[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function PortfolioManager({ onLoadPortfolio, isOpen, onClose }: Props) {
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, portfolioCount: 0 });
  const [showNCEAImport, setShowNCEAImport] = useState(false);
  const [nceaText, setNCEAText] = useState('');
  const [isParsingNCEA, setIsParsingNCEA] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPortfolios();
    }
  }, [isOpen]);

  const loadPortfolios = () => {
    const savedPortfolios = portfolioService.getPortfolios();
    const info = portfolioService.getStorageInfo();
    setPortfolios(savedPortfolios);
    setStorageInfo(info);
  };

  const handleLoadPortfolio = (portfolio: SavedPortfolio) => {
    onLoadPortfolio(portfolio.items);
    onClose();
  };

  const handleDeletePortfolio = (id: string, name: string) => {
    if (confirm(`Delete portfolio "${name}"? This cannot be undone.`)) {
      portfolioService.deletePortfolio(id);
      loadPortfolios();
    }
  };

  const handleExportPortfolio = (id: string, name: string) => {
    const exportData = portfolioService.exportPortfolio(id);
    if (exportData) {
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-zA-Z0-9]/g, '_')}_portfolio.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImportPortfolio = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          const imported = portfolioService.importPortfolio(result);
          if (imported) {
            loadPortfolios();
            alert(`Portfolio "${imported.name}" imported successfully!`);
          } else {
            alert('Failed to import portfolio. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleParseNCEAText = async () => {
    if (!nceaText.trim()) {
      alert('Please paste your NCEA portal text first');
      return;
    }

    setIsParsingNCEA(true);
    try {
      const result = await nceaParser.parseNCEAPortalText(nceaText);
      setParseResult(result);
    } catch (error) {
      console.error('Error parsing NCEA text:', error);
      alert('Failed to parse NCEA portal text. Please check the format and try again.');
    } finally {
      setIsParsingNCEA(false);
    }
  };

  const handleImportParsedStandards = () => {
    if (!parseResult?.validStandards.length) {
      alert('No valid standards to import');
      return;
    }

    const portfolioName = prompt('Enter a name for this imported portfolio:', 'NCEA Import');
    if (portfolioName) {
      const imported = portfolioService.savePortfolio(
        portfolioName.trim(),
        parseResult.validStandards,
        `Imported from NCEA portal - ${parseResult.summary.validInDatabase} standards`
      );
      loadPortfolios();
      setShowNCEAImport(false);
      setNCEAText('');
      setParseResult(null);
      alert(`Portfolio "${imported.name}" created with ${parseResult.summary.validInDatabase} standards!`);
    }
  };

  const handleLoadParsedStandards = () => {
    if (!parseResult?.validStandards.length) {
      alert('No valid standards to load');
      return;
    }

    onLoadPortfolio(parseResult.validStandards);
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NZ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatStorageSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderIcon className="w-8 h-8 text-brand-400" />
            <div>
              <h2 className="text-xl font-semibold text-slate-200">Portfolio Manager</h2>
              <p className="text-slate-400 text-sm">
                {storageInfo.portfolioCount} saved portfolios • {formatStorageSize(storageInfo.used)} used
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNCEAImport(true)}
              className="px-4 py-2 rounded-xl border border-brand-500/50 text-brand-400 hover:bg-brand-500/10 transition-all duration-200 flex items-center gap-2"
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              Import from NCEA
            </button>
            <button
              onClick={handleImportPortfolio}
              className="px-4 py-2 rounded-xl border border-success-500/50 text-success-400 hover:bg-success-500/10 transition-all duration-200 flex items-center gap-2"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              Import JSON
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 transition-all duration-200 flex items-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[65vh]">
          {portfolios.length === 0 ? (
            <div className="text-center py-16">
              <BookmarkIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <div className="text-slate-400 text-lg font-medium mb-2">No saved portfolios yet</div>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Build your NCEA portfolio and click "Save Portfolio" to store it for later use, or import from your NCEA portal.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {portfolios.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="rounded-xl border border-white/10 bg-slate-800/60 p-5 hover:bg-slate-800/80 transition-all duration-200 shadow-card hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <DocumentTextIcon className="w-5 h-5 text-brand-400 flex-shrink-0" />
                        <h3 className="font-semibold text-slate-200 truncate">{portfolio.name}</h3>
                      </div>
                      {portfolio.description && (
                        <p className="text-slate-400 text-sm mb-3 line-clamp-2">{portfolio.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                        <span className="flex items-center gap-1">
                          <AcademicCapIcon className="w-3 h-3" />
                          {portfolio.items.length} standards
                        </span>
                        <span>Created {formatDate(portfolio.createdAt)}</span>
                        {portfolio.updatedAt !== portfolio.createdAt && (
                          <span>Updated {formatDate(portfolio.updatedAt)}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(portfolio.items.map(item => item.standard.subject))).slice(0, 6).map(subject => (
                          <span
                            key={subject}
                            className="px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 text-xs border border-white/10"
                          >
                            {subject}
                          </span>
                        ))}
                        {Array.from(new Set(portfolio.items.map(item => item.standard.subject))).length > 6 && (
                          <span className="px-2 py-1 rounded-md bg-slate-700/50 text-slate-400 text-xs border border-white/10">
                            +{Array.from(new Set(portfolio.items.map(item => item.standard.subject))).length - 6} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleLoadPortfolio(portfolio)}
                        className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-all duration-200 flex items-center gap-2 shadow-card"
                      >
                        <FolderOpenIcon className="w-4 h-4" />
                        Load
                      </button>
                      <button
                        onClick={() => handleExportPortfolio(portfolio.id, portfolio.name)}
                        className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-all duration-200 flex items-center gap-2"
                      >
                        <DocumentArrowDownIcon className="w-4 h-4" />
                        Export
                      </button>
                      <button
                        onClick={() => handleDeletePortfolio(portfolio.id, portfolio.name)}
                        className="px-3 py-2 rounded-lg border border-error-500/50 text-error-400 hover:bg-error-500/10 transition-all duration-200 flex items-center gap-2"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* NCEA Import Modal */}
      {showNCEAImport && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-60">
          <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CloudArrowUpIcon className="w-8 h-8 text-brand-400" />
                <div>
                  <h3 className="text-xl font-semibold text-slate-200">Import from NCEA Portal</h3>
                  <p className="text-slate-400 text-sm">
                    Copy all text from your NCEA portal (Ctrl+A, Ctrl+C) and paste it below
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNCEAImport(false);
                  setNCEAText('');
                  setParseResult(null);
                }}
                className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-all duration-200 flex items-center gap-2"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {!parseResult ? (
                <div className="space-y-6">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-3 flex items-center gap-2">
                      <DocumentTextIcon className="w-4 h-4" />
                      NCEA Portal Text
                    </label>
                    <textarea
                      value={nceaText}
                      onChange={(e) => setNCEAText(e.target.value)}
                      placeholder="Paste your NCEA portal text here... (should include standards tables with Std., Ver., Asm., Title, Lvl., Credits, Result columns)"
                      className="w-full h-64 px-4 py-3 rounded-xl bg-slate-800/80 border border-white/10 text-slate-200 placeholder-slate-500 text-sm font-mono focus:ring-2 focus:ring-brand-500/50 outline-none transition-all duration-200"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400 text-sm bg-slate-800/50 px-4 py-3 rounded-xl border border-white/10">
                      <LightBulbIcon className="w-5 h-5 text-amber-400 flex-shrink-0" />
                      <span>Go to your NCEA portal, press Ctrl+A to select all, then Ctrl+C to copy, then paste here</span>
                    </div>
                    <button
                      onClick={handleParseNCEAText}
                      disabled={!nceaText.trim() || isParsingNCEA}
                      className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-card"
                    >
                      {isParsingNCEA ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Parsing...
                        </>
                      ) : (
                        <>
                          <CloudArrowUpIcon className="w-4 h-4" />
                          Parse Standards
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Parse Results Summary */}
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 p-5">
                    <h4 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
                      <InformationCircleIcon className="w-5 h-5 text-brand-400" />
                      Import Summary
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center p-3 rounded-lg bg-slate-700/50">
                        <div className="text-2xl font-bold text-slate-300 mb-1">{parseResult.summary.totalFound}</div>
                        <div className="text-slate-500 text-xs">Total Standards</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-brand-500/10 border border-brand-500/20">
                        <div className="text-2xl font-bold text-brand-400 mb-1">{parseResult.summary.level3Found}</div>
                        <div className="text-slate-500 text-xs">Level 3 Standards</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-success-500/10 border border-success-500/20">
                        <div className="text-2xl font-bold text-success-400 mb-1">{parseResult.summary.validInDatabase}</div>
                        <div className="text-slate-500 text-xs">Valid for ATAR</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-error-500/10 border border-error-500/20">
                        <div className="text-2xl font-bold text-error-400 mb-1">{parseResult.summary.invalidNotInDatabase}</div>
                        <div className="text-slate-500 text-xs">Not in Database</div>
                      </div>
                    </div>
                  </div>

                  {/* Valid Standards */}
                  {parseResult.validStandards.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-5">
                      <h4 className="font-semibold text-success-400 mb-4 flex items-center gap-2">
                        <CheckCircleIcon className="w-5 h-5" />
                        Standards Ready for Import ({parseResult.validStandards.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {parseResult.validStandards.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-slate-700/50 rounded-lg p-3 border border-white/5">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-200 flex items-center gap-2">
                                <AcademicCapIcon className="w-4 h-4 text-success-400 flex-shrink-0" />
                                <span className="truncate">{item.standard.standard_number} • {item.standard.title}</span>
                              </div>
                              <div className="text-slate-400 text-xs mt-1">
                                {item.standard.credits} credits • Grade: {item.grade}
                                {item.year_achieved && ` • Year: ${item.year_achieved}`}
                                {item.standard_version && ` • Version: ${item.standard_version}`}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invalid Standards */}
                  {parseResult.invalidStandards.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-5">
                      <h4 className="font-semibold text-error-400 mb-4 flex items-center gap-2">
                        <ExclamationCircleIcon className="w-5 h-5" />
                        Standards Not in Database ({parseResult.invalidStandards.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {parseResult.invalidStandards.map((std, index) => (
                          <div key={index} className="text-sm bg-slate-700/50 rounded-lg p-3 border border-white/5">
                            <div className="font-medium text-slate-300 flex items-center gap-2">
                              <ExclamationCircleIcon className="w-4 h-4 text-error-400 flex-shrink-0" />
                              <span className="truncate">{std.standard_number} • {std.title}</span>
                            </div>
                            <div className="text-slate-500 text-xs mt-1">
                              Level {std.level} • {std.credits} credits • {std.result}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        setParseResult(null);
                        setNCEAText('');
                      }}
                      className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-all duration-200 flex items-center gap-2"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Parse Again
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLoadParsedStandards}
                        disabled={!parseResult.validStandards.length}
                        className="px-4 py-2 rounded-lg border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                      >
                        <FolderOpenIcon className="w-4 h-4" />
                        Load to Current Portfolio
                      </button>
                      <button
                        onClick={handleImportParsedStandards}
                        disabled={!parseResult.validStandards.length}
                        className="px-4 py-2 rounded-lg bg-success-600 hover:bg-success-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-card"
                      >
                        <BookmarkIcon className="w-4 h-4" />
                        Save as New Portfolio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 