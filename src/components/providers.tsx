'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Lazy load the AuthProvider for faster initial render
const AuthProvider = dynamic(
  () => import('@/lib/auth-context-optimized').then(mod => ({ default: mod.AuthProvider })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400"></div>
      </div>
    )
  }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-300 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400"></div>
      </div>
    }>
      <AuthProvider>
        {children}
      </AuthProvider>
    </Suspense>
  );
}