import type { Metadata } from "next";
import { Inter, Crimson_Pro } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const crimsonPro = Crimson_Pro({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-crimson-pro" });

export const metadata: Metadata = {
  title: "NCEA to ATAR Calculator | Academic Edition",
  description: "A modern, professional calculator to convert NCEA credits to an Australian Tertiary Admission Rank (ATAR).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${crimsonPro.variable}`}>{children}</body>
    </html>
  );
}
