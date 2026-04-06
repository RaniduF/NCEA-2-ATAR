'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { portfolioService, type SavedPortfolio } from '../app/services/portfolio';

import type { SelectedItem, Grade } from '../app/page';

const gradeColorMap: Record<Grade, { bg: string; text: string; border: string; active: string }> = {
  'Excellence': { bg: 'bg-[#C4962D]/10', text: 'text-[#C4962D]', border: 'border-[#C4962D]/20', active: 'bg-[#C4962D] text-white' },
  'Merit': { bg: 'bg-[#4A7A8C]/10', text: 'text-[#4A7A8C]', border: 'border-[#4A7A8C]/20', active: 'bg-[#4A7A8C] text-white' },
  'Achieved': { bg: 'bg-[#5B8A3C]/10', text: 'text-[#5B8A3C]', border: 'border-[#5B8A3C]/20', active: 'bg-[#5B8A3C] text-white' },
  'Not Achieved': { bg: 'bg-[#B33A3A]/10', text: 'text-[#B33A3A]', border: 'border-[#B33A3A]/20', active: 'bg-[#B33A3A] text-white' },
};

import { useToast } from '../app/providers/ToastProvider';

interface Props {
  onLoadPortfolio: (payload: { id?: string; name?: string; items: SelectedItem[] }) => void;
  isOpen: boolean;
  onClose: () => void;
  onOpenImport?: () => void;
}

export function PortfolioManager({ onLoadPortfolio, isOpen, onClose, onOpenImport }: Props) {
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, portfolioCount: 0 });
          const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState<string>('');

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'name' | 'standards'>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
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

  useEffect(() => { if (isOpen) loadPortfolios(); }, [isOpen, loadPortfolios]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [isOpen]);



  const handleRenameCommit = (p: SavedPortfolio) => {
    const name = renamingValue.trim();
    if (!name || name === p.name) { setRenamingId(null); return; }
    const updated = portfolioService.updatePortfolio(p.id, { name });
    if (updated) {
      setPortfolios(prev => prev.map(x => (x.id === p.id ? updated : x)));
      if (selectedId === p.id) setSelectedId(updated.id);
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
          if (imported) loadPortfolios();
          else showError('Failed to import portfolio. Please check the file format.');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };


  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-NZ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatStorageSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getSubjects = (p: SavedPortfolio) => Array.from(new Set(p.items.map(item => item.standard.subject || 'Other')));


  const filteredPortfolios = portfolios
    .filter(p => {
      const q = searchTerm.trim().toLowerCase();
      if (!q) return true;
      return [p.name, p.description || '', ...getSubjects(p)].join(' ').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'updated') return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      if (sortBy === 'name') return dir * a.name.localeCompare(b.name);
      if (sortBy === 'standards') return dir * (a.items.length - b.items.length);
      return 0;
    });

  const getSortLabel = () => {
    const labels: Record<typeof sortBy, string> = { updated: 'Last updated', name: 'Name', standards: 'Standards count' };
    return labels[sortBy];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-reveal-in">
      <div className="bg-surface-card border border-border shadow-modal w-full max-w-[min(95vw,80rem)] max-h-[90vh] overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-surface-elevated border-b border-border">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary flex items-center justify-center text-text-inverse">
                <span className="material-symbols-outlined text-xl">folder</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Portfolio manager</h2>
                <div className="flex items-center gap-3 mt-1 text-xs text-text-muted font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-xs">bookmark</span>
                    {storageInfo.portfolioCount} portfolios
                  </span>
                  <span>·</span>
                  <span>{formatStorageSize(storageInfo.used)} storage used</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onOpenImport && (
              <button onClick={onOpenImport} className="btn-primary flex items-center gap-2 px-4 py-2.5" title="Import from NCEA Portal">
                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                <span className="hidden sm:inline">Import from NCEA</span>
              </button>
            )}
              <button onClick={handleImportPortfolio} className="btn-ghost px-3 py-2.5" title="Import JSON File">
                <span className="material-symbols-outlined text-lg">upload_file</span>
              </button>
              <button onClick={onClose} className="btn-ghost px-3 py-2.5 hover:bg-error-50 hover:text-error-500 hover:border-error-200" title="Close">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-4 bg-surface-base border-b border-border">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-md relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-lg text-text-muted">search</span>
              <input
                className="input w-full pl-10"
                placeholder="Search portfolios by name, subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search portfolios"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="relative">
              <button className="btn-ghost px-4 py-2 flex items-center gap-2" onClick={() => setShowSortMenu(!showSortMenu)} aria-label="Sort options">
                <span className="material-symbols-outlined text-sm">swap_vert</span>
                <span className="text-xs">{getSortLabel()}</span>
                <span className="material-symbols-outlined text-sm">expand_more</span>
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-surface-card border border-border p-1 z-20 shadow-modal" role="menu">
                    <div className="text-[10px] font-bold text-text-muted px-3 py-2 uppercase tracking-wider">Sort by</div>
                    {[
                      { value: 'updated' as const, label: 'Last updated', icon: 'calendar_today' },
                      { value: 'name' as const, label: 'Name', icon: 'sort_by_alpha' },
                      { value: 'standards' as const, label: 'Standards count', icon: 'description' },
                    ].map(({ value, label, icon }) => (
                      <button
                        key={value}
                        className={`menu-item text-xs flex items-center gap-3 font-medium ${sortBy === value ? 'text-primary bg-primary-subtle border-l-2 border-primary' : ''}`}
                        onClick={() => {
                          if (sortBy === value) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                          else setSortBy(value);
                          setShowSortMenu(false);
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">{icon}</span>
                        <span className="flex-1">{label}</span>
                        {sortBy === value && <span className="text-xs font-bold">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-0 border border-border">
              <button className={`px-3 py-1.5 transition-all ${viewMode === 'grid' ? 'bg-primary text-text-inverse' : 'text-text-muted hover:text-text-primary bg-surface-card'}`} onClick={() => setViewMode('grid')} title="Grid View">
                <span className="material-symbols-outlined text-sm">grid_view</span>
              </button>
              <button className={`px-3 py-1.5 transition-all ${viewMode === 'list' ? 'bg-primary text-text-inverse' : 'text-text-muted hover:text-text-primary bg-surface-card'}`} onClick={() => setViewMode('list')} title="List View">
                <span className="material-symbols-outlined text-sm">view_list</span>
              </button>
            </div>

            <div className="text-xs text-text-muted font-medium">
              {filteredPortfolios.length} of {portfolios.length}
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
          {portfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="p-6 bg-surface-elevated border border-dashed border-border mb-6">
                <span className="material-symbols-outlined text-6xl text-text-muted">folder</span>
              </div>
              <h3 className="text-lg font-bold text-text-secondary mb-2">No portfolios yet</h3>
              <p className="text-text-muted text-center max-w-md mb-6 text-sm">
                Create your first portfolio by adding NCEA standards and saving, or import directly from your NCEA portal.
              </p>
              {onOpenImport && (
              <button onClick={onOpenImport} className="btn-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">cloud_upload</span>
                Import from NCEA portal
              </button>
            )}
            </div>
          ) : filteredPortfolios.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <span className="material-symbols-outlined text-6xl text-text-muted mb-4">search</span>
              <h3 className="text-lg font-bold text-text-secondary mb-2">No portfolios found</h3>
              <p className="text-text-muted text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPortfolios.map((p, idx) => {
                    const subjects = getSubjects(p);

                    return (
                      <div
                        key={p.id}
                        className="panel p-5 group cursor-pointer hover:border-primary relative overflow-hidden transition-all stagger-item"
                        style={{ '--stagger-index': idx } as React.CSSProperties}
                        onClick={() => handleLoadPortfolio(p)}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoadPortfolio(p); } }}
                        aria-label={`Load ${p.name}`}
                      >
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            {renamingId === p.id ? (
                              <input
                                className="input text-sm font-bold px-2 py-1 -ml-2"
                                value={renamingValue}
                                onChange={(e) => setRenamingValue(e.target.value)}
                                onBlur={() => handleRenameCommit(p)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(p.name); } }}
                                autoFocus
                              />
                            ) : (
                              <h3 className="text-sm font-bold text-text-primary truncate flex items-center gap-2 group/title tracking-tight">
                                <span className="truncate">{p.name}</span>
                                <button
                                  className="opacity-0 group-hover/title:opacity-100 text-text-muted hover:text-primary transition-all flex-shrink-0"
                                  onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); }}
                                  aria-label="Rename" title="Rename"
                                >
                                  <span className="material-symbols-outlined text-sm">edit</span>
                                </button>
                              </h3>
                            )}
                          </div>
                          <div className="relative ml-2 z-10">
                            <button
                              className="btn-ghost !px-2 !py-1.5 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }}
                              aria-label="More options" title="More"
                            >
                              <span className="material-symbols-outlined text-sm">more_vert</span>
                            </button>
                            {openMenuId === p.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-surface-card border border-border p-1 z-50 shadow-modal" role="menu" onClick={(e) => e.stopPropagation()}>
                                  <button className="menu-item text-xs flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleExportPortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">download</span> Export JSON
                                  </button>
                                  <button className="menu-item text-xs flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">content_copy</span> Duplicate
                                  </button>
                                  <div className="h-px bg-border my-1" />
                                  <button className="menu-item text-xs text-error-500 hover:bg-error-50 flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleDeletePortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">delete</span> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>



                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-surface-base border border-border p-3">
                            <div className="text-[10px] text-text-muted mb-1 font-medium">Standards</div>
                            <div className="text-lg font-bold text-text-primary font-mono">{p.items.length}</div>
                          </div>
                          <div className="bg-surface-base border border-border p-3">
                            <div className="text-[10px] text-text-muted mb-1 font-medium">Subjects</div>
                            <div className="text-lg font-bold text-text-primary font-mono">{subjects.length}</div>
                          </div>
                        </div>

                        {/* Subjects Pills */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {subjects.slice(0, 3).map(s => (
                            <span key={s} className="px-2 py-1 text-[10px] bg-primary-subtle text-primary border border-primary/20 font-medium">{s}</span>
                          ))}
                          {subjects.length > 3 && (
                            <span className="px-2 py-1 text-[10px] bg-surface-elevated text-text-muted border border-border font-medium">+{subjects.length - 3} more</span>
                          )}
                        </div>

                        <div className="text-[10px] text-text-muted pt-3 border-t border-border font-medium">
                          Updated {formatDate(p.updatedAt)}
                        </div>

                        {/* Load button overlay */}
                        {openMenuId !== p.id && (
                          <div className="absolute inset-0 bg-surface-card/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-6 pointer-events-none">
                            <button className="btn-primary flex items-center gap-2 pointer-events-auto" onClick={(e) => { e.stopPropagation(); handleLoadPortfolio(p); }}>
                              <span className="material-symbols-outlined text-sm">folder_open</span> Load portfolio
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
                  {filteredPortfolios.map((p, idx) => {
                    const subjects = getSubjects(p);

                    return (
                      <div
                        key={p.id}
                        className="panel p-4 group cursor-pointer hover:border-primary flex items-center gap-4 transition-all stagger-item"
                        style={{ '--stagger-index': idx } as React.CSSProperties}
                        onClick={() => handleLoadPortfolio(p)}
                        role="button" tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLoadPortfolio(p); } }}
                        aria-label={`Load ${p.name}`}
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-subtle border border-primary/20 flex items-center justify-center">
                          <span className="material-symbols-outlined text-lg text-primary">description</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          {renamingId === p.id ? (
                            <input className="input text-sm font-bold px-2 py-1 -ml-2 w-full" value={renamingValue} onChange={(e) => setRenamingValue(e.target.value)} onBlur={() => handleRenameCommit(p)} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); if (e.key === 'Escape') { setRenamingId(null); setRenamingValue(p.name); } }} autoFocus />
                          ) : (
                            <div className="flex items-center gap-2 mb-1 group/title">
                              <h3 className="text-sm font-bold text-text-primary truncate tracking-tight">{p.name}</h3>
                              <button className="opacity-0 group-hover/title:opacity-100 text-text-muted hover:text-primary transition-all flex-shrink-0" onClick={(e) => { e.stopPropagation(); setRenamingId(p.id); setRenamingValue(p.name); }} aria-label="Rename" title="Rename">
                                <span className="material-symbols-outlined text-xs">edit</span>
                              </button>
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-text-muted font-medium">
                            <span>{p.items.length} standards</span>
                            <span>·</span>
                            <span>{subjects.length} subjects</span>
                            <span>·</span>
                            <span>{formatDate(p.updatedAt)}</span>
                          </div>
                        </div>



                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="btn-ghost !px-2 !py-2" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); }} title="Duplicate">
                            <span className="material-symbols-outlined text-sm">content_copy</span>
                          </button>
                          <div className="relative">
                            <button className="btn-ghost !px-2 !py-2" onClick={(e) => { e.stopPropagation(); setOpenMenuId(prev => prev === p.id ? null : p.id); }} aria-label="More options" title="More">
                              <span className="material-symbols-outlined text-sm">more_vert</span>
                            </button>
                            {openMenuId === p.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-surface-card border border-border p-1 z-50 shadow-modal" role="menu" onClick={(e) => e.stopPropagation()}>
                                  <button className="menu-item text-xs flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleExportPortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">download</span> Export JSON
                                  </button>
                                  <button className="menu-item text-xs flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleDuplicatePortfolio(p); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">content_copy</span> Duplicate
                                  </button>
                                  <div className="h-px bg-border my-1" />
                                  <button className="menu-item text-xs text-error-500 hover:bg-error-50 flex items-center gap-2 font-medium" onClick={(e) => { e.stopPropagation(); handleDeletePortfolio(p.id, p.name); setOpenMenuId(null); }}>
                                    <span className="material-symbols-outlined text-sm">delete</span> Delete
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

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deleteTarget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-70 animate-reveal-in">
          <div className="bg-surface-card border border-border shadow-modal w-full max-w-[min(92vw,28rem)] overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex items-center justify-between bg-error-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-error-500 flex items-center justify-center text-white">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </div>
                <h4 className="text-text-primary font-bold text-sm">Delete portfolio?</h4>
              </div>
              <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-text-secondary text-sm">
                Are you sure you want to delete <span className="font-bold text-text-primary">&ldquo;{deleteTarget.name}&rdquo;</span>? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); }} className="btn-ghost px-4 py-2">Cancel</button>
                <button onClick={confirmDeletePortfolio} className="btn-danger px-4 py-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">delete</span> Delete portfolio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}