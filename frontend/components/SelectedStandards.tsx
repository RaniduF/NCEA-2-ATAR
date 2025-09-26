'use client';

import React, { useState, useEffect, useRef } from 'react';
import type { Grade, SelectedItem } from '../app/page';
import { getAvailableYears, getAvailableVersions } from '../app/services/api';
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  Cog6ToothIcon,
  XMarkIcon,
  AcademicCapIcon,
  CalendarDaysIcon,
  DocumentTextIcon
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

  const startRemove = (standardNumber: number) => {
    const el = itemRefs.current[standardNumber];
    // Mark as removing to trigger opacity/transform transition
    setRemovingStandardIds(prev => {
      const next = new Set(prev);
      next.add(standardNumber);
      return next;
    });
    if (!el) {
      // Fallback if ref missing
      setTimeout(() => onRemove(standardNumber), 250);
      return;
    }
    // Apply custom remove animation class
    el.classList.add('animate-remove-card');
    // Prepare height collapse
    const currentHeight = el.getBoundingClientRect().height;
    el.style.height = `${currentHeight}px`;
    el.style.willChange = 'height, opacity, transform, filter';
    // Force reflow then collapse to 0 height
    void el.offsetHeight;
    requestAnimationFrame(() => {
      el.style.height = '0px';
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
      // Cleanup inline styles
      el.style.height = '';
      el.style.willChange = '';
      el.classList.remove('animate-remove-card');
    };
    el.addEventListener('transitionend', onEnd as any);
  };

  const handleVersionChange = (standardNumber: number, version: string) => {
    const versionNum = Number(version);
    onChangeVersion(standardNumber, versionNum);
    // Reload available years for this specific version
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
      <div className="text-center py-12">
        <AcademicCapIcon className="w-12 h-12 text-slate-400 mx-auto mb-4" />
        <div className="text-slate-400 text-lg font-medium mb-2">No standards selected yet</div>
        <div className="text-slate-500 text-sm">Search and add standards above to build your NCEA portfolio</div>
      </div>
    );
  }

  // Group standards by subject
  const groupedBySubject = items.reduce((groups, item) => {
    const subject = item.standard.subject || 'Other';
    if (!groups[subject]) {
      groups[subject] = [];
    }
    groups[subject].push(item);
    return groups;
  }, {} as Record<string, typeof items>);

  // Sort subjects alphabetically
  const sortedSubjects = Object.keys(groupedBySubject).sort();

  // Helper function to get grade color
  const getGradeColor = (grade: Grade) => {
    switch (grade) {
      case 'Excellence': return 'text-amber-300 border-amber-300/30';
      case 'Merit': return 'text-sky-300 border-sky-300/30';
      case 'Achieved': return 'text-emerald-300 border-emerald-300/30';
      case 'Not Achieved': return 'text-red-300 border-red-300/30';
      default: return 'text-slate-300 border-slate-300/30';
    }
  };

  return (
    <div className="space-y-8">
      {sortedSubjects.map(subject => (
        <div key={subject} className="space-y-4 md:space-y-5">
          <h3 className="text-xl md:text-2xl font-semibold text-slate-200 border-b border-white/10 pb-3 flex items-center gap-3">
            <AcademicCapIcon className="w-6 h-6 text-brand-400" />
            <span>{subject}</span>
            <span className="meta bg-slate-800/50 px-2 py-1 rounded-full">
              {groupedBySubject[subject].length} standard{groupedBySubject[subject].length === 1 ? '' : 's'}
            </span>
          </h3>
          {groupedBySubject[subject].map(({ standard, grade, year_achieved, standard_version }) => {
            const isExpanded = expandedStandards.has(standard.standard_number);
            const displayYear = year_achieved || 'Iterative';
            const availableVersions = availableVersionsByStandard[standard.standard_number] || [];
            const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1; // Latest version (first in desc order)
            const displayVersion = standard_version || defaultVersion;
            const isRemoving = removingStandardIds.has(standard.standard_number);
            
            return (
              <div
                key={standard.standard_number}
                ref={(el) => { itemRefs.current[standard.standard_number] = el; }}
                className={`card card-hover p-6 transition-all duration-200 will-change-transform hover-scale collapse-height ${isRemoving ? 'origin-top pointer-events-none' : 'animate-fade-down'}`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="meta flex items-center gap-2 mb-2">
                      <AcademicCapIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{standard.subject} • {standard.assessment_type} • {standard.standards_type}</span>
                    </div>
                    <div className="font-medium text-slate-100 leading-tight mb-2">{standard.standard_number}: {standard.title}</div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-slate-300 font-medium">{standard.credits} credits</div>
                      {standard.is_ue && (
                        <span title="University Entrance" className="badge-ue">UE</span>
                      )}
                    </div>
                    {typeof displayYear === 'number' && (
                      <div className="text-xs text-amber-400 mt-2 flex items-center gap-1">
                        <CalendarDaysIcon className="w-3 h-3" />
                        Taken in {displayYear}
                      </div>
                    )}
                    {standard_version && standard_version !== defaultVersion && (
                      <div className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                        <DocumentTextIcon className="w-3 h-3" />
                        Version {displayVersion}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-slate-300 font-medium">Grade</label>
                      <div className="relative">
                        <select
                          value={grade}
                          onChange={e => onChangeGrade(standard.standard_number, e.target.value as Grade)}
                          className={`input text-sm font-medium ${getGradeColor(grade)}`}
                        >
                          {GRADES.map(g => <option key={g} value={g} className="bg-slate-800 text-slate-200">{g}</option>)}
                        </select>
                      </div>
                    </div>
                    <button 
                      onClick={() => toggleExpanded(standard.standard_number)}
                      className="btn-ghost"
                      title="Advanced options"
                    >
                      {isExpanded ? (
                        <ChevronDownIcon className="w-4 h-4" />
                      ) : (
                        <Cog6ToothIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button 
                      onClick={() => startRemove(standard.standard_number)} 
                      className="ripple btn-danger"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="border-t border-white/10 pt-4 space-y-4 animate-reveal-in">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm text-slate-300 font-medium flex items-center gap-2">
                          <DocumentTextIcon className="w-4 h-4" />
                          Standard Version
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
                          className="input text-sm"
                        >
                          {(availableVersionsByStandard[standard.standard_number] || []).map((version: number) => (
                            <option key={version} value={version} className="bg-slate-800">Version {version}</option>
                          ))}
                        </select>
                        <div className="text-xs text-slate-400">
                          Different versions may have varying statistical weightings
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm text-slate-300 font-medium flex items-center gap-2">
                          <CalendarDaysIcon className="w-4 h-4" />
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
                          className="input text-sm"
                        >
                          <option value="Iterative" className="bg-slate-800">Iterative (Default)</option>
                          {(availableYearsByStandard[standard.standard_number] || []).map((year: number) => (
                            <option key={year} value={year} className="bg-slate-800">{year}</option>
                          ))}
                        </select>
                        <div className="text-xs text-slate-400">
                          Used for cross-year weight calculation accuracy
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
} 