'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getSuggestions, searchStandards, type Standard, type StandardsSearchResponse } from '../app/services/api';

interface Props {
  onAdd: (standard: Standard) => void;
  selectedStandardIds: Set<number>;
}

export function SearchStandards({ onAdd, selectedStandardIds }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchData, setSearchData] = useState<StandardsSearchResponse | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced suggestions
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setLoadingSuggest(true);
        const s = await getSuggestions(query.trim());
        setSuggestions(s);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingSuggest(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

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
    performSearch(query);
  };

  const addStandard = (standard: Standard) => {
    onAdd(standard);
    // Keep input and results intact to allow multiple selection
    inputRef.current?.focus();
  };

  const directResults = searchData?.direct_results ?? [];
  const relatedGroups = searchData?.related_groups ?? [];
  const suggestion = searchData?.suggestion ?? null;

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="relative">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search subjects (e.g., Physics) or standards (e.g., 91577, Calculus differentiation)…"
              className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-white/10 placeholder:text-slate-400 focus:ring-2 focus:ring-brand-600 outline-none"
            />
            {suggestions.length > 0 && (
              <div className="absolute mt-1 w-full rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur shadow-xl overflow-hidden z-10">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setQuery(s);
                      performSearch(s);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-white/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10">
            {loadingSearch ? 'Searching…' : 'Search'}
          </button>
        </div>
        {loadingSuggest && query && (
          <div className="text-xs text-slate-400 mt-1">Fetching suggestions…</div>
        )}
      </form>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {suggestion && !directResults.length && !relatedGroups.length && (
        <div className="text-slate-300 text-sm">Did you mean <button className="underline" onClick={() => { setQuery(suggestion.value); performSearch(suggestion.value); }}>{suggestion.value}</button>?</div>
      )}

      {(directResults.length > 0 || relatedGroups.length > 0) && (
        <div className="space-y-6">
          {directResults.length > 0 && (
            <div>
              <div className="text-slate-300 text-sm mb-2">Direct match</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {directResults.map(std => (
                  <StandardCard key={std.standard_number} std={std} onAdd={addStandard} selected={selectedStandardIds.has(std.standard_number)} />
                ))}
              </div>
            </div>
          )}

          {relatedGroups.length > 0 && (
            <div className="space-y-3">
              {relatedGroups.map((group, idx) => (
                <div key={idx}>
                  <div className="font-medium text-slate-200 mb-2">{group.name}</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.standards.map(std => (
                      <StandardCard key={std.standard_number} std={std} onAdd={addStandard} selected={selectedStandardIds.has(std.standard_number)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StandardCard({ std, onAdd, selected }: { std: Standard; onAdd: (s: Standard) => void; selected: boolean }) {
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-400">{std.subject} • {std.assessment_type} • {std.standards_type}</div>
          <div className="font-semibold">{std.standard_number}: {std.title}</div>
        </div>
        {std.is_ue && <span title="University Entrance" className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">UE</span>}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-slate-300 text-sm">{std.credits} credits</div>
        <button
          onClick={() => onAdd(std)}
          disabled={selected}
          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selected ? 'Added' : 'Add'}
        </button>
      </div>
    </div>
  );
} 