'use client';

import React, { useState, useEffect } from 'react';
import { portfolioService } from '../app/services/portfolio';
import { nceaParser, type ParseResult } from '../app/services/ncea-parser';
import type { SelectedItem, Grade } from '../app/page';
import { useToast } from '../app/providers/ToastProvider';

const gradeColorMap: Record<Grade, { bg: string; text: string; border: string; active: string }> = {
  'Excellence': { bg: 'bg-[#C4962D]/10', text: 'text-[#C4962D]', border: 'border-[#C4962D]/20', active: 'bg-[#C4962D] text-white' },
  'Merit': { bg: 'bg-[#4A7A8C]/10', text: 'text-[#4A7A8C]', border: 'border-[#4A7A8C]/20', active: 'bg-[#4A7A8C] text-white' },
  'Achieved': { bg: 'bg-[#5B8A3C]/10', text: 'text-[#5B8A3C]', border: 'border-[#5B8A3C]/20', active: 'bg-[#5B8A3C] text-white' },
  'Not Achieved': { bg: 'bg-[#B33A3A]/10', text: 'text-[#B33A3A]', border: 'border-[#B33A3A]/20', active: 'bg-[#B33A3A] text-white' },
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLoadPortfolio: (payload: { id?: string; name?: string; items: SelectedItem[] }) => void;
}

export function NCEAParserModal({ isOpen, onClose, onLoadPortfolio }: Props) {
  const [nceaText, setNCEAText] = useState('');
  const [isParsingNCEA, setIsParsingNCEA] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newPortfolioName, setNewPortfolioName] = useState('NCEA Import');
  const { showError, showInfo, showWarning } = useToast();

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalOverflow; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleParseNCEAText = async () => {
    if (!nceaText.trim()) { showInfo('Please paste your NCEA portal text first'); return; }
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
    if (!parseResult?.validStandards.length) { showWarning('No valid standards to import'); return; }
    const saved = portfolioService.savePortfolio(
      name.trim() || 'NCEA Import',
      parseResult.validStandards,
      `Imported from NCEA portal - ${parseResult.summary.validInDatabase} standards`
    );
    onLoadPortfolio({ id: saved.id, name: saved.name, items: parseResult.validStandards });
    setShowNameModal(false);
    setNewPortfolioName('NCEA Import');
    setNCEAText('');
    setParseResult(null);
    onClose();
  };

  const handleLoadParsedStandards = () => {
    if (!parseResult?.validStandards.length) { showWarning('No valid standards to load'); return; }
    onLoadPortfolio({ items: parseResult.validStandards });
    setNCEAText('');
    setParseResult(null);
    onClose();
  };

  const handleGradeChange = (standardNumber: number, newGrade: Grade) => {
    if (!parseResult) return;
    const newStandards = parseResult.validStandards.map(item =>
      item.standard.standard_number === standardNumber ? { ...item, grade: newGrade } : item
    );
    setParseResult({ ...parseResult, validStandards: newStandards });
  };

  const handleClose = () => {
    setNCEAText('');
    setParseResult(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-60 animate-reveal-in">
        <div className="bg-surface-card border border-border shadow-modal w-full max-w-[min(92vw,60rem)] max-h-[90vh] overflow-hidden animate-scale-in">
          <div className="bg-surface-elevated border-b border-border">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-primary flex items-center justify-center text-text-inverse">
                  <span className="material-symbols-outlined text-xl">cloud_upload</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Import from NCEA portal</h3>
                  <p className="text-text-muted text-xs mt-0.5">Copy all text from your NCEA portal and paste below</p>
                </div>
              </div>
              <button onClick={handleClose} className="btn-ghost hover:bg-error-50 hover:text-error-500 hover:border-error-200" title="Close">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
            {!parseResult ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-text-primary text-xs font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg text-primary">description</span>
                    NCEA portal text
                  </label>
                  <textarea
                    value={nceaText}
                    onChange={(e) => setNCEAText(e.target.value)}
                    placeholder="Paste your NCEA portal text here..."
                    className="input h-80 font-mono text-sm"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 text-text-secondary text-xs bg-warning-50 px-4 py-3 border border-warning-200 flex-1 min-w-[280px]">
                    <span className="material-symbols-outlined text-lg text-grade-excellence flex-shrink-0 mt-0.5">lightbulb</span>
                    <div>
                      <div className="font-bold text-grade-excellence mb-1">Quick tip</div>
                      <div className="text-text-secondary">Press <kbd className="px-1.5 py-0.5 bg-surface-card border border-border text-[10px] font-mono">Ctrl+A</kbd> on your Entries and results page for this year, then <kbd className="px-1.5 py-0.5 bg-surface-card border border-border text-[10px] font-mono">Ctrl+C</kbd> to copy, and paste here.</div>
                    </div>
                  </div>
                  <button onClick={handleParseNCEAText} disabled={!nceaText.trim() || isParsingNCEA} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3">
                    {isParsingNCEA ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/20 border-t-white animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">check_circle</span>
                        Parse standards
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Parse Results Summary */}
                <div className="panel p-5">
                  <h4 className="font-bold text-text-primary mb-4 flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-lg text-primary">info</span>
                    Import summary
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-3 bg-surface-base border border-border">
                      <div className="text-2xl font-bold text-text-primary font-mono mb-1">{parseResult.summary.validInDatabase}</div>
                      <div className="text-[10px] text-text-muted font-medium">Total standards</div>
                    </div>
                    <div className="text-center p-3 bg-[#B33A3A]/5 border border-[#B33A3A]/20">
                      <div className="text-2xl font-bold text-grade-notAchieved font-mono mb-1">{parseResult.summary.invalidNotInDatabase}</div>
                      <div className="text-[10px] text-text-muted font-medium">Not in database</div>
                    </div>
                  </div>
                </div>

                {/* Standards not sat yet */}
                {parseResult.validStandards.filter(s => parseResult.unsatStandardNumbers && parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).length > 0 && (
                  <div className="panel p-5">
                    <h4 className="font-bold text-grade-excellence mb-4 flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Standards not sat yet ({parseResult.validStandards.filter(s => parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).length})
                    </h4>
                    <p className="text-text-secondary text-xs mb-4">
                      Some of your standards haven't been sat yet, so you'll need to manually enter an expected grade. We've defaulted these to Achieved.
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {parseResult.validStandards.filter(s => parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).map((item, index) => (
                        <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-surface-base p-3 border border-border gap-3">
                          <div className="flex-1 min-w-0 pr-4">
                            <div className="font-bold text-text-primary flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-grade-excellence flex-shrink-0">school</span>
                              <span className="truncate">{item.standard.standard_number} · {item.standard.title}</span>
                            </div>
                            <div className="text-text-muted text-[10px] mt-1 font-medium">
                              {item.standard.credits} credits · Year: {item.year_achieved || 'N/A'}
                            </div>
                          </div>
                          <div className="flex border border-border bg-surface-base flex-shrink-0 self-start sm:self-center">
                            {(item.standard.standards_type === 'Unit' ? (['N', 'A'] as const) : (['N', 'A', 'M', 'E'] as const)).map((g) => {
                              const fullGrade: Grade = g === 'E' ? 'Excellence' : g === 'M' ? 'Merit' : g === 'A' ? 'Achieved' : 'Not Achieved';
                              const isSelected = item.grade === fullGrade;
                              const colors = gradeColorMap[fullGrade];
                              return (
                                <button
                                  key={g}
                                  onClick={() => handleGradeChange(item.standard.standard_number, fullGrade)}
                                  className={`w-9 h-8 text-xs font-bold transition-all duration-200 ${isSelected ? colors.active : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'}`}
                                  title={fullGrade}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Valid Standards */}
                {parseResult.validStandards.filter(s => !parseResult.unsatStandardNumbers || !parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).length > 0 && (
                  <div className="panel p-5">
                    <h4 className="font-bold text-grade-achieved mb-4 flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-lg">check_circle</span>
                      Standards ready for import ({parseResult.validStandards.filter(s => !parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {parseResult.validStandards.filter(s => !parseResult.unsatStandardNumbers || !parseResult.unsatStandardNumbers.includes(s.standard.standard_number)).map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm bg-surface-base p-3 border border-border">
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-text-primary flex items-center gap-2">
                              <span className="material-symbols-outlined text-sm text-grade-achieved flex-shrink-0">school</span>
                              <span className="truncate">{item.standard.standard_number} · {item.standard.title}</span>
                            </div>
                            <div className="text-text-muted text-[10px] mt-1 font-medium">
                              {item.standard.credits} credits · Grade: {item.grade}
                              {item.year_achieved && ` · Year: ${item.year_achieved}`}
                              {item.standard_version && ` · Version: ${item.standard_version}`}
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
                    <h4 className="font-bold text-grade-notAchieved mb-4 flex items-center gap-2 text-sm">
                      <span className="material-symbols-outlined text-lg">error</span>
                      Standards not in database ({parseResult.invalidStandards.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {parseResult.invalidStandards.map((std, index) => (
                        <div key={index} className="text-sm bg-surface-base p-3 border border-border">
                          <div className="font-bold text-text-secondary flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-grade-notAchieved flex-shrink-0">error</span>
                            <span className="truncate">{std.standard_number} · {std.title}</span>
                          </div>
                          <div className="text-text-muted text-[10px] mt-1 font-medium">
                            Level {std.level} · {std.credits} credits · {std.result}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <button onClick={() => { setParseResult(null); setNCEAText(''); }} className="btn-ghost">
                    <span className="material-symbols-outlined text-sm">close</span> Parse again
                  </button>
                  <div className="flex items-center gap-3">
                    <button onClick={handleLoadParsedStandards} disabled={!parseResult.validStandards.length} className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="material-symbols-outlined text-sm">folder_open</span> Load to current portfolio
                    </button>
                    <button onClick={() => { setShowNameModal(true); setNewPortfolioName('NCEA Import'); }} disabled={!parseResult.validStandards.length} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                      <span className="material-symbols-outlined text-sm">bookmark</span> Save as new portfolio
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Name Modal */}
      {parseResult && showNameModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-70 animate-reveal-in">
          <div className="bg-surface-card border border-border shadow-modal w-full max-w-[min(92vw,28rem)] overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-border flex items-center justify-between bg-surface-elevated">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary flex items-center justify-center text-text-inverse">
                  <span className="material-symbols-outlined text-lg">bookmark</span>
                </div>
                <h4 className="text-text-primary font-bold text-sm">Name your portfolio</h4>
              </div>
              <button onClick={() => setShowNameModal(false)} className="btn-ghost">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Portfolio name</label>
                <input
                  className="input"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleImportParsedStandards(newPortfolioName); }}
                  placeholder="e.g., Year 13 2024"
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button onClick={() => setShowNameModal(false)} className="btn-ghost px-4 py-2">Cancel</button>
                <button onClick={() => handleImportParsedStandards(newPortfolioName)} className="btn-primary px-4 py-2 flex items-center gap-2" disabled={!newPortfolioName.trim()}>
                  <span className="material-symbols-outlined text-sm">bookmark</span> Save portfolio
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
