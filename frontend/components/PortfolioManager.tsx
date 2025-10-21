'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  MagnifyingGlassIcon,
  FunnelIcon,
  Bars3BottomLeftIcon,
  Squares2X2Icon,
  ChevronDownIcon,
  CalendarIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { FolderIcon, DocumentTextIcon, StarIcon } from '@heroicons/react/24/solid';
import { calculateATAR, type ATARResult } from '../app/services/api';
import { useToast } from '../app/providers/ToastProvider';

interface Props {
  onLoadPortfolio: (payload: { id?: string; name?: string; items: SelectedItem[] }) => void;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Renders a modal Portfolio Manager UI for viewing, importing, exporting, renaming, duplicating, deleting, and loading saved portfolios.
 *
 * @param onLoadPortfolio - Callback invoked with portfolio data when the user loads a portfolio into the parent context.
 * @param isOpen - Controls whether the manager is visible.
 * @param onClose - Callback invoked to request closing the manager.
 * @returns The portfolio manager UI when open, otherwise null.
 */
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const { showError, showInfo, showWarning } = useToast();

  const loadPortfolios = useCallback((idToSelect?: string) => {
    const savedPortfolios = portfolioService.getPortfolios();
    const info = portfolioService.getStorageInfo();
    setPortfolios(savedPortfolios);
    setStorageInfo(info);
    // Initialize selection
    if (savedPortfolios.length > 0) {
      const desired = idToSelect ?? selectedId;
      if (!desired || !savedPortfolios.find(p => p.id === desired)) {
        setSelectedId(savedPortfolios[0].id);
        setRenamingId(null);
      }
    } else {
      setSelectedId(null);
      setRenamingId(null);
    }
  }, [selectedId]);

  useEffect(() => {
    if (isOpen) {
      loadPortfolios();
    }
  }, [isOpen, loadPortfolios]);

  // Lock body scroll when the manager is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Load preview lazily when selection changes
  useEffect(() => {
    const id = selectedId;
    if (!id || atarPreviewById[id]) return;
    const p = portfolios.find(x => x.id === id);
    if (!p) return;
    let isCancelled = false;
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
        if (!isCancelled) {
          setAtarPreviewById(prev => ({ ...prev, [id]: { loading: false, results } }));
        }
      } catch (e: any) {
        if (!isCancelled) {
          setAtarPreviewById(prev => ({ ...prev, [id]: { loading: false, results: null, error: 'Failed to preview ATAR' } }));
        }
      }
    })();
    return () => {
      isCancelled = true;
    };
  }, [selectedId, portfolios, atarPreviewById]);

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
    loadPortfolios(duplicated.id);
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
            showError('Failed to import portfolio. Please check the file format.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleParseNCEAText = async () => {
    if (!nceaText.trim()) {
      showInfo('Please paste your NCEA portal text first');
      return;
    }

    setIsParsingNCEA(true);
    try {
      const result = await nceaParser.parseNCEAPortalText(nceaText);
      setParseResult(result);
    } catch (error) {
      console.error('Error parsing NCEA text:', error);
      showError('Failed to parse NCEA portal text. Please check the format and try again.');
    } finally {
      setIsParsingNCEA(false);
    }
  };

  const handleImportParsedStandards = (name: string) => {
    if (!parseResult?.validStandards.length) {
      showWarning('No valid standards to import');
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
      showWarning('No valid standards to load');
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

  const getSortLabel = () => {
    const labels: Record<typeof sortBy, string> = {
      updated: 'Last Updated',
      name: 'Name',
      atar: 'ATAR Score',
      standards: 'Standards Count'
    };
    return labels[sortBy];
  };

  if (!isOpen) return null;
 
  return (
   <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-reveal-in">
      <div className="card w-full max-w-[min(95vw,80rem)] max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl">
        {/* Modern Header with gradient */}
        <div className="relative bg-gradient-to-r from-brand-600/20 to-brand-500/10 border-b border-white/10">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-brand-500/20 rounded-xl border border-brand-400/30">
                <FolderIcon className="w-7 h-7 text-brand-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100">Portfolio Manager</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <BookmarkIcon className="w-4 h-4" />
                    {storageInfo.portfolioCount} portfolios
                  </span>
                  <span className="text-slate-600">•</span>
                  <span>{formatStorageSize(storageInfo.used)} storage used</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNCEAImport(true)}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 shadow-lg shadow-brand-500/20"
                title="Import from NCEA Portal"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                <span className="hidden sm:inline">Import from NCEA</span>
              </button>
              <button
                onClick={handleImportPortfolio}
                className="btn-ghost px-3 py-2.5"
                title="Import JSON File"
              >
                <DocumentArrowUpIcon className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="btn-ghost px-3 py-2.5 hover:bg-red-500/10 hover:text-red-400"
                title="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar with search and controls */}
        <div className="px-6 py-4 bg-slate-800/30 border-b border-white/5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-md relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                className="input w-full pl-10 bg-slate-900/50 border-white/10 focus:border-brand-500/50"
                placeholder="Search portfolios by name, subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search portfolios"
              />
            </div>
            
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                className="btn-ghost px-4 py-2 flex items-center gap-2"
                onClick={() => setShowSortMenu(!showSortMenu)}
                aria-label="Sort options"
              >
                <ArrowsUpDownIcon className="w-4 h-4" />
                <span className="text-sm">{getSortLabel()}</span>
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-white/10 rounded-xl p-1 z-20 shadow-2xl" role="menu">
                    <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Sort By</div>
                    {[
                      { value: 'updated' as const, label: 'Last Updated', icon: CalendarIcon },
                      { value: 'name' as const, label: 'Name', icon: Bars3BottomLeftIcon },
                      { value: 'atar' as const, label: 'ATAR Score', icon: ChartBarIcon },
                      { value: 'standards' as const, label: 'Standards Count', icon: DocumentTextIcon },
                    ].map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        className={`menu-item text-sm flex items-center gap-3 ${sortBy === value ? 'text-brand-400 bg-brand-500/20 border-l-2 border-brand-400 font-semibold' : ''}`}
                        onClick={() => {
                          if (sortBy === value) {
                            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortBy(value);
                          }
                          setShowSortMenu(false);
                        }}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1">{label}</span>
                        {sortBy === value && (
                          <span className="text-xs font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-900/50 rounded-lg p-1 border border-white/5">
              <button
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-300'}`}
                onClick={() => setViewMode('grid')}
                title="Grid View"
                aria-label="Grid view"
              >
                <Squares2X2Icon className="w-4 h-4" />
              </button>
              <button
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-300'}`}
                onClick={() => setViewMode('list')}
                title="List View"
                aria-label="List view"
              >
                <Bars3BottomLeftIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="text-sm text-slate-400">
              {filteredPortfolios.length} of {portfolios.length}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          {portfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-6 bg-slate-800/30 rounded-2xl border-2 border-dashed border-slate-700 mb-6">
                <FolderIcon className="w-20 h-20 text-slate-600 mx-auto" />
              </div>
              <h3 className="text-xl font-semibold text-slate-300 mb-2">No Portfolios Yet</h3>
              <p className="text-slate-500 text-center max-w-md mb-6">
                Create your first portfolio by adding NCEA standards and saving, or import directly from your NCEA portal.
              </p>
              <button
                onClick={() => setShowNCEAImport(true)}
                className="btn-primary flex items-center gap-2 shadow-lg"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                Import from NCEA Portal
              </button>
            </div>
          ) : filteredPortfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <MagnifyingGlassIcon className="w-16 h-16 text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-slate-400 mb-2">No portfolios found</h3>
              <p className="text-slate-500 text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPortfolios.map(p => {
                    const lp = atarPreviewById[p.id];
                    const latestATAR = lp?.results && lp.results.length > 0
                      ? [...lp.results].sort((a,b)=>a.year-b.year)[lp.results.length-1].estimated_atar
                      : null;
                    const subjects = getSubjects(p);
                    
                    return (
                      <div
                        key={p.id}
                        className="panel p-5 group cursor-pointer card-hover relative overflow-hidden"
                        onClick={() => handleLoadPortfolio(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoadPortfolio(p); } }}
                        aria-label={`Load ${p.name}`}
                      >
                        {/* Gradient accent */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            {renamingId === p.id ? (
                              <input
                                className="input text-base font-semibold px-2 py-1 -ml-2"
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onBlur={() => handleRenameCommit(p)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                                  if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(p.name); }
                                }}
                                autoFocus
                              />
                            ) : (
                              <h3 className="text-lg font-semibold text-slate-100 truncate flex items-center gap-2 group/title">
                                <span className="truncate">{p.name}</span>
                                <button
                                  className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-brand-400 transition-all flex-shrink-0"
                                  onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); }}
                                  aria-label="Rename"
                                  title="Rename"
                                >
                                  <PencilSquareIcon className="w-4 h-4" />
                                </button>
                              </h3>
                            )}
                          </div>
                          <div className="relative ml-2 z-10">
                            <button
                              className="btn-ghost !px-2 !py-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }}
                              aria-label="More options"
                              title="More"
                            >
                              <EllipsisVerticalIcon className="w-4 h-4" />
                            </button>
                            {openMenuId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl p-1 z-50 shadow-2xl" role="menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="menu-item text-sm flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleExportPortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                      <DocumentArrowDownIcon className="w-4 h-4" />
                                      Export JSON
                                    </button>
                                    <button className="menu-item text-sm flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); setOpenMenuId(null); }}>
                                      <DocumentDuplicateIcon className="w-4 h-4" />
                                      Duplicate
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button className="menu-item text-sm text-error-400 hover:bg-error-500/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleDeletePortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                      <TrashIcon className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                          </div>
                        </div>

                        {/* ATAR Score Display */}
                        <div className="mb-4">
                          {lp?.loading ? (
                            <div className="flex items-center gap-2 text-slate-400">
                              <div className="w-4 h-4 border-2 border-slate-600 border-t-brand-400 rounded-full animate-spin" />
                              <span className="text-sm">Calculating...</span>
                            </div>
                          ) : latestATAR ? (
                            <div className="flex items-baseline gap-2">
                              <span className="text-3xl font-bold text-brand-400">{latestATAR.toFixed(2)}</span>
                              <span className="text-sm text-slate-500">ATAR</span>
                            </div>
                          ) : (
                            <div className="text-slate-500 text-sm">No ATAR preview</div>
                          )}
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-slate-900/50 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-slate-500 mb-1">Standards</div>
                            <div className="text-lg font-semibold text-slate-300">{p.items.length}</div>
                          </div>
                          <div className="bg-slate-900/50 rounded-lg p-3 border border-white/5">
                            <div className="text-xs text-slate-500 mb-1">Subjects</div>
                            <div className="text-lg font-semibold text-slate-300">{subjects.length}</div>
                          </div>
                        </div>

                        {/* Subjects Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {subjects.slice(0, 3).map(s => (
                            <span key={s} className="px-2 py-1 text-xs rounded-md bg-brand-500/10 text-brand-300 border border-brand-500/20">
                              {s}
                            </span>
                          ))}
                          {subjects.length > 3 && (
                            <span className="px-2 py-1 text-xs rounded-md bg-slate-700/50 text-slate-400 border border-white/5">
                              +{subjects.length - 3} more
                            </span>
                          )}
                        </div>

                        {/* Footer with timestamp */}
                        <div className="text-xs text-slate-500 pt-3 border-t border-white/5">
                          Updated {formatDate(p.updatedAt)}
                        </div>

                        {/* Load button overlay on hover */}
                        {openMenuId !== p.id && (
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6 pointer-events-none">
                            <button
                              className="btn-primary flex items-center gap-2 shadow-xl pointer-events-auto"
                              onClick={(e) => { e.stopPropagation(); handleLoadPortfolio(p); }}
                            >
                              <FolderOpenIcon className="w-4 h-4" />
                              Load Portfolio
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                // List View
                <div className="space-y-2">
                  {filteredPortfolios.map(p => {
                    const lp = atarPreviewById[p.id];
                    const latestATAR = lp?.results && lp.results.length > 0
                      ? [...lp.results].sort((a,b)=>a.year-b.year)[lp.results.length-1].estimated_atar
                      : null;
                    const subjects = getSubjects(p);
                    
                    return (
                      <div
                        key={p.id}
                        className="panel p-4 group cursor-pointer card-hover flex items-center gap-4"
                        onClick={() => handleLoadPortfolio(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoadPortfolio(p); } }}
                        aria-label={`Load ${p.name}`}
                      >
                        {/* Icon */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                          <DocumentTextIcon className="w-6 h-6 text-brand-400" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {renamingId === p.id ? (
                            <input
                              className="input text-base font-semibold px-2 py-1 -ml-2 w-full"
                              value={renamingValue}
                              onChange={(e) => setRenamingValue(e.target.value)}
                              onBlur={() => handleRenameCommit(p)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                e.stopPropagation();
                                if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                                if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(p.name); }
                              }}
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-2 mb-1 group/title">
                              <h3 className="text-base font-semibold text-slate-100 truncate">{p.name}</h3>
                              <button
                                className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-brand-400 transition-all flex-shrink-0"
                                onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); }}
                                aria-label="Rename"
                                title="Rename"
                              >
                                <PencilSquareIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span>{p.items.length} standards</span>
                            <span className="text-slate-600">•</span>
                            <span>{subjects.length} subjects</span>
                            <span className="text-slate-600">•</span>
                            <span>{formatDate(p.updatedAt)}</span>
                          </div>
                        </div>

                        {/* ATAR Score */}
                        <div className="flex-shrink-0 text-right">
                          {lp?.loading ? (
                            <div className="w-4 h-4 border-2 border-slate-600 border-t-brand-400 rounded-full animate-spin" />
                          ) : latestATAR ? (
                            <div>
                              <div className="text-2xl font-bold text-brand-400">{latestATAR.toFixed(2)}</div>
                              <div className="text-xs text-slate-500">ATAR</div>
                            </div>
                          ) : (
                            <div className="text-slate-600 text-sm">—</div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            className="btn-ghost !px-2 !py-2"
                            onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); }}
                            title="Duplicate"
                            aria-label="Duplicate"
                          >
                            <DocumentDuplicateIcon className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button
                              className="btn-ghost !px-2 !py-2"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }}
                              aria-label="More options"
                              title="More"
                            >
                              <EllipsisVerticalIcon className="w-4 h-4" />
                            </button>
                            {openMenuId === p.id && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                                  <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl p-1 z-50 shadow-2xl" role="menu" onClick={(e) => e.stopPropagation()}>
                                    <button className="menu-item text-sm flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleExportPortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                      <DocumentArrowDownIcon className="w-4 h-4" />
                                      Export JSON
                                    </button>
                                    <button className="menu-item text-sm flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); setOpenMenuId(null); }}>
                                      <DocumentDuplicateIcon className="w-4 h-4" />
                                      Duplicate
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button className="menu-item text-sm text-error-400 hover:bg-error-500/10 flex items-center gap-2" onClick={(e) => { e.stopPropagation(); handleDeletePortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                      <TrashIcon className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
 
       {/* NCEA Import Modal */}
       {showNCEAImport && (
         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-60 animate-reveal-in">
           <div className="card w-full max-w-[min(92vw,60rem)] max-h-[90vh] overflow-hidden animate-scale-in shadow-2xl">
             <div className="relative bg-gradient-to-r from-brand-600/20 to-brand-500/10 border-b border-white/10">
               <div className="p-6 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-brand-500/20 rounded-xl border border-brand-400/30">
                     <CloudArrowUpIcon className="w-7 h-7 text-brand-400" />
                   </div>
                   <div>
                     <h3 className="text-2xl font-bold text-slate-100">Import from NCEA Portal</h3>
                     <p className="text-slate-400 text-sm mt-1">
                       Copy all text from your NCEA portal and paste below to auto-import standards
                     </p>
                   </div>
                 </div>
                 <button
                   onClick={() => {
                     setShowNCEAImport(false);
                     setNCEAText('');
                     setParseResult(null);
                   }}
                   className="btn-ghost hover:bg-red-500/10 hover:text-red-400"
                   title="Close"
                 >
                   <XMarkIcon className="w-5 h-5" />
                 </button>
               </div>
             </div>
 
             <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
               {!parseResult ? (
                 <div className="space-y-6">
                   <div>
                     <label className="block text-slate-300 text-sm font-semibold mb-3 flex items-center gap-2">
                       <DocumentTextIcon className="w-5 h-5 text-brand-400" />
                       NCEA Portal Text
                     </label>
                     <textarea
                       value={nceaText}
                       onChange={(e) => setNCEAText(e.target.value)}
                       placeholder="Paste your NCEA portal text here... (should include standards tables with Std., Ver., Asm., Title, Lvl., Credits, Result columns)"
                       className="input h-80 font-mono text-sm bg-slate-900/50 border-white/10 focus:border-brand-500/50"
                     />
                   </div>
                   <div className="flex items-start justify-between gap-4 flex-wrap">
                     <div className="flex items-start gap-3 text-slate-400 text-sm bg-amber-500/10 px-4 py-3 rounded-xl border border-amber-500/20 flex-1 min-w-[280px]">
                       <LightBulbIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                       <div>
                         <div className="font-medium text-amber-300 mb-1">Quick Tip</div>
                         <div className="text-amber-200/80">Press <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs border border-white/10">Ctrl+A</kbd> on your NCEA portal page, then <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-xs border border-white/10">Ctrl+C</kbd> to copy, and paste here.</div>
                       </div>
                     </div>
                     <button
                       onClick={handleParseNCEAText}
                       disabled={!nceaText.trim() || isParsingNCEA}
                       className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed shadow-lg px-6 py-3"
                     >
                       {isParsingNCEA ? (
                         <>
                           <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                           Parsing...
                         </>
                       ) : (
                         <>
                           <CheckCircleIcon className="w-5 h-5" />
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
                           {parseResult.missingGrades} standard(s) did not have a grade on NZQA. We&apos;ve defaulted these to Achieved. Please review and manually adjust grades if needed.
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
               <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-70 animate-reveal-in">
                 <div className="card w-full max-w-[min(92vw,28rem)] overflow-hidden animate-scale-in shadow-2xl">
                   <div className="p-5 border-b border-white/10 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                       <div className="p-2 bg-brand-500/20 rounded-lg">
                         <BookmarkIcon className="w-5 h-5 text-brand-400" />
                       </div>
                       <h4 className="text-slate-200 font-semibold text-lg">Name Your Portfolio</h4>
                     </div>
                     <button onClick={() => setShowNameModal(false)} className="btn-ghost">
                       <XMarkIcon className="w-4 h-4" />
                     </button>
                   </div>
                   <div className="p-6 space-y-4">
                     <div className="space-y-2">
                       <label className="text-sm font-medium text-slate-300">Portfolio Name</label>
                       <input
                         className="input bg-slate-900/50 border-white/10 focus:border-brand-500/50"
                         value={newPortfolioName}
                         onChange={(e) => setNewPortfolioName(e.target.value)}
                         onKeyDown={(e) => {
                           if (e.key === 'Enter') handleImportParsedStandards(newPortfolioName);
                         }}
                         placeholder="e.g., Year 13 2024"
                         autoFocus
                       />
                     </div>
                     <div className="flex items-center justify-end gap-3 pt-2">
                       <button onClick={() => setShowNameModal(false)} className="btn-ghost px-4 py-2">Cancel</button>
                       <button 
                         onClick={() => handleImportParsedStandards(newPortfolioName)} 
                         className="btn-primary px-4 py-2 flex items-center gap-2 shadow-lg"
                         disabled={!newPortfolioName.trim()}
                       >
                         <BookmarkIcon className="w-4 h-4" />
                         Save Portfolio
                       </button>
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
         <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-70 animate-reveal-in">
           <div className="card w-full max-w-[min(92vw,28rem)] overflow-hidden animate-scale-in shadow-2xl">
             <div className="p-5 border-b border-white/10 flex items-center justify-between bg-error-500/5">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-error-500/20 rounded-lg">
                   <TrashIcon className="w-5 h-5 text-error-400" />
                 </div>
                 <h4 className="text-slate-200 font-semibold text-lg">Delete Portfolio?</h4>
               </div>
               <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost">
                 <XMarkIcon className="w-4 h-4" />
               </button>
             </div>
             <div className="p-6 space-y-4">
               <p className="text-slate-300">
                 Are you sure you want to delete <span className="font-semibold text-slate-100">&ldquo;{deleteTarget.name}&rdquo;</span>? This action cannot be undone.
               </p>
               <div className="flex items-center justify-end gap-3 pt-2">
                 <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost px-4 py-2">Cancel</button>
                 <button onClick={confirmDeletePortfolio} className="btn-danger px-4 py-2 flex items-center gap-2 shadow-lg">
                   <TrashIcon className="w-4 h-4" />
                   Delete Portfolio
                 </button>
               </div>
             </div>
           </div>
         </div>
       )}
     </div>
   );
} 