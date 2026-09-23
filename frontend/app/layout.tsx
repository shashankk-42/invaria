import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { SiteNav, SiteFooter, ScrollReveal } from '@/components/site/chrome';
import './globals.css';
export const metadata: Metadata = {
  title: 'Invaria — Application Security',
  icons: { icon: '/icon.svg' },
  description:
    'Evidence-first repository security analysis, findings and application graphs.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body><SiteNav />{children}<SiteFooter /><ScrollReveal /></body>
    </html>
  );
}
