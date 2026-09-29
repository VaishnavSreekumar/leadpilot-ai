import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LeadPilot AI — Sales Lead Prioritization & Intelligence',
  description:
    'AI-powered real-estate sales lead prioritization and follow-up command center. Know who to contact, why, and what to say.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#F6F4F0] text-zinc-900 selection:bg-[#C84B45]/15 selection:text-[#C84B45]">
        {children}
      </body>
    </html>
  );
}
