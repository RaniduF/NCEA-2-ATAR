'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Grade, SelectedItem } from '../app/page';
import { getAvailableYears, getAvailableVersions } from '../app/services/api';
import {
  ChevronDownIcon,
  XMarkIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  EllipsisHorizontalIcon
} from '@heroicons/react/24/outline';

const GRADES: Grade[] = ['Excellence', 'Merit', 'Achieved', 'Not Achieved'];

interface Props {
  items: SelectedItem[];
  onRemove: (standardNumber: number) => void;
  onChangeGrade: (standardNumber: number, grade: Grade) => void;
  onChangeYear: (standardNumber: number, year_achieved: number | undefined) => void;
  onChangeVersion: (standardNumber: number, standard_version: number | undefined) => void;
}

export function SelectedStandards({ items, onRemove, onChangeGrade, onChangeYear, onChangeVersion }: Props) {
  const [expandedStandards, setExpandedStandards] = useState<Set<number>>(new Set());
  const [collapsedSubjects, setCollapsedSubjects] = useState<Set<string>>(new Set());
  const [availableYearsByStandard, setAvailableYearsByStandard] = useState<Record<number, number[]>>({});
  const [availableVersionsByStandard, setAvailableVersionsByStandard] = useState<Record<number, number[]>>({});
  const [removingStandardIds, setRemovingStandardIds] = useState<Set<number>>(new Set());
  const itemRefs = useRef<Record<number, HTMLDivElement | null>>({});

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

  const toggleSubject = (subject: string) => {
    setCollapsedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
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
    el.classList.add('animate-remove-card');
    const currentHeight = el.getBoundingClientRect().height;
    el.style.height = `${currentHeight}px`;
    el.style.willChange = 'height, opacity, transform, filter';
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
      el.classList.remove('animate-remove-card');
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
      <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/[0.02]">
        <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
          <AcademicCapIcon className="w-8 h-8 text-slate-500" />
        </div>
        <div className="text-slate-300 text-lg font-medium mb-1">Your portfolio is empty</div>
        <div className="text-slate-500 text-sm max-w-xs">Use the search bar above to find and add your NCEA standards.</div>
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
        return (
          <div key={subject} className="space-y-3">
            <button
              onClick={() => toggleSubject(subject)}
              className="w-full flex items-center justify-between px-1 group"
            >
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2 group-hover:text-slate-300 transition-colors">
                <ChevronDownIcon className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`} />
                <span className="w-2 h-2 rounded-full bg-brand-500"></span>
                {subject}
              </h3>
              <span className="text-xs text-slate-500 font-medium group-hover:text-slate-400 transition-colors">
                {groupedBySubject[subject].length} standard{groupedBySubject[subject].length === 1 ? '' : 's'}
              </span>
            </button>

            <div className={`space-y-2 transition-all duration-300 ease-in-out overflow-hidden p-1 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[5000px] opacity-100'}`}>
              {groupedBySubject[subject].map(({ standard, grade, year_achieved, standard_version }) => {
                const isExpanded = expandedStandards.has(standard.standard_number);
                const displayYear = year_achieved || 'Iterative';
                const availableVersions = availableVersionsByStandard[standard.standard_number] || [];
                const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                const displayVersion = standard_version || defaultVersion;
                const isRemoving = removingStandardIds.has(standard.standard_number);

                const gradeStyles =
                  grade === 'Excellence' ? { text: 'text-amber-400', shadow: 'shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]' } :
                    grade === 'Merit' ? { text: 'text-sky-400', shadow: '' } :
                      grade === 'Achieved' ? { text: 'text-emerald-400', shadow: '' } :
                        { text: 'text-red-400', shadow: '' };

                return (
                  <div
                    key={standard.standard_number}
                    ref={(el) => { itemRefs.current[standard.standard_number] = el; }}
                    className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${isRemoving ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'} border-white/5 hover:border-brand-500/30 ${gradeStyles.shadow} bg-slate-900/40 hover:bg-slate-800/60 hover:shadow-lg hover:-translate-y-0.5`}
                  >
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Standard Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`font-mono font-bold ${gradeStyles.text}`}>{standard.standard_number}</span>
                            {standard.is_ue && <span className="badge-ue text-[10px] py-0 px-1.5 h-4">UE</span>}
                            {typeof displayYear === 'number' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/5">
                                {displayYear}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium leading-snug text-white line-clamp-1 group-hover:line-clamp-none transition-all">
                            {standard.title}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {standard.credits} Credits • {standard.assessment_type}
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex items-center gap-3 self-end sm:self-center w-full sm:w-auto justify-between sm:justify-end">
                          {/* Segmented Grade Control */}
                          <div className="flex p-1 rounded-lg bg-slate-950/40 border border-white/5 backdrop-blur-sm">
                            {['E', 'M', 'A', 'N'].map((g) => {
                              const fullGrade = g === 'E' ? 'Excellence' : g === 'M' ? 'Merit' : g === 'A' ? 'Achieved' : 'Not Achieved';
                              const isSelected = grade === fullGrade;
                              const activeClass =
                                g === 'E' ? 'bg-amber-500 text-amber-950 shadow-lg shadow-amber-500/20' :
                                  g === 'M' ? 'bg-sky-500 text-sky-950 shadow-lg shadow-sky-500/20' :
                                    g === 'A' ? 'bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/20' :
                                      'bg-red-500 text-red-950 shadow-lg shadow-red-500/20';

                              return (
                                <button
                                  key={g}
                                  onClick={() => onChangeGrade(standard.standard_number, fullGrade as Grade)}
                                  className={`w-8 h-7 rounded-md text-xs font-bold transition-all duration-200 ${isSelected ? activeClass : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'}`}
                                  title={fullGrade}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex items-center border-l border-white/10 pl-3 gap-1">
                            <button
                              onClick={() => toggleExpanded(standard.standard_number)}
                              className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                            >
                              <EllipsisHorizontalIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => startRemove(standard.standard_number)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <XMarkIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Options */}
                      <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100 mt-4 pt-4 border-t border-white/5' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                <DocumentTextIcon className="w-3.5 h-3.5" />
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
                                className="input text-xs py-2 h-9 bg-slate-900/50"
                              >
                                {(availableVersionsByStandard[standard.standard_number] || []).map((version: number) => (
                                  <option key={version} value={version} className="bg-slate-900">Version {version}</option>
                                ))}
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                                <CalendarDaysIcon className="w-3.5 h-3.5" />
                                Year Achieved
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
                                className="input text-xs py-2 h-9 bg-slate-900/50"
                              >
                                <option value="Iterative" className="bg-slate-900">Iterative (Default)</option>
                                {(availableYearsByStandard[standard.standard_number] || []).map((year: number) => (
                                  <option key={year} value={year} className="bg-slate-900">{year}</option>
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
          </div>
        );
      })}
    </div>
  );
}