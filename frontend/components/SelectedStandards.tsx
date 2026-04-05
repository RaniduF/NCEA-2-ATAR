'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Grade, SelectedItem } from '../app/page';
import { getAvailableYears, getAvailableVersions } from '../app/services/api';

const GRADES: Grade[] = ['Excellence', 'Merit', 'Achieved', 'Not Achieved'];

interface Props {
  items: SelectedItem[];
  onRemove: (standardNumber: number) => void;
  onChangeGrade: (standardNumber: number, grade: Grade) => void;
  onChangeYear: (standardNumber: number, year_achieved: number | undefined) => void;
  onChangeVersion: (standardNumber: number, standard_version: number | undefined) => void;
}

const gradeColorMap: Record<Grade, { bg: string; text: string; border: string; active: string }> = {
  'Excellence': { bg: 'bg-[#C4962D]/10', text: 'text-[#C4962D]', border: 'border-[#C4962D]/20', active: 'bg-[#C4962D] text-white' },
  'Merit': { bg: 'bg-[#4A7A8C]/10', text: 'text-[#4A7A8C]', border: 'border-[#4A7A8C]/20', active: 'bg-[#4A7A8C] text-white' },
  'Achieved': { bg: 'bg-[#5B8A3C]/10', text: 'text-[#5B8A3C]', border: 'border-[#5B8A3C]/20', active: 'bg-[#5B8A3C] text-white' },
  'Not Achieved': { bg: 'bg-[#B33A3A]/10', text: 'text-[#B33A3A]', border: 'border-[#B33A3A]/20', active: 'bg-[#B33A3A] text-white' },
};

const gradeAccentMap: Record<Grade, string> = {
  'Excellence': 'border-l-[#C4962D]',
  'Merit': 'border-l-[#4A7A8C]',
  'Achieved': 'border-l-[#5B8A3C]',
  'Not Achieved': 'border-l-[#B33A3A]',
};

export function SelectedStandards({ items, onRemove, onChangeGrade, onChangeYear, onChangeVersion }: Props) {
  const [expandedStandards, setExpandedStandards] = useState<Set<number>>(new Set());
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());
  const [availableYearsByStandard, setAvailableYearsByStandard] = useState<Record<number, number[]>>({});
  const [availableVersionsByStandard, setAvailableVersionsByStandard] = useState<Record<number, number[]>>({});
  const [removingStandardIds, setRemovingStandardIds] = useState<Set<number>>(new Set());
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const toggleSubjectCollapse = (subject: string) => {
    setCollapsedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  const toggleExpanded = (standardNumber: number) => {
    const expanding = !expandedStandards.has(standardNumber);
    setExpandedStandards(prev => {
      const next = new Set(prev);
      if (next.has(standardNumber)) next.delete(standardNumber);
      else next.add(standardNumber);
      return next;
    });
    if (expanding) {
      if (!availableVersionsByStandard[standardNumber]) {
        getAvailableVersions(standardNumber)
          .then(versions => {
            const sorted = [...versions].sort((a, b) => b - a);
            setAvailableVersionsByStandard(prev => ({ ...prev, [standardNumber]: sorted }));
          })
          .catch(console.error);
      }
      if (!availableYearsByStandard[standardNumber]) {
        getAvailableYears(standardNumber)
          .then(years => setAvailableYearsByStandard(prev => ({ ...prev, [standardNumber]: years })))
          .catch(console.error);
      }
    }
  };

  const startRemove = (standardNumber: number) => {
    const el = itemRefs.current[standardNumber];
    setRemovingStandardIds(prev => {
      const next = new Set(prev);
      next.add(standardNumber);
      return next;
    });
    if (!el) {
      setTimeout(() => onRemove(standardNumber), 250);
      return;
    }
    const currentHeight = el.getBoundingClientRect().height;
    el.style.height = `${currentHeight}px`;
    el.style.willChange = 'height, opacity';
    el.style.transition = 'height 220ms ease-out, opacity 220ms ease-out';
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.height = '0px';
      el.style.opacity = '0';
      el.style.marginBottom = '0';
    });
    const onEnd = (e: TransitionEvent) => {
      if (e.propertyName !== 'height') return;
      el.removeEventListener('transitionend', onEnd as any);
      onRemove(standardNumber);
      setRemovingStandardIds(prev => {
        const next = new Set(prev);
        next.delete(standardNumber);
        return next;
      });
      el.style.height = '';
      el.style.willChange = '';
    };
    el.addEventListener('transitionend', onEnd as any);
  };

  const handleVersionChange = (standardNumber: number, version: string) => {
    const versionNum = Number(version);
    onChangeVersion(standardNumber, versionNum);
    getAvailableVersions(standardNumber).then(versions => {
      const sorted = [...versions].sort((a, b) => b - a);
      setAvailableYearsByStandard(prev => ({
        ...prev,
        [standardNumber]: sorted
      }));
    }).catch(console.error);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border bg-surface-elevated">
        <div className="w-14 h-14 bg-surface-card border border-border flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-2xl text-text-muted">school</span>
        </div>
        <div className="text-text-secondary text-base font-bold mb-1">Your portfolio is empty</div>
        <div className="text-text-muted text-xs max-w-xs">Use the search bar above to find and add your NCEA standards.</div>
      </div>
    );
  }

  const groupedBySubject = items.reduce((groups, item) => {
    const subject = item.standard.subject || 'Other';
    if (!groups[subject]) groups[subject] = [];
    groups[subject].push(item);
    return groups;
  }, {} as Record<string, typeof items>);

  const sortedSubjects = Object.keys(groupedBySubject).sort();

  return (
    <div className="space-y-8">
      {sortedSubjects.map(subject => {
        const isCollapsed = collapsedSubjects.has(subject);
        const standards = groupedBySubject[subject];

        return (
          <div key={subject} className="space-y-3">
            <button
              onClick={() => toggleSubjectCollapse(subject)}
              className="w-full flex items-center justify-between px-1 py-1 -ml-1 hover:bg-surface-hover transition-colors group/header"
            >
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-sm transition-transform duration-200"
                  style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                >expand_more</span>
                <span className="w-2.5 h-2.5 bg-primary"></span>
                {subject}
              </h3>
              <span className="text-[10px] text-text-muted font-medium group-hover/header:text-text-secondary transition-colors">
                {standards.length} standard{standards.length === 1 ? '' : 's'}
              </span>
            </button>

            {isCollapsed ? (
              <div className="flex flex-wrap gap-2 px-1 animate-reveal-in">
                {standards.map(item => {
                  const colors = gradeColorMap[item.grade];
                  return (
                    <div
                      key={item.standard.standard_number}
                      className={`text-[10px] font-mono px-2 py-1 border font-bold ${colors.bg} ${colors.text} ${colors.border}`}
                    >
                      {item.standard.standard_number}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 animate-reveal-in">
                {standards.map(({ standard, grade, year_achieved, standard_version }, idx) => {
                  const isExpanded = expandedStandards.has(standard.standard_number);
                  const displayYear = year_achieved || 'Iterative';
                  const availableVersions = availableVersionsByStandard[standard.standard_number] || [];
                  const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                  const displayVersion = standard_version || defaultVersion;
                  const isRemoving = removingStandardIds.has(standard.standard_number);
                  const gradeAccent = gradeAccentMap[grade];

                  return (
                    <div
                      key={standard.standard_number}
                      ref={(el) => { itemRefs.current[standard.standard_number] = el; }}
                      className={`group relative border border-border bg-surface-card transition-all duration-300 overflow-hidden border-l-4 ${gradeAccent} ${isRemoving ? 'opacity-0 pointer-events-none' : 'opacity-100'} stagger-item`}
                      style={{ '--stagger-index': idx } as React.CSSProperties}
                    >
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          {/* Standard Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-text-primary">{standard.standard_number}</span>
                              {standard.is_ue && <span className="badge-ue text-[10px] py-0 px-1.5 h-4">UE</span>}
                              {typeof displayYear === 'number' && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-surface-elevated text-text-muted border border-border font-medium">
                                  {displayYear}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-bold leading-snug text-text-primary line-clamp-1 group-hover:line-clamp-none transition-all tracking-tight">
                              {standard.title}
                            </div>
                            <div className="text-[10px] text-text-muted mt-1 font-medium">
                              {standard.credits} credits · {standard.assessment_type}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-3 self-end sm:self-center w-full sm:w-auto justify-between sm:justify-end">
                            {/* Grade Control */}
                            <div className="flex border border-border bg-surface-base">
                              {(standard.standards_type === 'Unit' ? (['N', 'A'] as const) : (['N', 'A', 'M', 'E'] as const)).map((g) => {
                                const fullGrade: Grade = g === 'E' ? 'Excellence' : g === 'M' ? 'Merit' : g === 'A' ? 'Achieved' : 'Not Achieved';
                                const isSelected = grade === fullGrade;
                                const colors = gradeColorMap[fullGrade];

                                return (
                                  <button
                                    key={g}
                                    onClick={() => onChangeGrade(standard.standard_number, fullGrade)}
                                    className={`w-9 h-8 text-xs font-bold transition-all duration-200 ${isSelected ? colors.active : 'text-text-muted hover:text-text-secondary hover:bg-surface-hover'}`}
                                    title={fullGrade}
                                  >
                                    {g}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="flex items-center border-l border-border pl-3 gap-1">
                              <button
                                onClick={() => toggleExpanded(standard.standard_number)}
                                className={`p-1.5 transition-colors ${isExpanded ? 'bg-surface-hover text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'}`}
                              >
                                <span className="material-symbols-outlined text-lg">more_horiz</span>
                              </button>
                              <button
                                onClick={() => startRemove(standard.standard_number)}
                                className="p-1.5 text-text-muted hover:text-error-500 hover:bg-error-50 transition-colors"
                              >
                                <span className="material-symbols-outlined text-lg">close</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Options */}
                        <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-border' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-xs">description</span>
                                  Version
                                </label>
                                <select
                                  value={displayVersion}
                                  onChange={e => {
                                    const selectedVersion = Number(e.target.value);
                                    if (selectedVersion === defaultVersion) {
                                      onChangeVersion(standard.standard_number, undefined);
                                    } else {
                                      handleVersionChange(standard.standard_number, e.target.value);
                                    }
                                  }}
                                  className="input text-xs py-2 h-9"
                                >
                                  {(availableVersionsByStandard[standard.standard_number] || []).map((version: number) => (
                                    <option key={version} value={version}>Version {version}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-muted flex items-center gap-1.5 uppercase tracking-wider">
                                  <span className="material-symbols-outlined text-xs">calendar_today</span>
                                  Year achieved
                                </label>
                                <select
                                  value={displayYear}
                                  onChange={e => {
                                    const value = e.target.value;
                                    if (value === 'Iterative') {
                                      onChangeYear(standard.standard_number, undefined);
                                    } else {
                                      onChangeYear(standard.standard_number, Number(value));
                                    }
                                  }}
                                  className="input text-xs py-2 h-9"
                                >
                                  <option value="Iterative">Iterative (Default)</option>
                                  {(availableYearsByStandard[standard.standard_number] || []).map((year: number) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}