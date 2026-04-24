'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestions, searchStandards, type Standard, type StandardsSearchResponse, type SuggestionsResponse } from '../app/services/api';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

interface Props {
  onAdd: (standard: Standard) => void;
  onRemove: (standardNumber: number) => void;
  selectedStandardIds: Set<number>;
}

/* ── Framer-motion variants (adapted from action-searchbar) ── */

const dropdownContainer: Variants = {
  hidden: { opacity: 0, height: 0 },
  show: {
    opacity: 1,
    height: 'auto',
    transition: {
      height: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
      staggerChildren: 0.05,
    },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      height: { duration: 0.25 },
      opacity: { duration: 0.15 },
    },
  },
};

const dropdownItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.15 },
  },
};

const resultsContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.08,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.2 },
  },
};

const resultCard: Variants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.97,
    transition: { duration: 0.2 },
  },
};

const resultGroupHeader: Variants = {
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3 },
  },
};

/* ── Component ── */

export function SearchStandards({ onAdd, onRemove, selectedStandardIds }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionsResponse>({ subjects: [], standards: [] });
  const [searchData, setSearchData] = useState<StandardsSearchResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);
  const [isClient, setIsClient] = useState(false);

  const updateDropdownPos = () => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    let width = rect.width;
    const maxViewportWidth = Math.max(0, window.innerWidth - margin * 2);
    if (width > maxViewportWidth) width = maxViewportWidth;
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - width);
    }
    const gap = 8;
    const topCandidate = rect.bottom + gap;
    const remInPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const availableBelow = window.innerHeight - remInPx - topCandidate;
    const availableAbove = rect.top - remInPx;
    const maxHeightLimit = window.innerHeight * 0.5;

    let maxHeight = Math.min(Math.max(availableBelow, 0), maxHeightLimit);
    let top = topCandidate;

    if (maxHeight < 150 && availableAbove > availableBelow) {
      maxHeight = Math.min(Math.max(availableAbove, 0), maxHeightLimit);
      top = Math.max(margin, rect.top - gap - maxHeight);
    }

    setDropdownPos({ left, top, width, maxHeight });
  };

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        formRef.current && !formRef.current.contains(target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(target))
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showSuggestions && (suggestions.subjects.length > 0 || suggestions.standards.length > 0)) {
      updateDropdownPos();
    }
  }, [showSuggestions, suggestions, query]);

  useEffect(() => {
    const onResizeOrScroll = () => { if (showSuggestions) updateDropdownPos(); };
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [showSuggestions]);

  useEffect(() => {
    if (!isClient) return;
    const el = inputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { if (showSuggestions) updateDropdownPos(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isClient, showSuggestions]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions({ subjects: [], standards: [] });
      return;
    }
    if (!showSuggestions) {
      return;
    }
    let canceled = false;
    const trimmed = query.trim();
    const t = setTimeout(async () => {
      try {
        setLoadingSuggest(true);
        const s = await getSuggestions(trimmed);
        if (!canceled) setSuggestions(s);
      } catch (e) {
        console.error(e);
      } finally {
        if (!canceled) setLoadingSuggest(false);
      }
    }, 200);
    return () => { canceled = true; clearTimeout(t); };
  }, [query, showSuggestions]);

  const performSearch = async (q: string) => {
    if (!q.trim()) return;
    setError(null);
    setLoadingSearch(true);
    try {
      const data = await searchStandards(q.trim());
      setSearchData(data);
    } catch (e) {
      console.error(e);
      setError('Search failed. Please try again.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    closeSuggestions();
    performSearch(query);
    inputRef.current?.blur();
  };

  const addStandard = (standard: Standard) => {
    onAdd(standard);
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const closeSuggestions = () => {
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.subjects.length > 0) {
        const firstSubject = suggestions.subjects[0];
        closeSuggestions();
        setQuery(firstSubject);
        performSearch(firstSubject);
        inputRef.current?.blur();
      } else if (sortedStandards.length > 0) {
        const firstStandard = sortedStandards[0];
        const standardNumber = firstStandard.split(' • ')[0];
        handleStandardSuggestionClick(standardNumber);
      } else {
        closeSuggestions();
        performSearch(query);
        inputRef.current?.blur();
      }
    }
  };

  const handleStandardSuggestionClick = async (standardNumber: string) => {
    closeSuggestions();
    setQuery(standardNumber);
    inputRef.current?.blur();
    try {
      setLoadingSearch(true);
      const data = await searchStandards(standardNumber);
      setSearchData(data);
      if (data.direct_results && data.direct_results.length > 0) {
        const standard = data.direct_results[0];
        if (!selectedStandardIds.has(standard.standard_number)) {
          addStandard(standard);
        }
      }
    } catch (e) {
      console.error(e);
      setError('Search failed. Please try again.');
    } finally {
      setLoadingSearch(false);
    }
  };

  const sortedStandards = useMemo(() => {
    if (!suggestions.standards || suggestions.standards.length === 0) return [];
    return [...suggestions.standards].sort((a, b) => {
      const numA = parseInt(a.match(/^\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.match(/^\d+/)?.[0] || '0', 10);
      return numB - numA;
    });
  }, [suggestions.standards]);

  const relatedGroups = searchData?.related_groups ?? [];
  const suggestion = searchData?.suggestion ?? null;
  const hasSuggestions = suggestions.subjects.length > 0 || suggestions.standards.length > 0;

  return (
    <div className="space-y-6">
      {/* ── Search Bar (unchanged styling) ── */}
      <form ref={formRef} onSubmit={onSubmit} className="relative z-40">
        <div className="flex items-center bg-surface-card border border-border shadow-card">
          <div className="pl-4 text-text-muted">
            <span className="material-symbols-outlined text-xl">search</span>
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search subjects (e.g. Calculus) or standards (e.g. 91578 or Differentiation)..."
            className="w-full bg-transparent border-none px-4 py-4 text-sm text-text-primary placeholder:text-text-muted placeholder:text-xs focus:ring-0 outline-none"
            onFocus={() => setShowSuggestions(true)}
          />
          {loadingSuggest && query && (
            <div className="px-3 text-xs text-text-muted flex items-center gap-2 animate-pulse">
              <div className="w-1.5 h-1.5 bg-primary" />
              Searching...
            </div>
          )}
          <div className="pr-2 group relative flex items-center">
            <div className="p-2 text-text-muted hover:text-text-primary transition-colors cursor-help">
              <span className="material-symbols-outlined text-xl">info</span>
            </div>
            <div className="absolute right-0 top-full pt-2 hidden group-hover:block w-[320px] sm:w-[400px] z-[9999]">
              <div className="p-4 bg-surface-elevated border border-border shadow-modal text-xs text-text-secondary leading-relaxed text-left">
                Don&apos;t see your subjects or standards? We use <a href="https://www2.nzqa.govt.nz/ncea/understanding-secondary-quals/university-entrance/ue-subjects/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">NZQA&apos;s Approved subjects for UE list</a>. For Non-UE Subject we use NZQA&apos;s Official subject name. If you can&apos;t find your subject, enter the individual standard code (e.g. 91234) and we&apos;ll pull up the subject we&apos;ve got it listed under. And if all else fails then that means either the standard isn&apos;t level 3, the standard is new or we don&apos;t have any historical data on it :(
              </div>
            </div>
          </div>
          <div className="pr-2">
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSearchData(null);
                  setSuggestions({ subjects: [], standards: [] });
                  setShowSuggestions(false);
                  inputRef.current?.focus();
                }}
                className="p-2 hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            )}
          </div>
          <div className="pr-2">
            <button
              type="submit"
              disabled={loadingSearch}
              className="p-2 bg-primary hover:bg-primary-light text-text-inverse transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSearch ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-xl">arrow_forward</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Inline feedback (error / did-you-mean) ── */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="p-4 bg-error-50 border border-error-200 text-error-500 text-sm flex items-center gap-3"
          >
            <span className="material-symbols-outlined text-xl">error</span>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {suggestion && !relatedGroups.length && (
          <motion.div
            key="suggestion"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="p-4 bg-primary-subtle border border-primary/20 text-text-primary text-sm flex items-center gap-2"
          >
            <span>Did you mean</span>
            <button
              className="font-bold underline text-primary hover:text-primary-dark transition-colors"
              onClick={() => { setQuery(suggestion.value); performSearch(suggestion.value); }}
            >
              {suggestion.value}
            </button>
            <span>?</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Results with stagger animation ── */}
      <AnimatePresence mode="wait">
        {relatedGroups.length > 0 && (
          <motion.div
            key="results"
            className="space-y-6"
            variants={resultsContainer}
            initial="hidden"
            animate="show"
            exit="exit"
          >
            {relatedGroups.map((group, idx) => (
              <motion.div key={idx} className="space-y-3" variants={resultCard}>
                <motion.div
                  className="flex items-center gap-2 text-text-primary px-1"
                  variants={resultGroupHeader}
                >
                  <span className="material-symbols-outlined text-xl text-primary">menu_book</span>
                  <h3 className="font-bold text-sm tracking-tight">{group.name}</h3>
                  <span className="text-[10px] bg-surface-elevated border border-border px-2 py-0.5 text-text-muted font-bold">{group.standards.length}</span>
                </motion.div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.standards.map((std, stdIdx) => (
                    <motion.div key={std.standard_number} variants={resultCard}>
                      <StandardCard
                        std={std}
                        onAdd={addStandard}
                        onRemove={onRemove}
                        selected={selectedStandardIds.has(std.standard_number)}
                        index={stdIdx}
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Suggestion Dropdown (portal) with container/item stagger ── */}
      {isClient && createPortal(
        <AnimatePresence>
          {showSuggestions && hasSuggestions && dropdownPos && (
            <motion.div
              ref={dropdownRef}
              className="fixed z-[9999] border border-border bg-surface-card text-text-primary shadow-modal overflow-hidden"
              style={{ left: dropdownPos.left, top: dropdownPos.top, width: dropdownPos.width, maxHeight: `${dropdownPos.maxHeight}px` }}
              variants={dropdownContainer}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              <motion.div className="overflow-y-auto" style={{ maxHeight: `${dropdownPos.maxHeight}px` }}>
                {suggestions.subjects.length > 0 && (
                  <div className="py-2">
                    <motion.div
                      className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] flex items-center gap-2"
                      variants={dropdownItem}
                      layout="position"
                    >
                      <span className="material-symbols-outlined text-xs">menu_book</span>
                      Subjects
                    </motion.div>
                    <AnimatePresence mode="popLayout">
                      {suggestions.subjects.map((subject) => (
                        <motion.button
                          key={subject}
                          type="button"
                          variants={dropdownItem}
                          layout="position"
                          initial="hidden"
                          animate="show"
                          exit="exit"
                          onClick={() => {
                            setShowSuggestions(false);
                            setQuery(subject);
                            performSearch(subject);
                            inputRef.current?.blur();
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary-subtle hover:text-primary text-text-secondary transition-colors flex items-center gap-3 group"
                        >
                          <div className="w-8 h-8 bg-surface-elevated group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                            <span className="material-symbols-outlined text-sm text-text-muted group-hover:text-primary">menu_book</span>
                          </div>
                          <span className="font-bold text-sm">{subject}</span>
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {suggestions.standards.length > 0 && (
                  <div className="py-2 border-t border-border">
                    <motion.div
                      className="px-4 py-1.5 text-[10px] font-bold text-text-muted uppercase tracking-[0.15em] flex items-center gap-2"
                      variants={dropdownItem}
                      layout="position"
                    >
                      <span className="material-symbols-outlined text-xs">school</span>
                      Standards
                    </motion.div>
                    <AnimatePresence mode="popLayout">
                      {sortedStandards.map((standard) => {
                        const match = standard.match(/^\d+/);
                        const standardNumber = match ? match[0] : standard;
                        return (
                          <motion.button
                            key={standard}
                            type="button"
                            variants={dropdownItem}
                            layout="position"
                            initial="hidden"
                            animate="show"
                            exit="exit"
                            onClick={() => {
                              handleStandardSuggestionClick(standardNumber);
                            }}
                            className="w-full text-left px-4 py-2.5 hover:bg-primary-subtle hover:text-primary text-text-secondary transition-colors flex items-center gap-3 group"
                          >
                            <div className="w-8 h-8 bg-surface-elevated group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                              <span className="material-symbols-outlined text-sm text-text-muted group-hover:text-primary">school</span>
                            </div>
                            <span className="truncate text-sm">{standard}</span>
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function StandardCard({ std, onAdd, onRemove, selected, index }: {
  std: Standard;
  onAdd: (s: Standard) => void;
  onRemove: (standardNumber: number) => void;
  selected: boolean;
  index: number;
}) {
  return (
    <div
      className="group relative bg-surface-card border border-border hover:border-border-strong p-4 transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-primary font-bold">{std.standard_number}</span>
            {std.is_ue && (
              <span className="badge-ue text-[10px] py-0 px-1.5 h-4">UE</span>
            )}
          </div>
          <h4 className="text-sm font-bold text-text-primary leading-snug line-clamp-2 mb-2 min-h-[2.5em] tracking-tight">{std.title}</h4>
          <div className="flex items-center gap-2 text-[10px] text-text-muted font-medium">
            <span>{std.credits} credits</span>
            <span>·</span>
            <span className="truncate max-w-[100px]">{std.assessment_type}</span>
          </div>
        </div>

        <button
          onClick={() => selected ? onRemove(std.standard_number) : onAdd(std)}
          className={`shrink-0 w-9 h-9 flex items-center justify-center transition-all duration-200 border ${selected
            ? 'bg-error-50 text-error-500 border-error-200 hover:bg-error-500 hover:text-white hover:border-error-500'
            : 'bg-surface-base text-text-muted border-border hover:bg-primary hover:text-text-inverse hover:border-primary'
            }`}
          title={selected ? "Remove standard" : "Add standard"}
        >
          <span className="material-symbols-outlined text-lg">{selected ? 'close' : 'add'}</span>
        </button>
      </div>
    </div>
  );
}