import './globals.css';
import React from 'react';
import { AcademicCapIcon, CalculatorIcon } from '@heroicons/react/24/solid';
import { Inter, Outfit } from 'next/font/google';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import { ToastProvider } from './providers/ToastProvider';

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], display: 'swap', variable: '--font-outfit' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'NCEA to ATAR Calculator',
  description: 'Calculate your ATAR from your NCEA results. Analyse subjects, credits, and achieve University Entrance confidence.',
  applicationName: 'NCEA → ATAR Estimator',
  category: 'education',
  keywords: ['NCEA', 'ATAR', 'University Entrance', 'NZQA', 'calculator', 'credits', 'standards', 'subject analysis', 'New Zealand', 'Australia'],
  authors: [{ name: 'NCEA to ATAR Team' }],
  creator: 'NCEA to ATAR',
  publisher: 'NCEA to ATAR',
  openGraph: {
    type: 'website',
    url: '/',
    title: 'NCEA to ATAR Calculator',
    description: 'Calculate your ATAR from NCEA results with subject analysis and suggestions.',
    siteName: 'NCEA to ATAR',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'NCEA to ATAR Calculator' }],
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
  icons: { icon: '/favicon.ico' },
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#030712',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="min-h-screen bg-mesh text-slate-100 antialiased font-sans selection:bg-brand-500/30">
        <ToastProvider>
          {/* Ambient Background Glow */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-brand-600/10 blur-[120px] animate-pulse-slow" />
            <div className="absolute top-[20%] -right-[10%] w-[40%] h-[40%] rounded-full bg-accent-500/10 blur-[100px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
          </div>

          <header className="fixed top-0 left-0 right-0 border-b border-white/5 backdrop-blur-md bg-[#030712]/70 z-50 transition-all duration-300">
            <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative group">
                  <div className="absolute inset-0 bg-brand-500/50 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 shadow-lg shadow-brand-500/20 flex items-center justify-center border border-white/10">
                    <AcademicCapIcon className="w-5 h-5 text-white" aria-hidden="true" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-md bg-[#030712] flex items-center justify-center border border-white/10">
                    <CalculatorIcon className="w-2.5 h-2.5 text-accent-400" aria-hidden="true" />
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold tracking-tight font-display text-white">NCEA → ATAR</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-xs font-medium text-brand-300">
                  Beta
                </div>
              </div>
            </div>
          </header>

          <main className="pt-24 pb-12 px-6 max-w-[1400px] mx-auto min-h-screen">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}