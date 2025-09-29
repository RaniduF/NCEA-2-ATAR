'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestions, searchStandards, type Standard, type StandardsSearchResponse, type SuggestionsResponse } from '../app/services/api';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  XMarkIcon,
  AcademicCapIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { createPortal } from 'react-dom';

interface Props {
  onAdd: (standard: Standard) => void;
  onRemove: (standardNumber: number) => void;
  selectedStandardIds: Set<number>;
}

/**
 * Search UI component for finding subjects or standards, displaying live suggestions and grouped search results, and enabling adding or removing standards.
 *
 * @param onAdd - Callback invoked with a `Standard` when the user adds a standard.
 * @param onRemove - Callback invoked with a standard number when the user removes a standard.
 * @param selectedStandardIds - Set of standard numbers that are currently selected.
 * @returns The rendered SearchStandards React component tree.
 */
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
    const margin = 8; // viewport margin to avoid touching edges
    let width = rect.width;
    // If input is wider than viewport, clamp width to viewport with margins
    const maxViewportWidth = Math.max(0, window.innerWidth - margin * 2);
    if (width > maxViewportWidth) width = maxViewportWidth;
    // Clamp left so the dropdown stays fully within viewport
    let left = rect.left;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - margin - width);
    }
    const top = rect.bottom + 8;
    
    // Compute maxHeight to prevent negative values and ensure dropdown fits in viewport
    const remInPx = 16; // 1rem = 16px (standard default)
    const availableSpace = window.innerHeight - top - remInPx;
    const clampedAvailableSpace = Math.max(0, availableSpace);
    const maxHeight60vh = window.innerHeight * 0.6;
    const maxHeight = Math.min(clampedAvailableSpace, maxHeight60vh);
    
    setDropdownPos({ left, top, width, maxHeight });
  };

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (showSuggestions && (suggestions.subjects.length > 0 || suggestions.standards.length > 0)) {
      updateDropdownPos();
    }
  }, [showSuggestions, suggestions, query]);

  useEffect(() => {
    const onResizeOrScroll = () => {
      if (showSuggestions) updateDropdownPos();
    };
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [showSuggestions]);

  // Keep dropdown aligned when input width changes (e.g., responsive layout)
  useEffect(() => {
    if (!isClient) return;
    const el = inputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (showSuggestions) updateDropdownPos();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isClient, showSuggestions]);

  // Debounced suggestions
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
    // Close suggestions and avoid stealing focus back to the input
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  const closeSuggestions = () => {
    setSuggestions({ subjects: [], standards: [] });
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true); // Re-enable suggestions when typing
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      // If there are suggestions, select the first one
      if (suggestions.subjects.length > 0) {
        // First subject
        const firstSubject = suggestions.subjects[0];
        closeSuggestions();
        setQuery(firstSubject);
        performSearch(firstSubject);
        inputRef.current?.blur();
      } else if (suggestions.standards.length > 0) {
        // First standard
        const firstStandard = suggestions.standards[0];
        const standardNumber = firstStandard.split(' • ')[0];
        handleStandardSuggestionClick(standardNumber);
      } else {
        // No suggestions, perform regular search and close suggestions
        closeSuggestions();
        performSearch(query);
        inputRef.current?.blur();
      }
    }
  };

  const handleStandardSuggestionClick = async (standardNumber: string) => {
    closeSuggestions();
    setQuery(standardNumber);
    
    // Blur input to auto-tab out
    inputRef.current?.blur();
    
    // Perform search to get the full standard object
    try {
      setLoadingSearch(true);
      const data = await searchStandards(standardNumber);
      setSearchData(data);
      
      // If we found a direct result, auto-add it
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
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="relative z-50">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
            </div>
            <input
              ref={inputRef}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search subjects (e.g., Physics) or standards (e.g., 91577, Calculus differentiation)…"
              className="input pl-11"
              onFocus={() => setShowSuggestions(true)}
            />
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
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                <XMarkIcon className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>
          <button 
            type="submit" 
            disabled={loadingSearch}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingSearch ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Searching
              </>
            ) : (
              <>
                <MagnifyingGlassIcon className="w-4 h-4" />
                Search
              </>
            )}
          </button>
        </div>
        {loadingSuggest && query && (
          <div className="text-xs text-slate-400 mt-2 flex items-center gap-2">
            <div className="w-3 h-3 border border-slate-400 border-t-transparent rounded-full animate-spin" />
            Fetching suggestions…
          </div>
        )}
      </form>

      {error && (
        <div className="p-3 rounded-lg bg-error-500/10 border border-error-500/20 text-error-400 text-sm flex items-center gap-2">
          <XMarkIcon className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {suggestion && !relatedGroups.length && (
        <div className="text-slate-300 text-sm flex items-center gap-2">
          <span>Did you mean</span>
          <button 
            className="underline hover:text-brand-400 transition-colors" 
            onClick={() => { setQuery(suggestion.value); performSearch(suggestion.value); }}
          >
            {suggestion.value}
          </button>
          <span>?</span>
        </div>
      )}

      {relatedGroups.length > 0 && (
        <div className="space-y-4">
          {relatedGroups.map((group, idx) => (
            <div key={idx}>
              <div className="font-medium text-slate-200 mb-3 flex items-center gap-2">
                <BookOpenIcon className="w-5 h-5 text-brand-400" />
                {group.name}
                <span className="text-xs text-slate-400 font-normal">({group.standards.length} standards)</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            className="fixed z-[9999] rounded-xl border border-white/10 bg-[#161B22] text-slate-100 shadow-card overflow-y-auto"
            style={{ left: dropdownPos.left, top: dropdownPos.top, width: dropdownPos.width, maxHeight: `${dropdownPos.maxHeight}px` }}
          >
            {suggestions.subjects.length > 0 && (
              <>
                <div className="px-4 py-2 text-xs text-slate-300 bg-white/5 border-b border-white/10 flex items-center gap-2">
                  <BookOpenIcon className="w-4 h-4" />
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
                    className="w-full text-left px-4 py-3 hover:bg-white/5 font-medium transition-colors flex items-center gap-3"
                  >
                    <BookOpenIcon className="w-4 h-4 text-brand-400 flex-shrink-0" />
                    {subject}
                  </button>
                ))}
              </>
            )}
            {suggestions.standards.length > 0 && (
              <>
                {suggestions.subjects.length > 0 && (
                  <div className="px-4 py-2 text-xs text-slate-300 bg-white/5 border-b border-white/10 flex items-center gap-2">
                    <AcademicCapIcon className="w-4 h-4" />
                    Standards
                  </div>
                )}
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
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-center gap-3"
                    >
                      <AcademicCapIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span className="truncate">{standard}</span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        ) : null,
        document.body
      )}
    </div>
  );
}

/**
 * Renders a card for a single standard showing its metadata, credits, and an Add/Remove action.
 *
 * @param std - Standard data to display (subject, title, standard_number, credits, is_ue, etc.).
 * @param onAdd - Invoked with `std` when the Add button is clicked.
 * @param onRemove - Invoked with `std.standard_number` when the Remove button is clicked.
 * @param selected - When true, displays the Remove action; otherwise displays the Add action.
 * @returns The rendered standard card element.
 */
function StandardCard({ std, onAdd, onRemove, selected }: { 
  std: Standard; 
  onAdd: (s: Standard) => void; 
  onRemove: (standardNumber: number) => void;
  selected: boolean;
}) {
  return (
    <div className="card p-5 flex flex-col card-hover h-full">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {/* Standard number with icon */}
          <div className="flex items-center gap-2 mb-2">
            <AcademicCapIcon className="w-5 h-5 flex-shrink-0 text-brand-400" />
            <span className="text-lg font-semibold text-slate-100">{std.standard_number}</span>
          </div>
          {/* Standard title - clamped to 2 lines with fixed height */}
          <div className="text-sm text-slate-300 leading-relaxed line-clamp-2 mb-2 h-[2.8rem]">
            {std.title}
          </div>
          {/* Meta info */}
          <div className="text-xs text-slate-500 truncate">
            {std.subject} • {std.assessment_type} • {std.standards_type}
          </div>
        </div>
        {std.is_ue && (
          <span title="University Entrance" className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex-shrink-0 font-medium h-fit">
            UE
          </span>
        )}
      </div>
      <div className="flex items-center justify-between pt-3 mt-auto border-t border-white/5">
        <div className="text-slate-300 text-sm font-medium">{std.credits} credits</div>
        {selected ? (
          <button
            onClick={() => onRemove(std.standard_number)}
            className="px-3 py-2 rounded-lg bg-error-600 hover:bg-error-700 text-white transition-all duration-200 flex items-center gap-2 shadow-card"
          >
            <XMarkIcon className="w-4 h-4" />
            Remove
          </button>
        ) : (
          <button
            onClick={() => onAdd(std)}
            className="px-3 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-all duration-200 flex items-center gap-2 shadow-card hover:shadow-card-hover"
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        )}
      </div>
    </div>
  );
} 