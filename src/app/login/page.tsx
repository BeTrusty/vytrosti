'use client';

import React, { useState, Suspense } from 'react';
import { Button, Input, Card, Alert, TextField, Label, Chip } from '@heroui/react';
import { authClient } from '@/infrastructure/auth/client';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, Mail, Lock, Info } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: authError } = await authClient.signIn.email({
        email,
        password,
      });

      if (authError) {
        setError(authError.message || 'Invalid email or password');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (uEmail: string, uPass: string) => {
    setEmail(uEmail);
    setPassword(uPass);
  };

  return (
    <div className="max-w-md w-full mx-auto my-16 px-4">
      <Card className="ambient-lift border-none bg-white p-8 rounded-3xl flex flex-col gap-6 text-left">
        <Card.Content className="p-0 flex flex-col gap-6">
          <div className="text-center flex flex-col items-center gap-2">
            <span className="text-3xl">🌱</span>
            <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Welcome to Vytrosti</h1>
            <p className="text-xs text-slate-500">Sign in to access your coordinates and execute payments.</p>
          </div>

          {error && (
            <Alert status="danger" title="Authentication Error">
              <Alert.Description>{error}</Alert.Description>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <TextField className="w-full flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Email Coordinates</Label>
              <div className="relative flex items-center">
                <Mail size={16} className="absolute left-3 text-slate-400" />
                <Input
                  type="email"
                  placeholder="name@vytrosti.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl pl-10 pr-3 py-2 w-full text-sm outline-none"
                />
              </div>
            </TextField>

            <TextField className="w-full flex flex-col gap-1.5">
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Secret Key / Password</Label>
              <div className="relative flex items-center">
                <Lock size={16} className="absolute left-3 text-slate-400" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-[#f2f3ff] border border-[#eaedff] focus-within:border-[#064e3b] rounded-xl pl-10 pr-3 py-2 w-full text-sm outline-none"
                />
              </div>
            </TextField>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isPending={loading}
              className="w-full font-bold bg-[#064e3b] text-white flex items-center justify-center gap-1.5 rounded-xl h-11"
            >
              <LogIn size={18} /> Sign In
            </Button>
          </form>

          {/* Test Users Credentials */}
          <div className="precision-callout precision-callout--amber">
            <div className="precision-callout__rail" />
            <div className="precision-callout__body">
              <div className="precision-callout__header">
                <div className="precision-callout__intro">
                  <span className="precision-callout__eyebrow">
                    <Info size={14} className="precision-callout__icon" />
                    Test access
                  </span>
                  <h3 className="precision-callout__title">Demo accounts</h3>
                  <p className="precision-callout__copy">
                    Use quick fill to load a review account instantly.
                  </p>
                </div>
                <Chip size="sm" variant="flat" className="precision-callout__chip">
                  Demo
                </Chip>
              </div>

              <div className="flex flex-col gap-2">
                <div className="precision-callout__meta">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[#131b2e] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                        Admin portal user
                      </span>
                      <span className="text-slate-500">admin.demo@vytrosti.com</span>
                      <span className="font-mono text-slate-400">Vytr0sti#Admin2024!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('admin.demo@vytrosti.com', 'Vytr0sti#Admin2024!')}
                      className="rounded-lg border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#7c3f05] transition-colors hover:bg-white"
                    >
                      Quick Fill
                    </button>
                  </div>
                </div>

                <div className="precision-callout__meta">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[#131b2e] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Guest tenant 1
                      </span>
                      <span className="text-slate-500">guest1.demo@vytrosti.com</span>
                      <span className="font-mono text-slate-400">Vytr0sti#Guest1!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('guest1.demo@vytrosti.com', 'Vytr0sti#Guest1!')}
                      className="rounded-lg border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#7c3f05] transition-colors hover:bg-white"
                    >
                      Quick Fill
                    </button>
                  </div>
                </div>

                <div className="precision-callout__meta">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-[#131b2e] flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Guest tenant 2
                      </span>
                      <span className="text-slate-500">guest2.demo@vytrosti.com</span>
                      <span className="font-mono text-slate-400">Vytr0sti#Guest2!</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleQuickFill('guest2.demo@vytrosti.com', 'Vytr0sti#Guest2!')}
                      className="rounded-lg border border-amber-200 bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#7c3f05] transition-colors hover:bg-white"
                    >
                      Quick Fill
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md w-full mx-auto my-16 px-4 text-center">
        <p className="text-slate-500">Loading auth context...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
