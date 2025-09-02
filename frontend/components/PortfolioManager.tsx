'use client';

import React, { useState, useEffect } from 'react';
import { portfolioService, type SavedPortfolio } from '../app/services/portfolio';
import type { SelectedItem } from '../app/page';

interface Props {
  onLoadPortfolio: (items: SelectedItem[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function PortfolioManager({ onLoadPortfolio, isOpen, onClose }: Props) {
  const [portfolios, setPortfolios] = useState<SavedPortfolio[]>([]);
  const [storageInfo, setStorageInfo] = useState({ used: 0, available: 0, portfolioCount: 0 });

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
      <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-200">Portfolio Manager</h2>
            <p className="text-slate-400 text-sm mt-1">
              {storageInfo.portfolioCount} saved portfolios • {formatStorageSize(storageInfo.used)} used
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleImportPortfolio}
              className="px-3 py-2 rounded-lg border border-green-500/50 text-green-400 hover:bg-green-500/10 text-sm"
            >
              Import
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {portfolios.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">No saved portfolios yet</div>
              <p className="text-slate-500 text-sm">
                Build your NCEA portfolio and click "Save Portfolio" to store it for later use.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {portfolios.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="rounded-xl border border-white/10 bg-slate-800/60 p-4 hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-200 mb-1">{portfolio.name}</h3>
                      {portfolio.description && (
                        <p className="text-slate-400 text-sm mb-2">{portfolio.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>{portfolio.items.length} standards</span>
                        <span>Created {formatDate(portfolio.createdAt)}</span>
                        {portfolio.updatedAt !== portfolio.createdAt && (
                          <span>Updated {formatDate(portfolio.updatedAt)}</span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Array.from(new Set(portfolio.items.map(item => item.standard.subject))).map(subject => (
                          <span
                            key={subject}
                            className="px-2 py-1 rounded bg-slate-700/50 text-slate-300 text-xs"
                          >
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleLoadPortfolio(portfolio)}
                        className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => handleExportPortfolio(portfolio.id, portfolio.name)}
                        className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm"
                      >
                        Export
                      </button>
                      <button
                        onClick={() => handleDeletePortfolio(portfolio.id, portfolio.name)}
                        className="px-3 py-2 rounded-lg border border-red-500/50 text-red-400 hover:bg-red-500/10 text-sm"
                      >
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
    </div>
  );
} 