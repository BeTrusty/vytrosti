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
  const trustlessBaseURL =
    process.env.TRUSTLESS_API_URL === 'https://api.trustlesswork.com'
      ? 'https://api.trustlesswork.com'
      : 'https://dev.api.trustlesswork.com';
  const trustlessApiKey = process.env.NEXT_PUBLIC_TRUSTLESS_API_KEY || process.env.TRUSTLESS_API_KEY || '';

  return (
    <html lang="en" className="light">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <Providers
          trustlessConfig={{
            apiKey: trustlessApiKey,
            baseURL: trustlessBaseURL,
          }}
        >
          <Navigation />
          <main className="flex-grow flex flex-col">
            {children}
          </main>
          <footer className="border-t border-[#eaedff] bg-white py-6 text-center text-xs text-slate-500">
            <span>&copy; {new Date().getFullYear()} Vytrosti.</span>{' '}
            <span>
              by{' '}
              <a
                href="https://trustlesswork.com"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-700 transition hover:text-[#003527]"
              >
                Trustless
              </a>{' '}
              y{' '}
              <a
                href="https://betrusty.io"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-700 transition hover:text-[#003527]"
              >
                BeTrusty
              </a>
              .
            </span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
