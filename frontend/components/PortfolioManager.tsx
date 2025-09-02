'use client';

import React, { useState, useEffect } from 'react';
import { portfolioService, type SavedPortfolio } from '../app/services/portfolio';
import { nceaParser, type ParseResult } from '../app/services/ncea-parser';
import type { SelectedItem } from '../app/page';

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
              onClick={() => setShowNCEAImport(true)}
              className="px-3 py-2 rounded-lg border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 text-sm"
            >
              Import from NCEA
            </button>
            <button
              onClick={handleImportPortfolio}
              className="px-3 py-2 rounded-lg border border-green-500/50 text-green-400 hover:bg-green-500/10 text-sm"
            >
              Import JSON
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

      {/* NCEA Import Modal */}
      {showNCEAImport && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-60">
          <div className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-200">Import from NCEA Portal</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Copy all text from your NCEA portal (Ctrl+A, Ctrl+C) and paste it below
                </p>
              </div>
              <button
                onClick={() => {
                  setShowNCEAImport(false);
                  setNCEAText('');
                  setParseResult(null);
                }}
                className="px-3 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {!parseResult ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">
                      NCEA Portal Text
                    </label>
                    <textarea
                      value={nceaText}
                      onChange={(e) => setNCEAText(e.target.value)}
                      placeholder="Paste your NCEA portal text here... (should include standards tables with Std., Ver., Asm., Title, Lvl., Credits, Result columns)"
                      className="w-full h-64 px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-slate-200 placeholder-slate-500 text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-slate-400 text-sm">
                      💡 Go to your NCEA portal, press Ctrl+A to select all, then Ctrl+C to copy, then paste here
                    </div>
                    <button
                      onClick={handleParseNCEAText}
                      disabled={!nceaText.trim() || isParsingNCEA}
                      className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isParsingNCEA ? 'Parsing...' : 'Parse Standards'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Parse Results Summary */}
                  <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                    <h4 className="font-medium text-slate-200 mb-3">Import Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-300">{parseResult.summary.totalFound}</div>
                        <div className="text-slate-500">Total Standards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-400">{parseResult.summary.level3Found}</div>
                        <div className="text-slate-500">Level 3 Standards</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{parseResult.summary.validInDatabase}</div>
                        <div className="text-slate-500">Valid for ATAR</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{parseResult.summary.invalidNotInDatabase}</div>
                        <div className="text-slate-500">Not in Database</div>
                      </div>
                    </div>
                  </div>

                  {/* Valid Standards */}
                  {parseResult.validStandards.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                      <h4 className="font-medium text-green-400 mb-3">
                        Standards Ready for Import ({parseResult.validStandards.length})
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {parseResult.validStandards.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-sm bg-slate-700/50 rounded-lg p-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-slate-200">
                                {item.standard.standard_number} • {item.standard.title}
                              </div>
                              <div className="text-slate-400 text-xs">
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
                    <div className="rounded-xl border border-white/10 bg-slate-800/60 p-4">
                      <h4 className="font-medium text-red-400 mb-3">
                        Standards Not in Database ({parseResult.invalidStandards.length})
                      </h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {parseResult.invalidStandards.map((std, index) => (
                          <div key={index} className="text-sm bg-slate-700/50 rounded-lg p-2">
                            <div className="font-medium text-slate-300">
                              {std.standard_number} • {std.title}
                            </div>
                            <div className="text-slate-500 text-xs">
                              Level {std.level} • {std.credits} credits • {std.result}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => {
                        setParseResult(null);
                        setNCEAText('');
                      }}
                      className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5"
                    >
                      Parse Again
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleLoadParsedStandards}
                        disabled={!parseResult.validStandards.length}
                        className="px-4 py-2 rounded-lg border border-purple-500/50 text-purple-400 hover:bg-purple-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Load to Current Portfolio
                      </button>
                      <button
                        onClick={handleImportParsedStandards}
                        disabled={!parseResult.validStandards.length}
                        className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      >
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