import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Navigation } from '@/presentation/components/Navbar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vytrosti — Temporary Rentals Platform',
  description: 'Full crypto temporary rentals platform built on Stellar and Trustless Work escrow.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Providers>
          <Navigation />
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <footer className="border-t border-[#eaedff] bg-white py-6 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Vytrosti. Built for Stellar Hackathon.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
