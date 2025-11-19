'use client';

import { Suspense, lazy, memo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardSkeleton } from '@/components/loading-skeleton';

// Lazy load heavy components
const DashboardHeader = lazy(() => import('@/components/student/dashboard-header'));
const StatsCards = lazy(() => import('@/components/student/stats-cards'));
const TodayClasses = lazy(() => import('@/components/student/today-classes'));
const RecentAttendance = lazy(() => import('@/components/student/recent-attendance'));
const AIAssistant = lazy(() => import('@/components/student/ai-assistant'));

// Quick loading component while auth checks
const QuickLoader = memo(() => (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-300 dark:border-blue-800 border-t-blue-600 dark:border-t-blue-400 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
    </div>
  </div>
));

QuickLoader.displayName = 'QuickLoader';

export default function OptimizedStudentDashboard() {
  const { user, userRole, loading } = useAuth();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Quick auth check
    const checkAuth = () => {
      if (!loading) {
        if (!user || userRole !== 'student') {
          router.push('/student/login');
        } else {
          setIsReady(true);
        }
      }
    };

    checkAuth();
  }, [user, userRole, loading, router]);

  // Show quick loader during auth check
  if (loading || !isReady) {
    return <QuickLoader />;
  }

  // Main dashboard with lazy-loaded components
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header loads first */}
        <Suspense fallback={<div className="h-16 bg-white dark:bg-gray-800 shadow-sm" />}>
          <DashboardHeader />
        </Suspense>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats cards load in parallel */}
          <Suspense fallback={<div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>}>
            <StatsCards />
          </Suspense>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Today's classes */}
            <Suspense fallback={<div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />}>
              <TodayClasses />
            </Suspense>

            {/* Recent attendance */}
            <Suspense fallback={<div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />}>
              <RecentAttendance />
            </Suspense>
          </div>

          {/* AI Assistant loads last (heaviest component) */}
          <div className="mt-8">
            <Suspense fallback={null}>
              <AIAssistant />
            </Suspense>
          </div>
        </div>
      </div>
    </Suspense>
  );
}