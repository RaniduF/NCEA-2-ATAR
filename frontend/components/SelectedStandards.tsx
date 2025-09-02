'use client';

import React, { useState, useEffect } from 'react';
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
    return <div className="text-slate-400">No standards selected yet.</div>;
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

  return (
    <div className="space-y-6">
      {sortedSubjects.map(subject => (
        <div key={subject} className="space-y-3">
          <h3 className="text-lg font-medium text-slate-200 border-b border-white/10 pb-2">
            {subject}
            <span className="text-sm text-slate-400 ml-2 font-normal">
              ({groupedBySubject[subject].length} standard{groupedBySubject[subject].length === 1 ? '' : 's'})
            </span>
          </h3>
          {groupedBySubject[subject].map(({ standard, grade, year_achieved, standard_version }) => {
        const isExpanded = expandedStandards.has(standard.standard_number);
        const displayYear = year_achieved || 'Iterative';
        const availableVersions = availableVersionsByStandard[standard.standard_number] || [];
        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1; // Latest version (first in desc order)
        const displayVersion = standard_version || defaultVersion;
        
        return (
          <div key={standard.standard_number} className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0 pr-4">
                <div className="text-sm text-slate-400">{standard.subject} • {standard.assessment_type} • {standard.standards_type}</div>
                <div className="font-medium break-words">{standard.standard_number}: {standard.title}</div>
                <div className="text-sm text-slate-300 mt-1">{standard.credits} credits</div>
                {typeof displayYear === 'number' && (
                  <div className="text-xs text-amber-400 mt-1">Taken in {displayYear}</div>
                )}
                {standard_version && standard_version !== defaultVersion && (
                  <div className="text-xs text-blue-400 mt-1">Version {displayVersion}</div>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <label className="text-sm text-slate-300">Grade</label>
                <select
                  value={grade}
                  onChange={e => onChangeGrade(standard.standard_number, e.target.value as Grade)}
                  className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10"
                >
                  {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <button 
                  onClick={() => toggleExpanded(standard.standard_number)}
                  className="px-2 py-1 text-xs rounded bg-slate-700 border border-white/10 hover:bg-slate-600 text-slate-300"
                  title="Advanced options"
                >
                  {isExpanded ? '▼' : '⚙️'}
                </button>
                <button onClick={() => onRemove(standard.standard_number)} className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">
                  Remove
                </button>
              </div>
            </div>
            
            {isExpanded && (
              <div className="border-t border-white/10 pt-3 mt-2 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <label className="text-slate-300 min-w-0">Version:</label>
                  <select
                    value={displayVersion}
                    onChange={e => {
                      const selectedVersion = parseInt(e.target.value);
                      // Only call onChangeVersion if it's different from the default latest version
                      if (selectedVersion === defaultVersion) {
                        onChangeVersion(standard.standard_number, undefined); // Clear explicit version
                      } else {
                        handleVersionChange(standard.standard_number, e.target.value);
                      }
                    }}
                    className="px-2 py-1 rounded bg-slate-800 border border-white/10 text-sm"
                  >
                    {(availableVersionsByStandard[standard.standard_number] || []).map((version: number) => (
                      <option key={version} value={version}>Version {version}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    (standard version)
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <label className="text-slate-300 min-w-0">Year achieved:</label>
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
                    className="px-2 py-1 rounded bg-slate-800 border border-white/10 text-sm"
                  >
                    <option value="Iterative">Iterative (Default)</option>
                    {(availableYearsByStandard[standard.standard_number] || []).map((year: number) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-400">
                    (for cross-year weight calculation)
                  </span>
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