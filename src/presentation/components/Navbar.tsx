'use client';

import React from 'react';
import NextLink from 'next/link';
import { Button } from '@heroui/react';
import { usePathname } from 'next/navigation';
import { Compass, LayoutDashboard } from 'lucide-react';

export function Navigation() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#eaedff]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center">
          <NextLink href="/" className="font-bold text-xl text-[#003527] tracking-wider flex items-center gap-2">
            <span className="text-2xl">🌱</span> vytrosti
          </NextLink>
        </div>

        {/* Center content */}
        <div className="hidden sm:flex items-center gap-6">
          <NextLink 
            href="/" 
            className={`flex items-center gap-1.5 text-sm ${!isAdmin ? 'text-[#064e3b] font-semibold' : 'text-slate-600 hover:text-[#003527]'}`}
          >
            <Compass size={16} /> Explore Properties
          </NextLink>
          <NextLink 
            href="/admin" 
            className={`flex items-center gap-1.5 text-sm ${isAdmin ? 'text-[#064e3b] font-semibold' : 'text-slate-600 hover:text-[#003527]'}`}
          >
            <LayoutDashboard size={16} /> Admin Portal
          </NextLink>
        </div>

        {/* End content */}
        <div className="flex items-center">
          {isAdmin ? (
            <NextLink href="/">
              <Button variant="secondary" size="sm" className="font-semibold text-[#064e3b] bg-[#eaedff] rounded-lg">
                Guest Mode
              </Button>
            </NextLink>
          ) : (
            <NextLink href="/admin">
              <Button variant="primary" size="sm" className="font-semibold bg-[#064e3b] text-white rounded-lg">
                Admin Portal
              </Button>
            </NextLink>
          )}
        </div>
      </div>
    </nav>
  );
}
export default Navigation;

