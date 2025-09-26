import './globals.css';
import React from 'react';
import { AcademicCapIcon, CalculatorIcon } from '@heroicons/react/24/solid';
import { Inter } from 'next/font/google';
import type { Metadata } from 'next';
import type { Viewport } from 'next';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: {
    default: 'NCEA to ATAR Calculator | Academic Edition',
    template: '%s | NCEA to ATAR Calculator',
  },
  description:
    'Estimate your Australian ATAR from NCEA standards. Analyse subjects, credits, and achieve University Entrance confidence.',
  applicationName: 'NCEA → ATAR Estimator',
  category: 'education',
  keywords: [
    'NCEA',
    'ATAR',
    'University Entrance',
    'NZQA',
    'calculator',
    'credits',
    'standards',
    'subject analysis',
    'New Zealand',
    'Australia',
  ],
  authors: [{ name: 'NCEA to ATAR Team' }],
  creator: 'NCEA to ATAR',
  publisher: 'NCEA to ATAR',
  openGraph: {
    type: 'website',
    url: '/',
    title: 'NCEA to ATAR Calculator | Academic Edition',
    description:
      'Estimate your ATAR from NCEA results with subject analysis and suggestions.',
    siteName: 'NCEA to ATAR',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NCEA to ATAR Calculator',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NCEA to ATAR Calculator | Academic Edition',
    description: 'Estimate your ATAR from NCEA results.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
  },
  alternates: {
    canonical: '/',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D1117',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#0D1117] text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.10),transparent_60%)]" />
        <header className="border-b border-white/10 sticky top-0 backdrop-blur bg-[#0D1117]/80 z-50 shadow-glow-sm">
          <div className="max-w-7xl mx-auto px-8 py-4 flex items-center justify-between">
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
        <main className="max-w-7xl mx-auto px-8 py-10">{children}</main>
      </body>
    </html>
  );
} 