'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestions, searchStandards, type Standard, type StandardsSearchResponse, type SuggestionsResponse } from '../app/services/api';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
  AcademicCapIcon,
  BookOpenIcon,
  ArrowRightIcon
} from '@heroicons/react/24/outline';
import { createPortal } from 'react-dom';

interface Props {
  onAdd: (standard: Standard) => void;
  onRemove: (standardNumber: number) => void;
  selectedStandardIds: Set<number>;
}

export function SearchStandards({ onAdd, onRemove, selectedStandardIds }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionsResponse>({ subjects: [], standards: [] });
  const [searchData, setSearchData] = useState<StandardsSearchResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (query.trim().length < 2 || !showSuggestions) {
      setSuggestions({ subjects: [], standards: [] });
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
    setSuggestions({ subjects: [], standards: [] });
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
      } else if (suggestions.standards.length > 0) {
        const firstStandard = suggestions.standards[0];
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

  const relatedGroups = searchData?.related_groups ?? [];
  const suggestion = searchData?.suggestion ?? null;

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="relative z-40">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-500 to-accent-500 rounded-2xl opacity-30 group-hover:opacity-60 blur transition duration-500"></div>
          <div className="relative flex items-center bg-[#0B101B] rounded-xl border border-white/10 shadow-xl">
            <div className="pl-4 text-slate-400">
              <MagnifyingGlassIcon className="w-6 h-6" />
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search subjects (e.g., Calculus) or standards (e.g., 91578)..."
              className="w-full bg-transparent border-none px-4 py-4 text-lg text-white placeholder:text-slate-500 focus:ring-0 outline-none"
              onFocus={() => setShowSuggestions(true)}
            />
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
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="pr-2">
              <button
                type="submit"
                disabled={loadingSearch}
                className="p-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white shadow-lg shadow-brand-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingSearch ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <ArrowRightIcon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {loadingSuggest && query && (
          <div className="absolute -bottom-8 left-0 text-xs text-slate-400 flex items-center gap-2 animate-pulse">
            <div className="w-1.5 h-1.5 bg-brand-400 rounded-full" />
            Fetching suggestions...
          </div>
        )}
      </form>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm flex items-center gap-3 animate-reveal-in">
          <XMarkIcon className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {suggestion && !relatedGroups.length && (
        <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-200 text-sm flex items-center gap-2 animate-reveal-in">
          <span>Did you mean</span>
          <button
            className="font-bold underline hover:text-white transition-colors"
            onClick={() => { setQuery(suggestion.value); performSearch(suggestion.value); }}
          >
            {suggestion.value}
          </button>
          <span>?</span>
        </div>
      )}

      {relatedGroups.length > 0 && (
        <div className="space-y-6 animate-reveal-up">
          {relatedGroups.map((group, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2 text-slate-300 px-1">
                <BookOpenIcon className="w-5 h-5 text-brand-400" />
                <h3 className="font-medium text-lg">{group.name}</h3>
                <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400">{group.standards.length}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.standards.map(std => (
                  <StandardCard key={std.standard_number} std={std} onAdd={addStandard} onRemove={onRemove} selected={selectedStandardIds.has(std.standard_number)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isClient && createPortal(
        (showSuggestions && (suggestions.subjects.length > 0 || suggestions.standards.length > 0) && dropdownPos) ? (
          <div
            className="fixed z-[9999] rounded-xl border border-white/10 bg-[#0B101B]/95 backdrop-blur-xl text-slate-100 shadow-2xl overflow-hidden ring-1 ring-white/5"
            style={{ left: dropdownPos.left, top: dropdownPos.top, width: dropdownPos.width, maxHeight: `${dropdownPos.maxHeight}px` }}
          >
            <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: `${dropdownPos.maxHeight}px` }}>
              {suggestions.subjects.length > 0 && (
                <div className="py-2">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <BookOpenIcon className="w-3 h-3" />
                    Subjects
                  </div>
                  {suggestions.subjects.map((subject, idx) => (
                    <button
                      key={`subject-${idx}`}
                      type="button"
                      onClick={() => {
                        setShowSuggestions(false);
                        setQuery(subject);
                        performSearch(subject);
                        inputRef.current?.blur();
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-brand-500/20 hover:text-white text-slate-300 transition-colors flex items-center gap-3 group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-800/50 group-hover:bg-brand-500/20 flex items-center justify-center transition-colors">
                        <BookOpenIcon className="w-4 h-4 text-slate-400 group-hover:text-brand-300" />
                      </div>
                      <span className="font-medium">{subject}</span>
                    </button>
                  ))}
                </div>
              )}

              {suggestions.standards.length > 0 && (
                <div className="py-2 border-t border-white/5">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <AcademicCapIcon className="w-3 h-3" />
                    Standards
                  </div>
                  {suggestions.standards.map((standard, idx) => {
                    const match = standard.match(/^\d+/);
                    const standardNumber = match ? match[0] : standard;
                    return (
                      <button
                        key={`standard-${idx}`}
                        type="button"
                        onClick={() => {
                          handleStandardSuggestionClick(standardNumber);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-500/20 hover:text-white text-slate-300 transition-colors flex items-center gap-3 group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-800/50 group-hover:bg-brand-500/20 flex items-center justify-center transition-colors">
                          <AcademicCapIcon className="w-4 h-4 text-slate-400 group-hover:text-brand-300" />
                        </div>
                        <span className="truncate text-sm">{standard}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
}

function StandardCard({ std, onAdd, onRemove, selected }: {
  std: Standard;
  onAdd: (s: Standard) => void;
  onRemove: (standardNumber: number) => void;
  selected: boolean;
}) {
  return (
    <div className="group relative bg-slate-900/40 border border-white/5 hover:border-brand-500/30 rounded-xl p-4 transition-all duration-300 hover:bg-slate-800/60 hover:shadow-lg hover:-translate-y-0.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-brand-300 font-semibold">{std.standard_number}</span>
            {std.is_ue && (
              <span className="badge-ue text-[10px] py-0 px-1.5 h-4">UE</span>
            )}
          </div>
          <h4 className="text-sm font-medium text-slate-200 leading-snug line-clamp-2 mb-2 min-h-[2.5em]">{std.title}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>{std.credits} Credits</span>
            <span>•</span>
            <span className="truncate max-w-[100px]">{std.assessment_type}</span>
          </div>
        </div>

        <button
          onClick={() => selected ? onRemove(std.standard_number) : onAdd(std)}
          className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${selected
              ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white'
              : 'bg-white/5 text-slate-400 hover:bg-brand-500 hover:text-white'
            }`}
          title={selected ? "Remove standard" : "Add standard"}
        >
          {selected ? <XMarkIcon className="w-5 h-5" /> : <PlusIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}