import React from 'react';
import StepsWithExample from '../../components/StepsWithExample';

export const metadata = {
  title: 'How It Works | NCEA to ATAR',
  description: 'Learn the official process of how NZQA converts NCEA Level 3 results into an ATAR, including eligibility, credit selection, difficulty weights, and ranking.',
};


const questions = [
  {
    q: 'Can results from previous years count?',
    a: "Yes, as long as they're Level 3. Level 1 and 2 results never count. If you resat a standard, only the best attempt is used, weighted using the year you sat it.",
  },
  {
    q: 'Will 90 Excellence credits guarantee 99.95?',
    a: 'No. Two reasons. First, weights matter. 90 Excellences in lightly-weighted standards can score lower than a mix of Excellences and Merits in heavily-weighted ones. Second, only about 32 students fit in the top 99.95 band each year, so even a perfect-looking profile can be ranked just outside it.',
  },
  {
    q: 'When does NZQA release ATARs?',
    a: 'ATARs are released alongside NCEA results in mid-to-late January. This is after most Australian round 1 offers have closed, so unless a university explicitly reserves seats for NCEA students, you may need to apply for round 2 or later.',
  },
];

export default function HowItWorksPage() {
  return (
    <div className="py-8 md:py-12">

      {/* Page header */}
      <div className="mb-10">
        <div className="w-8 h-0.5 bg-primary mb-6" />
        <h1
          className="font-bold text-text-primary tracking-[-0.03em] mb-5"
          style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: '1.08' }}
        >
          How your <span className="text-primary">ATAR</span> is calculated
        </h1>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          NZQA converts NCEA Level 3 results into an ATAR in six steps. Each step below follows Jane Doe&apos;s numbers through the full process, so you can see exactly where every value comes from.
        </p>
      </div>

      {/* Steps + worked example */}
      <StepsWithExample />

      {/* Common Questions */}
      <section>
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-4">
          Common questions
        </div>
        <div>
          {questions.map((item, i) => (
            <div key={i} className="border-t border-border py-5">
              <h2 className="text-base font-bold text-text-primary tracking-[-0.01em] mb-3">
                {item.q}
              </h2>
              <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
                {item.a}
              </p>
            </div>
          ))}
          <div className="border-t border-border" />
        </div>
      </section>

    </div>
  );
}
