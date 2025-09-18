'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';
import { AuthProvider } from './auth/AuthProvider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthProvider>{children}</AuthProvider>
    </SessionProvider>
  );
}
