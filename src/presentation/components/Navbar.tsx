'use client';

import React from 'react';
import Image from 'next/image';
import NextLink from 'next/link';
import { Button } from '@heroui/react';
import { usePathname, useRouter } from 'next/navigation';
import { Compass, LayoutDashboard, LogOut, User as UserIcon } from 'lucide-react';
import { authClient } from '@/infrastructure/auth/client';

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const session = authClient.useSession();
  
  const isAdminPath = pathname.startsWith('/admin') || pathname === '/testnet';
  const isAuthenticated = !!session.data;
  const user = session.data?.user;
  const isAdminUser = user?.role === 'admin';

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/');
          router.refresh();
        }
      }
    });
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-[#eaedff]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center">
          <NextLink href="/" className="flex items-center gap-3" aria-label="BeTrustless home">
            <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md bg-black ring-1 ring-black/5">
              <Image
                src="/brand/vytrosti-mark.png"
                alt="BeTrustless logo"
                width={414}
                height={363}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <span className="font-bold text-xl tracking-[0.12em] text-[#003527]">
              BeTrustless
            </span>
          </NextLink>
        </div>

        {/* Center content */}
        <div className="hidden sm:flex items-center gap-6">
          <NextLink 
            href="/" 
            className={`flex items-center gap-1.5 text-sm ${pathname === '/' ? 'text-[#064e3b] font-semibold' : 'text-slate-600 hover:text-[#003527]'}`}
          >
            <Compass size={16} /> Explore Properties
          </NextLink>
          
          {isAuthenticated && isAdminUser && (
            <NextLink 
              href="/admin" 
              className={`flex items-center gap-1.5 text-sm ${pathname.startsWith('/admin') ? 'text-[#064e3b] font-semibold' : 'text-slate-600 hover:text-[#003527]'}`}
            >
              <LayoutDashboard size={16} /> Admin Portal
            </NextLink>
          )}
        </div>

        {/* End content */}
        <div className="flex items-center gap-4">
          {session.isPending ? (
            <span className="text-xs text-slate-400">Loading...</span>
          ) : isAuthenticated ? (
            <div className="flex items-center gap-3">
              {/* User badge */}
              <div className="hidden md:flex items-center gap-1.5 bg-[#f2f3ff] border border-[#eaedff] px-3 py-1 rounded-full text-xs text-[#003527]">
                <UserIcon size={12} className="text-[#064e3b]" />
                <span className="font-semibold">{user?.name || user?.email}</span>
                {isAdminUser && (
                  <span className="bg-[#003527] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ml-1">
                    Admin
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {isAdminUser && (
                isAdminPath ? (
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
                )
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={handleLogout}
                className="font-semibold text-rose-600 hover:bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-1"
              >
                <LogOut size={14} /> Log Out
              </Button>
            </div>
          ) : (
            <NextLink href="/login">
              <Button variant="primary" size="sm" className="font-semibold bg-[#003527] text-white rounded-lg">
                Log In
              </Button>
            </NextLink>
          )}
        </div>
      </div>
    </nav>
  );
}
export default Navigation;
