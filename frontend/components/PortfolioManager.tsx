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
import { calculateATAR, type ATARResult } from '../app/services/api';

interface Props {
  onLoadPortfolio: (payload: { id?: string; name?: string; items: SelectedItem[] }) => void;
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState<string>('');
  const [atarPreviewById, setAtarPreviewById] = useState<Record<string, { loading: boolean; results: ATARResult[] | null; error?: string }>>({});
  const [showNameModal, setShowNameModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('NCEA Import');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPortfolios();
    }
  }, [isOpen]);

  // Lock body scroll when the manager is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const loadPortfolios = () => {
    const savedPortfolios = portfolioService.getPortfolios();
    const info = portfolioService.getStorageInfo();
    setPortfolios(savedPortfolios);
    setStorageInfo(info);
  };

  const toggleExpand = async (p: SavedPortfolio) => {
    setExpandedId(prev => (prev === p.id ? null : p.id));
    if (!atarPreviewById[p.id]) {
      setAtarPreviewById(prev => ({ ...prev, [p.id]: { loading: true, results: null } }));
      try {
        const payload = p.items.map(item => ({
          standard_number: item.standard.standard_number,
          grade: item.grade,
          year_achieved: item.year_achieved,
          standard_version: item.standard_version
        }));
        const results = await calculateATAR(payload);
        setAtarPreviewById(prev => ({ ...prev, [p.id]: { loading: false, results } }));
      } catch (e: any) {
        setAtarPreviewById(prev => ({ ...prev, [p.id]: { loading: false, results: null, error: 'Failed to preview ATAR' } }));
      }
    }
    setRenamingValue(p.name);
  };

  const handleRenameCommit = (p: SavedPortfolio) => {
    const name = renamingValue.trim();
    if (!name || name === p.name) return;
    const updated = portfolioService.updatePortfolio(p.id, { name });
    if (updated) {
      setPortfolios(prev => prev.map(x => (x.id === p.id ? updated : x)));
    }
  };

  const handleLoadPortfolio = (portfolio: SavedPortfolio) => {
    onLoadPortfolio({ id: portfolio.id, name: portfolio.name, items: portfolio.items });
    onClose();
  };

  const handleDeletePortfolio = (id: string, name: string) => {
    setDeleteTarget({ id, name });
    setShowDeleteModal(true);
  };

  const confirmDeletePortfolio = () => {
    if (!deleteTarget) return;
    portfolioService.deletePortfolio(deleteTarget.id);
    loadPortfolios();
    setShowDeleteModal(false);
    setDeleteTarget(null);
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

  const handleImportParsedStandards = (name: string) => {
    if (!parseResult?.validStandards.length) {
      alert('No valid standards to import');
      return;
    }

    const imported = portfolioService.savePortfolio(
      name.trim() || 'NCEA Import',
      parseResult.validStandards,
      `Imported from NCEA portal - ${parseResult.summary.validInDatabase} standards`
    );
    loadPortfolios();
    // Reset NCEA import state and close naming modal
    setShowNameModal(false);
    setNewPortfolioName('NCEA Import');
    setShowNCEAImport(false);
    setNCEAText('');
    setParseResult(null);
  };

  const handleLoadParsedStandards = () => {
    if (!parseResult?.validStandards.length) {
      alert('No valid standards to load');
      return;
    }

    onLoadPortfolio({ items: parseResult.validStandards });
    // Reset state so next open shows saved portfolios view
    setShowNCEAImport(false);
    setNCEAText('');
    setParseResult(null);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-reveal-in">
      <div className="card w-full max-w-5xl max-h-[85vh] overflow-hidden animate-scale-in">
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
              className="btn-primary"
            >
              <CloudArrowUpIcon className="w-4 h-4" />
              Import from NCEA
            </button>
            <button
              onClick={handleImportPortfolio}
              className="btn-ghost"
            >
              <DocumentArrowUpIcon className="w-4 h-4" />
              Import JSON
            </button>
            <button
              onClick={onClose}
              className="btn-ghost"
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
              {portfolios.map((p) => {
                const isExpanded = expandedId === p.id;
                const preview = atarPreviewById[p.id];
                const subjects = Array.from(new Set(p.items.map(item => item.standard.subject)));
                return (
                  <div key={p.id} className="panel p-5 card-hover">
                    <button onClick={() => toggleExpand(p)} className="w-full text-left flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <DocumentTextIcon className="w-5 h-5 text-brand-400 flex-shrink-0" />
                          <h3 className="font-semibold text-slate-200 truncate">{p.name}</h3>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <AcademicCapIcon className="w-3 h-3" />
                            {p.items.length} standards
                          </span>
                          <span>Updated {formatDate(p.updatedAt)}</span>
                        </div>
                      </div>
                      <div className={`w-4 h-4 mt-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</div>
                    </button>
                    {isExpanded && (
                      <div className="mt-4 border-t border-white/10 pt-4 space-y-4 animate-reveal-in">
                        <div className="space-y-2">
                          <label className="text-sm text-slate-300">Portfolio name</label>
                          <input
                            className="input"
                            value={renamingValue}
                            onChange={(e) => setRenamingValue(e.target.value)}
                            onBlur={() => handleRenameCommit(p)}
                            onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="panel p-4">
                            <div className="text-xs text-slate-400 mb-1">Subjects</div>
                            <div className="flex flex-wrap gap-1">
                              {subjects.slice(0, 6).map(s => (
                                <span key={s} className="px-2 py-1 rounded-md bg-slate-700/50 text-slate-300 text-xs border border-white/10">{s}</span>
                              ))}
                              {subjects.length > 6 && (
                                <span className="px-2 py-1 rounded-md bg-slate-700/50 text-slate-400 text-xs border border-white/10">+{subjects.length - 6} more</span>
                              )}
                            </div>
                          </div>
                          <div className="panel p-4">
                            <div className="text-xs text-slate-400 mb-1">Latest ATAR</div>
                            <div className="text-lg font-semibold text-brand-400">
                              {preview?.loading ? 'Loading…' : (preview?.results && preview.results.length > 0 ? preview.results[preview.results.length - 1].estimated_atar.toFixed(2) : '—')}
                            </div>
                          </div>
                          <div className="panel p-4">
                            <div className="text-xs text-slate-400 mb-1">Trend</div>
                            <div className="text-lg font-semibold">
                              {preview?.results && preview.results.length > 1 ? (() => {
                                const d = [...preview.results].sort((a,b)=>a.year-b.year);
                                const t = d[d.length-1].estimated_atar - d[0].estimated_atar;
                                return <span className={t>=0? 'text-success-400':'text-error-400'}>{t>=0?'+':''}{t.toFixed(2)}</span>;
                              })() : '—'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleLoadPortfolio(p)} className="btn-primary">
                            <FolderOpenIcon className="w-4 h-4" /> Load
                          </button>
                          <button onClick={() => handleExportPortfolio(p.id, p.name)} className="btn-ghost">
                            <DocumentArrowDownIcon className="w-4 h-4" /> Export
                          </button>
                          <button onClick={() => handleDeletePortfolio(p.id, p.name)} className="btn-danger">
                            <TrashIcon className="w-4 h-4" /> Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* NCEA Import Modal */}
      {showNCEAImport && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-60 animate-reveal-in">
          <div className="card w-full max-w-4xl max-h-[90vh] overflow-hidden animate-scale-in">
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
                className="btn-ghost"
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
                      className="input h-64 font-mono"
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
                      className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="panel p-5">
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
                    {parseResult.missingGrades > 0 && (
                      <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm flex items-start gap-2">
                        <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0" />
                        <span>
                          {parseResult.missingGrades} standard(s) did not have a grade on NZQA. We've defaulted these to Achieved. Please review and manually adjust grades if needed.
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Valid Standards */}
                  {parseResult.validStandards.length > 0 && (
                    <div className="panel p-5">
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
                    <div className="panel p-5">
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
                      className="btn-ghost"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Parse Again
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLoadParsedStandards}
                        disabled={!parseResult.validStandards.length}
                        className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FolderOpenIcon className="w-4 h-4" />
                        Load to Current Portfolio
                      </button>
                      <button
                        onClick={() => { setShowNameModal(true); setNewPortfolioName('NCEA Import'); }}
                        disabled={!parseResult.validStandards.length}
                        className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <BookmarkIcon className="w-4 h-4" />
                        Save as New Portfolio
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Name Modal */}
            {parseResult && showNameModal && (
              <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-70 animate-reveal-in">
                <div className="card w-full max-w-md overflow-hidden animate-scale-in">
                  <div className="p-5 border-b border-white/10 flex items-center justify-between">
                    <h4 className="text-slate-200 font-semibold">Name Your Portfolio</h4>
                    <button onClick={() => setShowNameModal(false)} className="btn-ghost">
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-300">Portfolio name</label>
                      <input
                        className="input"
                        value={newPortfolioName}
                        onChange={(e) => setNewPortfolioName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleImportParsedStandards(newPortfolioName);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setShowNameModal(false)} className="btn-ghost">Cancel</button>
                      <button onClick={() => handleImportParsedStandards(newPortfolioName)} className="btn-primary">Save</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-70 animate-reveal-in">
          <div className="card w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h4 className="text-slate-200 font-semibold">Delete Portfolio</h4>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost">
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-slate-300 text-sm">Are you sure you want to delete "{deleteTarget.name}"? This cannot be undone.</p>
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost">Cancel</button>
                <button onClick={confirmDeletePortfolio} className="btn-danger">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 