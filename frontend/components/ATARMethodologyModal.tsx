'use client';

import React from 'react';
import { XMarkIcon, AcademicCapIcon, ChartBarIcon, UsersIcon, TrophyIcon } from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal component that explains the NZQA ATAR calculation methodology
 * Based on official NZQA documentation from the OIA request
 */
export function ATARMethodologyModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-[#161B22] rounded-2xl border border-white/10 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-[#161B22] border-b border-white/10 p-6 rounded-t-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-100 mb-2">How NZQA Calculates Your ATAR</h2>
                <p className="text-sm text-slate-400">Official methodology from the Australasian Conference of Tertiary Admission Centres</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                aria-label="Close modal"
              >
                <XMarkIcon className="w-6 h-6 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
            {/* Overview */}
            <div className="panel p-5 bg-brand-500/10 border-brand-500/30">
              <h3 className="text-lg font-semibold text-brand-300 mb-3 flex items-center gap-2">
                <AcademicCapIcon className="w-5 h-5" />
                What is ATAR?
              </h3>
              <p className="text-sm text-slate-300 mb-2">
                The Australian Tertiary Admission Rank (ATAR) ranks students from 99.95 to 0, with 99.95 being the top score. 
                It's a <strong>ranking system</strong>, not a test score—your ATAR depends on how you perform relative to your 
                entire age cohort (including those who left school or study under other systems).
              </p>
              <p className="text-sm text-slate-400">
                NZQA calculates ATAR scores for eligible students every January using methodology overseen by the 
                Australasian Conference of Tertiary Admission Centres (ACTAC).
              </p>
            </div>

            {/* The Process */}
            <div>
              <h3 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5 text-brand-400" />
                The Calculation Process
              </h3>
              
              <div className="space-y-4">
                {/* Step 1 */}
                <div className="panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      1
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2">Calculate Difficulty Weights</h4>
                      <p className="text-sm text-slate-400 mb-2">
                        NZQA analyzes all Level 3 standards completed by all students in the year. They calculate a 
                        <strong className="text-slate-300"> relative difficulty weight</strong> (between 0 and 1) for each standard, 
                        version, and grade combination.
                      </p>
                      <p className="text-sm text-slate-400">
                        The harder a standard is (based on how the cohort performed), the higher its weight. This uses the 
                        Johnston & Lillis statistical formula published in the New Zealand Science Review.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      2
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2">Select Your Best 90 Credits</h4>
                      <p className="text-sm text-slate-400 mb-3">
                        The system identifies your best 90 Level 3 credits with these rules:
                      </p>
                      <ul className="space-y-2 text-sm text-slate-400">
                        <li className="flex items-start gap-2">
                          <span className="text-brand-400 flex-shrink-0">•</span>
                          <span>Maximum of 24 credits per subject</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand-400 flex-shrink-0">•</span>
                          <span>If you repeated a standard, only your best result counts</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand-400 flex-shrink-0">•</span>
                          <span>Priority order: UE-approved subjects first, then non-UE subjects, then Unit Standards</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-brand-400 flex-shrink-0">•</span>
                          <span>If you have 60-89 credits, zeros are added to reach 90</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      3
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2">Calculate Your Statistical Score</h4>
                      <p className="text-sm text-slate-400 mb-2">
                        Your <strong className="text-slate-300">statistical score</strong> (also called the credit-weighted total) 
                        is calculated by taking the weighted average of your best 90 credits' difficulty weights.
                      </p>
                      <div className="p-3 bg-slate-800/40 rounded-lg font-mono text-xs text-slate-300 mb-2">
                        Statistical Score = (Sum of [credits × difficulty weight]) / 90
                      </div>
                      <p className="text-sm text-slate-400">
                        This score is what gets you ranked against everyone else in your cohort.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      4
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2">Rank Everyone & Assign ITARS Percentiles</h4>
                      <p className="text-sm text-slate-400 mb-2">
                        All eligible students are sorted by their statistical score (highest to lowest). Each student is then 
                        assigned a <strong className="text-slate-300">percentile ranking</strong>—this percentile is called 
                        your <strong className="text-slate-300">ITARS (Interstate Transfer Index Score)</strong>.
                      </p>
                      <p className="text-sm text-slate-400">
                        So ITARS is actually your percentile rank in the cohort, not the raw score itself.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="panel p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      5
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4" />
                        Calculate Participation Rate
                      </h4>
                      <p className="text-sm text-slate-400 mb-2">
                        The participation rate compares how many students from your age cohort (counted in Year 9, four years ago) 
                        completed enough Level 3 credits to be eligible for ATAR.
                      </p>
                      <div className="p-3 bg-slate-800/40 rounded-lg font-mono text-xs text-slate-300 mb-2">
                        Participation Rate = (Students with 60+ L3 credits) / (Year 9 cohort size)
                      </div>
                      <p className="text-sm text-slate-400">
                        This accounts for students who left school at 16 or studied under other systems. For example, in 2024 
                        the participation rate was around 48%.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="panel p-4 bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center flex-shrink-0 font-bold text-sm">
                      6
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-200 mb-2 flex items-center gap-2">
                        <TrophyIcon className="w-4 h-4 text-emerald-400" />
                        Assign ATAR Scores
                      </h4>
                      <p className="text-sm text-slate-400 mb-3">
                        Using the participation rate, ACTAC provides a table that maps ITARS percentiles to ATAR scores. 
                        Students are assigned ATARs from the ranked list:
                      </p>
                      <ul className="space-y-2 text-sm text-slate-400 mb-3">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 flex-shrink-0">•</span>
                          <span>Top 0.05% of the cohort get <strong className="text-emerald-300">99.95</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 flex-shrink-0">•</span>
                          <span>Next 0.05% get <strong className="text-emerald-300">99.90</strong></span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-400 flex-shrink-0">•</span>
                          <span>This continues in 0.05 increments down to 0</span>
                        </li>
                      </ul>
                      <p className="text-sm text-slate-400">
                        The percentage allocated to each ATAR adjusts based on the participation rate—at the top it's about 0.108% 
                        per ATAR (roughly 34 students in 2024), but gets smaller lower down to account for the full cohort.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Key Points */}
            <div className="panel p-5 bg-blue-500/10 border-blue-500/30">
              <h3 className="text-lg font-semibold text-blue-300 mb-3">Key Takeaways</h3>
              <ul className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span>Your ATAR is relative to everyone in your age cohort, not just NCEA students</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span>Difficulty weights change every year based on how the cohort performed</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span>Only your best 90 credits count (max 24 per subject)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span>UE-approved subjects are prioritized when selecting your best 90</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span><strong>ITARS</strong> is your percentile rank, not the raw statistical score</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 flex-shrink-0 font-bold">→</span>
                  <span>Your official ATAR is calculated by NZQA in January after Year 13</span>
                </li>
              </ul>
            </div>

            {/* Reference */}
            <div className="text-xs text-slate-500 pt-4 border-t border-white/10">
              <p className="mb-1"><strong>References:</strong></p>
              <ul className="space-y-1 ml-4">
                <li>• NZQA Official Information Act Response (2024)</li>
                <li>• Johnston, M., & Lillis, D. (2011). Statistical Modelling and analysis of NCEA and New Zealand Scholarship assessment data. New Zealand Science Review, 38(4)</li>
                <li>• Australasian Conference of Tertiary Admission Centres (ACTAC) methodology</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#161B22] border-t border-white/10 p-4 rounded-b-2xl">
            <button
              onClick={onClose}
              className="w-full btn-primary"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
