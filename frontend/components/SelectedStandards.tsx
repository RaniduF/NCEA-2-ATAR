'use client';

import React, { useState, useEffect } from 'react';
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

  const toggleExpanded = async (standardNumber: number) => {
    setExpandedStandards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(standardNumber)) {
        newSet.delete(standardNumber);
      } else {
        newSet.add(standardNumber);
        // Load available versions and years for this standard if not already loaded
        if (!availableVersionsByStandard[standardNumber]) {
          getAvailableVersions(standardNumber).then(versions => {
            setAvailableVersionsByStandard(prev => ({
              ...prev,
              [standardNumber]: versions
            }));
            // Don't auto-set version - let it remain undefined to use latest by default
          }).catch(console.error);
        }
        if (!availableYearsByStandard[standardNumber]) {
          getAvailableYears(standardNumber).then(years => {
            setAvailableYearsByStandard(prev => ({
              ...prev,
              [standardNumber]: years
            }));
          }).catch(console.error);
        }
      }
      return newSet;
    });
  };

  const handleVersionChange = (standardNumber: number, version: string) => {
    const versionNum = parseInt(version);
    onChangeVersion(standardNumber, versionNum);
    // Reload available years for this specific version
    getAvailableYears(standardNumber, versionNum).then(years => {
      setAvailableYearsByStandard(prev => ({
        ...prev,
        [standardNumber]: years
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
      case 'Excellence': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'Merit': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Achieved': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Not Achieved': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="space-y-6">
      {sortedSubjects.map(subject => (
        <div key={subject} className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200 border-b border-white/10 pb-3 flex items-center gap-3">
            <AcademicCapIcon className="w-6 h-6 text-brand-400" />
            <span>{subject}</span>
            <span className="text-sm text-slate-400 font-normal bg-slate-800/50 px-2 py-1 rounded-full">
              {groupedBySubject[subject].length} standard{groupedBySubject[subject].length === 1 ? '' : 's'}
            </span>
          </h3>
          {groupedBySubject[subject].map(({ standard, grade, year_achieved, standard_version }) => {
            const isExpanded = expandedStandards.has(standard.standard_number);
            const displayYear = year_achieved || 'Iterative';
            const availableVersions = availableVersionsByStandard[standard.standard_number] || [];
            const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1; // Latest version (first in desc order)
            const displayVersion = standard_version || defaultVersion;
            
            return (
              <div key={standard.standard_number} className="card card-hover p-5 hover:bg-slate-900/80 transition-transform duration-200 will-change-transform">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-400 flex items-center gap-2 mb-2">
                      <AcademicCapIcon className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{standard.subject} • {standard.assessment_type} • {standard.standards_type}</span>
                    </div>
                    <div className="font-semibold text-slate-100 leading-tight mb-2">{standard.standard_number}: {standard.title}</div>
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
                      onClick={() => onRemove(standard.standard_number)} 
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
                            const selectedVersion = parseInt(e.target.value);
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
                              onChangeYear(standard.standard_number, parseInt(value));
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