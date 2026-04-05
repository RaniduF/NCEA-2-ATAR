'use client';

import React from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ATARMethodologyModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center z-[100] animate-reveal-in overflow-y-auto py-4">
      <div className="bg-surface-card border border-border shadow-modal w-full max-w-3xl my-4 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="bg-surface-elevated border-b border-border">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary flex items-center justify-center text-text-inverse">
                <span className="material-symbols-outlined text-xl">science</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">How we calculate your ATAR</h2>
                <p className="text-text-muted text-xs mt-0.5">Our methodology explained</p>
              </div>
            </div>
            <button onClick={onClose} className="btn-ghost hover:bg-error-50 hover:text-error-500 hover:border-error-200" title="Close">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-text-inverse font-bold text-sm flex-shrink-0">1</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-primary mb-2">Standard weighting</h3>
              <p className="text-text-secondary text-sm mb-3">
                Each NCEA Level 3 standard is assigned a weight based on its historical correlation with ATAR performance.
                Standards with higher correlation to university success receive greater weight.
              </p>
              <div className="bg-surface-base border border-border p-3">
                <code className="text-xs text-primary font-mono">
                  contribution = credits × weight × grade_multiplier
                </code>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-text-inverse font-bold text-sm flex-shrink-0">2</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-primary mb-2">Grade multipliers</h3>
              <p className="text-text-secondary text-sm mb-3">
                Your grade in each standard affects how much it contributes to your overall score:
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-[#C4962D]/10 border border-[#C4962D]/20 p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#C4962D]">Excellence</span>
                  <span className="text-sm font-bold text-[#C4962D] font-mono">×1.0</span>
                </div>
                <div className="bg-[#4A7A8C]/10 border border-[#4A7A8C]/20 p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#4A7A8C]">Merit</span>
                  <span className="text-sm font-bold text-[#4A7A8C] font-mono">×0.6</span>
                </div>
                <div className="bg-[#5B8A3C]/10 border border-[#5B8A3C]/20 p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#5B8A3C]">Achieved</span>
                  <span className="text-sm font-bold text-[#5B8A3C] font-mono">×0.25</span>
                </div>
                <div className="bg-[#B33A3A]/10 border border-[#B33A3A]/20 p-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-[#B33A3A]">Not Achieved</span>
                  <span className="text-sm font-bold text-[#B33A3A] font-mono">×0.0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-text-inverse font-bold text-sm flex-shrink-0">3</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-primary mb-2">Best 90 credits</h3>
              <p className="text-text-secondary text-sm mb-3">
                We select your best-performing 90 credits (capped at 24 credits per subject) to maximise your calculated score.
                This mirrors how the actual ATAR is computed with a best-subset approach.
              </p>
              <div className="bg-surface-base border border-border p-3">
                <code className="text-xs text-primary font-mono">
                  statistical_value = Σ(best_90_contributions) / total_credits_used
                </code>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-primary flex items-center justify-center text-text-inverse font-bold text-sm flex-shrink-0">4</div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-text-primary mb-2">Statistical distribution</h3>
              <p className="text-text-secondary text-sm">
                Your statistical value is mapped to a percentile rank using historical distribution data of all students.
                This percentile rank is then converted to an ATAR on a 0–99.95 scale. Results are provided for multiple years
                to show how weighting changes over time affect your estimated rank.
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="bg-warning-50 border border-warning-200 p-4">
            <h4 className="font-bold text-grade-excellence mb-2 flex items-center gap-2 text-xs">
              <span className="material-symbols-outlined text-lg">warning</span>
              Important disclaimer
            </h4>
            <p className="text-text-secondary text-xs leading-relaxed">
              This is an <strong>estimate only</strong> and should not be taken as an official ATAR calculation.
              Actual ATAR calculations may use different methodologies, additional data, and up-to-date weighting tables
              that differ from those used here.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-surface-elevated border-t border-border flex justify-end">
          <button onClick={onClose} className="btn-primary px-6">I understand</button>
        </div>
      </div>
    </div>
  );
}
