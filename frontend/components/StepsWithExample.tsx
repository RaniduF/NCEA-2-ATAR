'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

// ─── Jane Doe constants ──────────────────────────────────────────────────────

const TOTAL_CREDITS = 103;
const JANE_SV = 0.6248;
const JANE_RANK = 3800;
const TOTAL_STUDENTS = 30000;
const JANE_ATAR = 87.35;

const PHYSICS = [
  { code: 'Phys 3.1', name: 'Mechanics',              type: 'ext', credits: 4, grade: 'E', weight: 96 },
  { code: 'Phys 3.4', name: 'Wave behaviour',          type: 'ext', credits: 5, grade: 'M', weight: 89 },
  { code: 'Phys 3.6', name: 'Modern physics',          type: 'ext', credits: 4, grade: 'M', weight: 83 },
  { code: 'Phys 3.7', name: 'Practical investigation', type: 'int', credits: 6, grade: 'A', weight: 53 },
] as const;

const GRADE_BADGE: Record<string, string> = {
  E: 'bg-grade-excellence text-white',
  M: 'bg-grade-merit text-white',
  A: 'bg-grade-achieved text-white',
  N: 'bg-grade-notAchieved text-white',
};

// ─── Steps data ──────────────────────────────────────────────────────────────

const steps: { heading: string; body: React.ReactNode }[] = [
  {
    heading: 'Are you eligible?',
    body: (
      <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
        You need at least{' '}
        <span className="text-primary font-semibold">60 NCEA Level 3 credits</span> from completed
        years. Below that, you don&apos;t get an ATAR.
      </p>
    ),
  },
  {
    heading: 'Your best 90 credits are picked',
    body: (
      <>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl mb-4">
          NZQA selects 90 credits from across all your Level 3 results, including past years if you
          have them. A few rules shape the selection:
        </p>
        <ul className="text-sm text-text-secondary leading-relaxed max-w-2xl space-y-1.5 mb-4 list-none">
          <li className="flex gap-2">
            <span className="flex-shrink-0 text-text-muted">·</span>
            <span>Up to 24 credits count from any single subject</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 text-text-muted">·</span>
            <span>UE-approved subjects are picked before non-UE subjects</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 text-text-muted">·</span>
            <span>Achievement standards are picked before unit standards</span>
          </li>
          <li className="flex gap-2">
            <span className="flex-shrink-0 text-text-muted">·</span>
            <span>If you&apos;ve resat a standard, only your best result is used</span>
          </li>
        </ul>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          &#8220;Best&#8221; doesn&apos;t just mean highest grade. A UE-approved Achieved can be
          picked ahead of a non-UE Excellence.
        </p>
      </>
    ),
  },
  {
    heading: 'Each result gets a weight',
    body: 'Every standard is given a weight reflecting how hard it is. Harder standards, where students generally find it tougher to get top grades, count for more. Externally assessed standards usually weigh more than internal ones. Your grade in each standard is then turned into a score between 0 and 1, with the weight built in: an Excellence in a heavily-weighted external standard scores much higher than an Excellence in a lightly-weighted internal one.',
  },
  {
    heading: 'Your scores are averaged',
    body: (
      <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
        Your 90 credits&apos; worth of weighted scores are averaged together to give you a single
        number, your <span className="text-primary font-semibold">Statistical Value</span>.
      </p>
    ),
  },
  {
    heading: "You're ranked against everyone else",
    body: "Every eligible student's Statistical Value is ranked from highest to lowest. Where you sit on this list depends on how everyone else did, not just on your own results.",
  },
  {
    heading: 'Your rank becomes your ATAR',
    body: (
      <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
        The ranked list is sliced into bands of{' '}
        <span className="text-primary font-semibold">0.05%</span>. The top band gets{' '}
        <span className="text-primary font-semibold">99.95</span>, the next 99.90, and so on down
        to 0.00. Because the ATAR represents your standing among everyone your age, not just NCEA
        students, each band is roughly 0.1% of NCEA Level 3 students, since only about half your
        age cohort takes Level 3.
      </p>
    ),
  },
];

// ─── Shared panel wrapper ────────────────────────────────────────────────────

function PanelCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-border bg-surface-card p-5 space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
        Jane Doe — worked example
      </p>
      {children}
    </div>
  );
}

// Counts from 0 → target using a cubic ease, re-runs whenever `active` flips to true
function AnimatedCount({
  target,
  decimals = 0,
  active,
}: {
  target: number;
  decimals?: number;
  active: boolean;
}) {
  const shouldReduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) {
      setVal(0);
      return;
    }
    if (shouldReduce) {
      setVal(target);
      return;
    }
    let rafId: number;
    const duration = 900;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - t0) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setVal(target * eased);
      if (t < 1) rafId = requestAnimationFrame(tick);
      else setVal(target);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [active, target, decimals, shouldReduce]);
  return <>{val.toFixed(decimals)}</>;
}

// ─── Panel 1: Eligibility ────────────────────────────────────────────────────

function EligibilityPanel({ active }: { active: boolean }) {
  return (
    <PanelCard>
      <div className="flex items-baseline gap-3">
        <span
          className="font-mono font-bold text-primary"
          style={{ fontSize: '2.5rem', lineHeight: 1 }}
        >
          <AnimatedCount target={TOTAL_CREDITS} active={active} />
        </span>
        <span className="text-sm text-text-secondary">Level 3 credits</span>
      </div>

      <div>
        <div className="h-2 bg-surface-hover relative">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: '0%' }}
            animate={active ? { width: `${(TOTAL_CREDITS / 120) * 100}%` } : { width: '0%' }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.1 }}
          />
          <div className="absolute inset-y-0 w-px bg-border-strong" style={{ left: '50%' }} />
          <div className="absolute inset-y-0 w-px bg-border-strong" style={{ left: '75%' }} />
        </div>
        <div className="relative mt-1.5 h-4">
          <span className="absolute text-[11px] text-text-muted" style={{ left: '0%' }}>0</span>
          <span className="absolute text-[11px] text-text-muted" style={{ left: '50%', transform: 'translateX(-50%)' }}>60 min</span>
          <span className="absolute text-[11px] text-text-muted" style={{ left: '75%', transform: 'translateX(-50%)' }}>90 max</span>
        </div>
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: active ? 0.85 : 0 }}
        className="text-xs font-bold text-primary uppercase tracking-wide"
      >
        ✓ Eligible — above the 60 credit minimum
      </motion.p>
    </PanelCard>
  );
}

// ─── Panel 2: Credit selection ───────────────────────────────────────────────

function CreditSelectionPanel({ active }: { active: boolean }) {
  return (
    <PanelCard>
      <p className="text-xs text-text-secondary">
        UE-approved standards selected first, then by priority order
      </p>
      <div className="space-y-1.5">
        {PHYSICS.map((r, i) => (
          <motion.div
            key={r.code}
            initial={{ opacity: 0, x: -10 }}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
            transition={{ delay: active ? i * 0.1 : 0, duration: 0.28 }}
            className="flex items-center gap-2 text-xs"
          >
            <span className="font-mono text-text-muted w-14 shrink-0">{r.code}</span>
            <span className="text-text-secondary flex-1 truncate">{r.name}</span>
            <span className={`${GRADE_BADGE[r.grade]} px-1.5 py-0.5 text-[10px] font-bold`}>
              {r.grade}
            </span>
            <span className="text-text-muted w-[72px] text-right shrink-0">{r.credits} credits</span>
            <span
              className={`text-[10px] font-bold uppercase w-20 text-right shrink-0 ${
                r.type === 'ext' ? 'text-primary' : 'text-text-muted'
              }`}
            >
              UE {r.type === 'ext' ? 'External' : 'Internal'}
            </span>
          </motion.div>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: active ? 0.5 : 0 }}
          className="text-xs text-text-muted italic pt-0.5"
        >
          + 71 credits from other UE subjects · · ·
        </motion.p>
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: active ? 0.7 : 0 }}
        className="flex justify-between text-xs border-t border-border pt-3"
      >
        <span className="text-text-muted">Total selected</span>
        <span className="font-mono font-bold text-primary">90 / 90 credits</span>
      </motion.div>
    </PanelCard>
  );
}

// ─── Panel 3: Weights ────────────────────────────────────────────────────────

function WeightsPanel({ active }: { active: boolean }) {
  return (
    <PanelCard>
      <p className="text-xs text-text-secondary">
        Difficulty weight for each standard
      </p>
      <div className="space-y-3">
        {PHYSICS.map((r, i) => (
          <motion.div
            key={r.code}
            initial={{ opacity: 0 }}
            animate={active ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: active ? i * 0.15 : 0 }}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-text-secondary">
                {r.code} ({r.type === 'ext' ? 'External' : 'Internal'}){' '}
                <span className={`${GRADE_BADGE[r.grade]} px-1 py-0.5 text-[10px] font-bold`}>
                  {r.grade}
                </span>
              </span>
              <span className="font-mono font-bold text-text-primary">{r.weight}%</span>
            </div>
            <div className="h-1.5 bg-surface-hover">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: '0%' }}
                animate={active ? { width: `${r.weight}%` } : { width: '0%' }}
                transition={{ delay: active ? i * 0.15 + 0.05 : 0, duration: 0.55, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: active ? 0.72 : 0 }}
          className="text-xs text-text-muted italic"
        >
          · · · other subjects follow the same pattern
        </motion.p>
      </div>
    </PanelCard>
  );
}

// ─── Panel 4: Average ────────────────────────────────────────────────────────

function AveragePanel({ active }: { active: boolean }) {
  const rows = PHYSICS.map(r => ({
    code: r.code,
    credits: r.credits,
    grade: r.grade,
    weight: `${r.weight}%`,
    wtCr: ((r.weight / 100) * r.credits).toFixed(2),
  }));

  const physicsCr = PHYSICS.reduce((s, r) => s + r.credits, 0);
  const physicsWtCr = PHYSICS.reduce((s, r) => s + (r.weight / 100) * r.credits, 0);
  const otherCr = 90 - physicsCr;
  const otherWtCr = (56.23 - physicsWtCr).toFixed(2);
  const totalWtCr = 56.23;

  return (
    <PanelCard>
      {/* Column headers */}
      <div className="flex gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted pb-2 border-b border-border">
        <span className="flex-1 min-w-0">Standard</span>
        <span className="w-14 text-right shrink-0">Credits</span>
        <span className="w-12 text-center shrink-0">Grade</span>
        <span className="w-16 text-right shrink-0">Weight</span>
        <span className="w-20 text-right shrink-0">Wt × Credits</span>
      </div>

      {/* Physics rows */}
      {rows.map((r, i) => (
        <motion.div
          key={r.code}
          initial={{ opacity: 0, x: -6 }}
          animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
          transition={{ delay: active ? i * 0.1 : 0, duration: 0.25 }}
          className="flex items-center gap-2 text-xs py-1.5 border-b border-border"
        >
          <span className="flex-1 min-w-0 font-mono text-text-muted truncate">{r.code}</span>
          <span className="w-14 text-right font-mono text-text-secondary shrink-0">{r.credits}</span>
          <span className="w-12 flex justify-center shrink-0">
            <span className={`${GRADE_BADGE[r.grade]} px-1 py-0.5 text-[10px] font-bold`}>{r.grade}</span>
          </span>
          <span className="w-16 text-right font-mono text-text-secondary shrink-0">{r.weight}</span>
          <span className="w-20 text-right font-mono text-text-primary font-bold shrink-0">{r.wtCr}</span>
        </motion.div>
      ))}

      {/* Other subjects row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: active ? 0.45 : 0 }}
        className="flex items-center gap-2 text-xs py-1.5 border-b border-border"
      >
        <span className="flex-1 min-w-0 text-text-muted italic">· · · other subjects</span>
        <span className="w-14 text-right font-mono text-text-muted shrink-0">{otherCr}</span>
        <span className="w-12 shrink-0" />
        <span className="w-16 shrink-0" />
        <span className="w-20 text-right font-mono text-text-muted shrink-0">{otherWtCr}</span>
      </motion.div>

      {/* Total row */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: active ? 0.6 : 0 }}
        className="flex items-center gap-2 text-xs py-2"
      >
        <span className="flex-1 min-w-0 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Total</span>
        <span className="w-14 text-right font-mono font-bold text-text-primary shrink-0">90</span>
        <span className="w-12 shrink-0" />
        <span className="w-16 shrink-0" />
        <span className="w-20 text-right font-mono font-bold text-text-primary shrink-0">{totalWtCr.toFixed(2)}</span>
      </motion.div>

      {/* Formula box */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.97 }}
        transition={{ delay: active ? 0.78 : 0 }}
        className="border border-border bg-surface-hover p-3 flex items-center justify-between gap-4"
      >
        <span className="font-mono text-xs text-text-muted">{totalWtCr.toFixed(2)} ÷ 90 =</span>
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Statistical Value</span>
          <span className="font-mono font-bold text-primary" style={{ fontSize: '2rem', lineHeight: 1 }}>
            <AnimatedCount target={JANE_SV} decimals={4} active={active} />
          </span>
        </div>
      </motion.div>
    </PanelCard>
  );
}

// ─── Panel 5: Ranking ────────────────────────────────────────────────────────

function RankingPanel({ active }: { active: boolean }) {
  const rows = [
    { rank: 3798, name: 'Anon Student', sv: '0.6252', jane: false },
    { rank: 3799, name: 'Anon Student', sv: '0.6250', jane: false },
    { rank: 3800, name: 'Jane Doe',     sv: '0.6248', jane: true  },
    { rank: 3801, name: 'Anon Student', sv: '0.6245', jane: false },
    { rank: 3802, name: 'Anon Student', sv: '0.6241', jane: false },
  ];
  return (
    <PanelCard>
      <p className="text-xs text-text-secondary">All eligible students ordered by Statistical Value</p>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <motion.div
            key={r.rank}
            initial={{ opacity: 0, y: 4 }}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={{ delay: active ? i * 0.09 : 0 }}
            className={`flex items-center gap-2 px-2 py-1.5 text-xs ${
              r.jane ? 'bg-primary-subtle border border-primary/20' : ''
            }`}
          >
            <span
              className={`font-mono w-12 shrink-0 ${
                r.jane ? 'text-primary font-bold' : 'text-text-muted'
              }`}
            >
              #{r.rank.toLocaleString()}
            </span>
            <span className={`flex-1 ${r.jane ? 'font-bold text-primary' : 'text-text-secondary'}`}>
              {r.name}
            </span>
            <span
              className={`font-mono ${r.jane ? 'text-primary font-bold' : 'text-text-muted'}`}
            >
              {r.sv}
            </span>
          </motion.div>
        ))}
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        animate={active ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: active ? 0.6 : 0 }}
        className="text-xs text-text-muted"
      >
        Ranked {JANE_RANK.toLocaleString()} of {TOTAL_STUDENTS.toLocaleString()} eligible students
      </motion.p>
    </PanelCard>
  );
}

// ─── Panel 6: ATAR ───────────────────────────────────────────────────────────

function ATARPanel({ active }: { active: boolean }) {
  const items = [
    { label: 'Rank',            value: `${JANE_RANK.toLocaleString()} of ${TOTAL_STUDENTS.toLocaleString()}` },
    { label: 'Age-cohort band', value: '12.65 – 12.70%' },
    { label: 'Band step',       value: '0.05% → ATAR 87.35' },
  ];
  return (
    <PanelCard>
      <div className="space-y-0">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -6 }}
            animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
            transition={{ delay: active ? i * 0.15 : 0 }}
            className="flex justify-between text-xs py-2.5 border-b border-border-subtle"
          >
            <span className="text-text-muted">{item.label}</span>
            <span className="text-text-primary font-medium">{item.value}</span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.92 }}
        transition={{ delay: active ? 0.55 : 0 }}
        className="text-center pt-2"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-1">
          ATAR
        </p>
        <p
          className="font-mono font-bold text-primary"
          style={{ fontSize: '3rem', lineHeight: 1 }}
        >
          <AnimatedCount target={JANE_ATAR} decimals={2} active={active} />
        </p>
      </motion.div>
    </PanelCard>
  );
}

// ─── Panel registry ──────────────────────────────────────────────────────────

type PanelComp = React.ComponentType<{ active: boolean }>;

const PANELS: PanelComp[] = [
  EligibilityPanel,
  CreditSelectionPanel,
  WeightsPanel,
  AveragePanel,
  RankingPanel,
  ATARPanel,
];

// ─── Step section ────────────────────────────────────────────────────────────

function StepSection({
  step,
  index,
  Panel,
}: {
  step: { heading: string; body: React.ReactNode };
  index: number;
  Panel: PanelComp;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.4 });

  return (
    <div
      ref={ref}
      id={`step-${index + 1}`}
      className="border-t border-border py-8 min-h-[60vh] flex flex-col justify-center gap-8"
    >
      <div className="flex gap-6 md:gap-10">
        <div className="flex-shrink-0 w-10 pt-0.5">
          <span
            className="font-mono font-bold leading-none text-primary"
            style={{ fontSize: '1.625rem' }}
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-text-primary tracking-[-0.01em] mb-3">
            {step.heading}
          </h2>
          <div className="mb-8">
            {typeof step.body === 'string' ? (
              <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">{step.body}</p>
            ) : (
              step.body
            )}
          </div>
          
          {/* Panel sits inline below the step text */}
          <div className="max-w-[600px]">
            <Panel active={isInView} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

export default function StepsWithExample() {
  return (
    <section className="mb-12">
      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted mb-4">
        The conversion process
      </div>

      <div>
        {steps.map((step, i) => (
          <StepSection
            key={i}
            step={step}
            index={i}
            Panel={PANELS[i]}
          />
        ))}
        <div className="border-t border-border" />
      </div>
    </section>
  );
}
