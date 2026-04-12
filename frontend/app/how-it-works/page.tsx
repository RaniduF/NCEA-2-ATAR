import React from 'react';

export const metadata = {
  title: 'How It Works | NCEA to ATAR',
  description: 'Learn the official process of how NZQA converts NCEA Level 3 results into an ATAR, including eligibility, credit selection, difficulty weights, and ranking.',
};

export default function HowItWorksPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 animate-fade-in">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-4">How the NCEA to ATAR Conversion Works</h1>
        <p className="text-text-secondary text-lg">Understanding the process behind estimating your Australian Tertiary Admission Rank from your NCEA Level 3 results.</p>
      </div>

      <div className="space-y-8 mb-16">
        {/* Steps */}
        <div className="bg-surface-card rounded-xl p-8 border border-border shadow-sm">
          <h2 className="text-2xl font-bold text-text-primary mb-8 flex items-center gap-3">
             <span className="material-symbols-outlined text-primary">account_tree</span>
             The Conversion Process
          </h2>
          <div className="space-y-8">
            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">1</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Who is eligible?</h3>
                <p className="text-text-secondary leading-relaxed">
                  To receive an ATAR, you need at least 60 assessed NCEA Level 3 credits from completed academic years. Students with fewer than 60 credits do not receive an ATAR.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">2</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Your best 90 credits are selected</h3>
                <p className="text-text-secondary leading-relaxed">
                  NZQA picks your best 90 credits (up to 24 from any single subject) across all your Level 3 results, even from previous years. Results are chosen in priority order: i. UE-approved subjects, ii. Other achievement standards, iii. Unit standards.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">3</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Each standard is given a "difficulty weight"</h3>
                <p className="text-text-secondary leading-relaxed">
                  Every standard (and every grade within it) is assigned a relative difficulty score between 0 and 1. The weight is calculated statistically from how all students performed that year. If fewer students received an Excellence in a given standard, that Excellence result carries a higher difficulty weight. Externally assessed standards typically have higher difficulty weights than internally assessed standards.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">4</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Your Statistical Value</h3>
                <p className="text-text-secondary leading-relaxed">
                  We then take the average of your best 90 credits multiplied with their corresponding difficulty weight to produce your Statistical Value.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">5</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">All eligible students are ranked against each other</h3>
                <p className="text-text-secondary leading-relaxed">
                  From your statistical value you are ranked against your peers. Everyone's Statistical value is ranked from highest to lowest. Your ATAR depends on where you sit in this ranked list, not just on your own results, but on how everyone else performed too.
                </p>
              </div>
            </div>

            <div className="flex gap-5">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">6</div>
              <div>
                <h3 className="text-lg font-bold text-text-primary mb-2">Your ATAR is assigned</h3>
                <p className="text-text-secondary leading-relaxed">
                  The top 0.05% of the cohort is assigned an ATAR of 99.95 and then the next 0.05% get an ATAR of 99.90 and then so on and so forth all the way down to 0.00 in steps of 0.05.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Common Questions */}
        <div className="bg-surface-card rounded-xl p-8 border border-border shadow-sm mt-8">
          <h2 className="text-2xl font-bold text-text-primary mb-6 flex items-center gap-3">
             <span className="material-symbols-outlined text-primary">help</span>
             Common Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Can results from previous years help my ATAR?</h3>
              <p className="text-text-secondary leading-relaxed">
                Yes, but only if they are from Level 3. The ATAR does not use any results from Level 1 or 2. Only Level 3 results from the last 2 years will count to the ATAR. If you resit a standard, only your best result counts. The difficulty weight used is from the year you achieved that result.
              </p>
            </div>
            
            <hr className="border-border/50" />

            <div>
              <h3 className="text-lg font-bold text-text-primary mb-2">Will 90 Excellence credits guarantee 99.95?</h3>
              <p className="text-text-secondary leading-relaxed">
                Not necessarily. The difficulty weights of each standard also matters, 90 Excellences in lower-weighted standards may score less than a mix between 90 Merits and Excellences in very highly-weighted standards.
              </p>
            </div>

            <hr className="border-border/50" />

            <div>
              <h3 className="text-lg font-bold text-text-primary mb-2">When does NZQA release official conversions?</h3>
              <p className="text-text-secondary leading-relaxed">
                NZQA now releases ATARs along side NCEA results in mid to late January. Keep in mind it is likely that NCEA students will miss round 1 offers and some high in demand courses will fill up if the University doesn't explicitly reserve seats for NCEA students or for round 2 offers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
