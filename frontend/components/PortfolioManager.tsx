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
  BookmarkIcon,
  EllipsisVerticalIcon,
  PencilSquareIcon,
  DocumentDuplicateIcon,
  ArrowRightOnRectangleIcon,
  ArrowsUpDownIcon,
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState<string>('');
  const [atarPreviewById, setAtarPreviewById] = useState<Record<string, { loading: boolean; results: ATARResult[] | null; error?: string }>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'atar' | 'standards'>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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
    // Initialize selection
    if (savedPortfolios.length > 0) {
      if (!selectedId || !savedPortfolios.find(p => p.id === selectedId)) {
        setSelectedId(savedPortfolios[0].id);
        setRenamingId(null);
      }
    } else {
      setSelectedId(null);
      setRenamingId(null);
    }
  };

  // Load preview lazily when selection changes
  useEffect(() => {
    const id = selectedId;
    if (!id) return;
    if (atarPreviewById[id]) return;
    const p = portfolios.find(x => x.id === id);
    if (!p) return;
    (async () => {
      setAtarPreviewById(prev => ({ ...prev, [id]: { loading: true, results: null } }));
      try {
        const payload = p.items.map(item => ({
          standard_number: item.standard.standard_number,
          grade: item.grade,
          year_achieved: item.year_achieved,
          standard_version: item.standard_version
        }));
        const results = await calculateATAR(payload);
        setAtarPreviewById(prev => ({ ...prev, [id]: { loading: false, results } }));
      } catch (e: any) {
        setAtarPreviewById(prev => ({ ...prev, [id]: { loading: false, results: null, error: 'Failed to preview ATAR' } }));
      }
    })();
  }, [selectedId, portfolios]);

  const handleRenameCommit = (p: SavedPortfolio) => {
    const name = renamingValue.trim();
    if (!name || name === p.name) {
      setRenamingId(null);
      return;
    }
    const updated = portfolioService.updatePortfolio(p.id, { name });
    if (updated) {
      setPortfolios(prev => prev.map(x => (x.id === p.id ? updated : x)));
      if (selectedId === p.id) {
        setSelectedId(updated.id);
      }
    }
    setRenamingId(null);
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
    if (selectedId === deleteTarget.id) setSelectedId(null);
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

  const handleDuplicatePortfolio = (p: SavedPortfolio) => {
    const duplicated = portfolioService.savePortfolio(`${p.name} (Copy)`, p.items, p.description);
    loadPortfolios();
    setSelectedId(duplicated.id);
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

  const getSubjects = (p: SavedPortfolio) => Array.from(new Set(p.items.map(item => item.standard.subject || 'Other')));
  const getLatestATAR = (p: SavedPortfolio): number | null => {
    const preview = atarPreviewById[p.id];
    if (preview?.results && preview.results.length > 0) {
      const sorted = [...preview.results].sort((a, b) => a.year - b.year);
      return sorted[sorted.length - 1].estimated_atar;
    }
    return null;
  };

  // Derived list with search and sort
  const filteredPortfolios = portfolios
    .filter(p => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      const haystack = [
        p.name,
        p.description || '',
        ...getSubjects(p),
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'updated') {
        return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      }
      if (sortBy === 'name') {
        return dir * a.name.localeCompare(b.name);
      }
      if (sortBy === 'standards') {
        return dir * (a.items.length - b.items.length);
      }
      // ATAR sort (use cached previews only; unknowns go to the end)
      const va = getLatestATAR(a);
      const vb = getLatestATAR(b);
      const aVal = va == null ? (sortDir === 'asc' ? Infinity : -Infinity) : va;
      const bVal = vb == null ? (sortDir === 'asc' ? Infinity : -Infinity) : vb;
      return dir * (aVal - bVal);
    });

  const selected = selectedId ? portfolios.find(p => p.id === selectedId) || null : null;
  const selectedPreview = selected ? atarPreviewById[selected.id] : undefined;

  if (!isOpen) return null;
 
   return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-reveal-in">
      <div className="card w-full max-w-[1100px] max-h-[85vh] overflow-hidden animate-scale-in">
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
        {/* Full-width search under header */}
        <div className="px-6 pt-4">
          <input
            className="input w-full"
            placeholder="Search portfolios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search portfolios"
          />
        </div>

        <div className="p-6 overflow-hidden max-h-[calc(85vh-140px)]">
          {portfolios.length === 0 ? (
            <div className="text-center py-16">
              <BookmarkIcon className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <div className="text-slate-400 text-lg font-medium mb-2">No saved portfolios yet</div>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                Build your NCEA portfolio and click "Save Portfolio" to store it for later use, or import from your NCEA portal.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[50%_50%] gap-5 h-full">
              {/* Left: List */}
              <div className="flex flex-col min-h-0">
                <div className="space-y-3 overflow-y-auto pr-2 min-h-0">
                  {filteredPortfolios.map(p => {
                    const isSelected = selectedId === p.id;
                    const lp = atarPreviewById[p.id];
                    const latestATAR = lp?.results && lp.results.length > 0
                      ? [...lp.results].sort((a,b)=>a.year-b.year)[lp.results.length-1].estimated_atar.toFixed(2)
                      : '—';
                    return (
                      <div
                        key={p.id}
                        className={`panel px-4 py-3 min-h-[52px] relative group cursor-pointer ${isSelected ? 'ring-1 ring-brand-500/40 bg-slate-800/50' : 'card-hover'}`}
                        onClick={() => { setSelectedId(p.id); setOpenMenuId(null); setRenamingId(null); setRenamingValue(p.name); }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(p.id); } }}
                        aria-label={`Select ${p.name}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {renamingId === p.id ? (
                              <input
                                className="input h-9 py-2 text-base font-medium"
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onBlur={() => handleRenameCommit(p)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                                  if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(p.name); }
                                }}
                                autoFocus
                              />
                            ) : (
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <DocumentTextIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                                  <h3 className="text-base font-medium text-slate-200 truncate">{p.name}</h3>
                                  <button
                                    className="text-slate-400 hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); }}
                                    aria-label={`Rename ${p.name}`}
                                    title="Rename"
                                  >
                                    <PencilSquareIcon className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <div className="text-sm text-slate-400">ATAR {latestATAR}</div>
                              </div>
                            )}
                          </div>
                          {/* Quick actions on hover */}
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              className="btn-ghost !px-2 !py-1.5 h-8"
                              onClick={(e) => { e.stopPropagation(); handleLoadPortfolio(p); }}
                              title="Load"
                              aria-label={`Load ${p.name}`}
                            >
                              <FolderOpenIcon className="w-3.5 h-3.5" />
                            </button>
                            <button
                              className="btn-ghost !px-2 !py-1.5 h-8"
                              onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); }}
                              title="Duplicate"
                              aria-label={`Duplicate ${p.name}`}
                            >
                              <DocumentDuplicateIcon className="w-3.5 h-3.5" />
                            </button>
                            <div className="relative">
                              <button
                                className="btn-ghost !px-2 !py-1.5 h-8"
                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }}
                                title="More"
                                aria-haspopup="menu"
                                aria-expanded={openMenuId === p.id}
                              >
                                <EllipsisVerticalIcon className="w-3.5 h-3.5" />
                              </button>
                              {openMenuId === p.id && (
                                <div className="absolute right-0 mt-2 w-44 panel p-1 z-10" role="menu">
                                  <button className="menu-item text-sm" onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); setOpenMenuId(null); }}>Rename</button>
                                  <button className="menu-item text-sm" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); setOpenMenuId(null); }}>Duplicate</button>
                                  <button className="menu-item text-sm" onClick={(e) => { e.stopPropagation(); handleExportPortfolio(p.id, p.name); setOpenMenuId(null); }}>Export</button>
                                  <button className="menu-item text-sm text-error-300" onClick={(e) => { e.stopPropagation(); handleDeletePortfolio(p.id, p.name); setOpenMenuId(null); }}>Delete</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="panel p-4 overflow-y-auto leading-relaxed">
                {!selected ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-sm">Select a portfolio to preview</div>
                ) : (
                  <div className="space-y-5">
                    {/* Top: Name + Load + kebab */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-slate-200 truncate flex items-center gap-2">
                          <span>{selected.name}</span>
                          <button
                            className="btn-ghost !px-1.5 !py-1 h-7"
                            onClick={() => { setRenamingId(selected.id); setRenamingValue(selected.name); setSelectedId(selected.id); }}
                            title="Rename"
                            aria-label="Rename"
                          >
                            <PencilSquareIcon className="w-3.5 h-3.5" />
                          </button>
                        </h3>
                        <div className="text-sm text-slate-500 mt-1">{selected.items.length} standards • Updated {formatDate(selected.updatedAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-primary px-4 py-2 h-10 text-sm font-medium" onClick={() => handleLoadPortfolio(selected)}>
                          Load
                        </button>
                        <div className="relative">
                          <button
                            className="btn-ghost !px-2 !py-2 h-9"
                            onClick={() => setOpenMenuId(prev => prev === selected.id ? null : selected.id)}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === selected.id}
                            title="More"
                          >
                            <EllipsisVerticalIcon className="w-4 h-4" />
                          </button>
                          {openMenuId === selected.id && (
                            <div className="absolute right-0 mt-2 w-48 panel p-1 z-10" role="menu">
                              <button className="menu-item text-sm" onClick={() => { handleExportPortfolio(selected.id, selected.name); setOpenMenuId(null); }}>Export</button>
                              <button className="menu-item text-sm" onClick={() => { handleDuplicatePortfolio(selected); setOpenMenuId(null); }}>Duplicate</button>
                              <button className="menu-item text-sm text-error-300" onClick={() => { handleDeletePortfolio(selected.id, selected.name); setOpenMenuId(null); }}>Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Subjects */}
                    <div>
                      <div className="text-sm font-semibold text-slate-300 mb-3">Subjects</div>
                      <div className="flex flex-wrap gap-2">
                        {Array.from(new Set(selected.items.map(item => item.standard.subject))).map(s => (
                          <span key={s} className="px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 text-sm border border-white/10">{s}</span>
                        ))}
                      </div>
                    </div>

                    {/* Bottom: ATAR + Trend + Updated styled per wireframe */}
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-400">Latest ATAR</div>
                        <div className="text-2xl font-bold text-brand-400">
                          {selectedPreview?.loading ? 'Loading…' : (selectedPreview?.results && selectedPreview.results.length > 0 ? selectedPreview.results[selectedPreview.results.length - 1].estimated_atar.toFixed(2) : '—')}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-400">Trend</div>
                        <div className="text-2xl font-bold">
                          {selectedPreview?.results && selectedPreview.results.length > 1 ? (() => {
                            const d = [...selectedPreview.results].sort((a,b)=>a.year-b.year);
                            const t = d[d.length-1].estimated_atar - d[0].estimated_atar;
                            return <span className={t>=0? 'text-success-400':'text-error-400'}>{t>=0?'+':''}{t.toFixed(2)}</span>;
                          })() : '—'}
                        </div>
                      </div>
                      <div className="space-y-2 col-span-2">
                        <div className="text-sm font-semibold text-slate-400">Last updated</div>
                        <div className="text-sm text-slate-300">{formatDate(selected.updatedAt)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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