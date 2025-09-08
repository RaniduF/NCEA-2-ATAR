import './globals.css';
import React from 'react';
import { AcademicCapIcon, CalculatorIcon } from '@heroicons/react/24/solid';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.12),transparent_60%)]" />
        <header className="border-b border-white/10 sticky top-0 backdrop-blur bg-slate-900/80 z-50 shadow-glow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm flex items-center justify-center">
                  <AcademicCapIcon className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                  <CalculatorIcon className="w-3 h-3 text-white" />
                </div>
              </div>
              <div>
                <div className="text-xl font-semibold tracking-tight">NCEA → ATAR Estimator</div>
                <div className="text-xs text-slate-400">University Entrance Calculator</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="badge-brand">Beta</div>
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
} 