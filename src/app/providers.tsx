'use client';

import React from 'react';
import { ToastProvider } from '@heroui/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ToastProvider placement="top end" maxVisibleToasts={4} />
      {children}
    </>
  );
}
