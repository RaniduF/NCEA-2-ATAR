import './globals.css';
import React from 'react';
import { DM_Sans, IBM_Plex_Mono } from 'next/font/google';
import type { Metadata } from 'next';
import type { Viewport } from 'next';
import Link from 'next/link';
import { ToastProvider } from './providers/ToastProvider';

const dmSans = DM_Sans({ subsets: ['latin'], display: 'swap', variable: '--font-dm-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], display: 'swap', variable: '--font-ibm-plex-mono', weight: ['400', '500', '600', '700'] });

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
  alternates: { canonical: '/' },
};

export const viewport: Viewport = {
  themeColor: '#F5F0EB',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${ibmPlexMono.variable}`}>
      <head>
        {/* Material Symbols Outlined */}
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-surface-base text-text-primary antialiased font-sans">
        <ToastProvider>
          {/* Header */}
          <header className="fixed top-0 left-0 right-0 border-b border-border bg-surface-card/95 backdrop-blur-sm z-50 transition-all duration-300">
            <div className="max-w-[900px] mx-auto px-6 h-14 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-3">
                <img src="/N-A_logo.svg" alt="NCEA → ATAR logo" className="w-8 h-8 object-contain" />
                <span className="text-base font-bold tracking-tight text-text-primary">NCEA → ATAR</span>
              </Link>
              <div className="flex items-center gap-6">
                <Link href="/how-it-works" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">
                  How it works
                </Link>
                <span className="text-[10px] font-medium uppercase tracking-[0.15em] text-text-muted">
                  Beta
                </span>
              </div>
            </div>
          </header>

          <main className="pt-24 pb-16 px-6 max-w-[900px] mx-auto min-h-screen">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-border py-6 text-center">
            <p className="text-xs text-text-muted tracking-wide">NCEA → ATAR · Beta · 2026</p>
          </footer>
        </ToastProvider>
      </body>
    </html>
  );
}