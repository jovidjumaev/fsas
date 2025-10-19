'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'student' | 'professor';
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredRole, 
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const [redirectTimeout, setRedirectTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing redirect timeout
    if (redirectTimeout) {
      clearTimeout(redirectTimeout);
      setRedirectTimeout(null);
    }

    if (!loading) {
      if (!user) {
        console.log('🔒 ProtectedRoute: No user, redirecting to:', redirectTo);
        router.push(redirectTo);
        return;
      }

      if (requiredRole && userRole !== requiredRole) {
        console.log('🔒 ProtectedRoute: Wrong role. Required:', requiredRole, 'Current:', userRole);
        
        // Add a small delay before redirect to allow for role fetch retries
        const timeout = setTimeout(() => {
          console.log('🔒 ProtectedRoute: Redirecting after delay to:', redirectTo);
          router.push(redirectTo);
        }, 2000); // 2 second delay
        
        setRedirectTimeout(timeout);
        return;
      }
    }
  }, [user, userRole, loading, requiredRole, redirectTo, router]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeout) {
        clearTimeout(redirectTimeout);
      }
    };
  }, [redirectTimeout]);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated or wrong role
  if (!user || (requiredRole && userRole !== requiredRole)) {
    return null;
  }

  return <>{children}</>;
}
