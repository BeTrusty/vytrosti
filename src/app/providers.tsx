'use client';

import React from 'react';
import { ToastProvider } from '@heroui/react';
import { TrustlessWorkConfig } from '@trustless-work/escrow';

interface ProvidersProps {
  children: React.ReactNode;
  trustlessConfig: {
    apiKey: string;
    baseURL: 'https://api.trustlesswork.com' | 'https://dev.api.trustlesswork.com';
  };
}

export function Providers({ children, trustlessConfig }: ProvidersProps) {
  return (
    <TrustlessWorkConfig baseURL={trustlessConfig.baseURL} apiKey={trustlessConfig.apiKey}>
      <ToastProvider placement="top end" maxVisibleToasts={4} />
      {children}
    </TrustlessWorkConfig>
  );
}
