'use client';

import React from 'react';
import type { Grade, SelectedItem } from '../app/page';

const GRADES: Grade[] = ['Excellence', 'Merit', 'Achieved', 'Not Achieved'];

interface Props {
  items: SelectedItem[];
  onRemove: (standardNumber: number) => void;
  onChangeGrade: (standardNumber: number, grade: Grade) => void;
}

export function SelectedStandards({ items, onRemove, onChangeGrade }: Props) {
  if (items.length === 0) {
    return <div className="text-slate-400">No standards selected yet.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map(({ standard, grade }) => (
        <div key={standard.standard_number} className="rounded-xl border border-white/10 bg-slate-900/60 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm text-slate-400">{standard.subject} • {standard.assessment_type} • {standard.standards_type}</div>
              <div className="font-medium">{standard.standard_number}: {standard.title}</div>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300">Grade</label>
              <select
                value={grade}
                onChange={e => onChangeGrade(standard.standard_number, e.target.value as Grade)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-white/10"
              >
                {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={() => onRemove(standard.standard_number)} className="px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5">
                Remove
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
} 