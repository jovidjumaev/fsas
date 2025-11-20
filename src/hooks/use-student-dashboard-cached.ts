import { useCallback, useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { OptimizedStudentDashboardServiceV2 as StudentDashboardService, StudentData, ClassSession, AttendanceStats } from '@/lib/student-dashboard-service-optimized-v2';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-student-dashboard-cached');

interface UseStudentDashboardReturn {
  // Data
  studentData: StudentData | null;
  todayClasses: ClassSession[];
  stats: AttendanceStats;
  userProfile: any;

  // Loading states
  isLoading: boolean;
  statsLoading: boolean;

  // Actions
  refreshData: () => Promise<void>;
  setUserProfile: (profile: any) => void;

  // Real-time features
  isRealTimeEnabled: boolean;
  lastUpdated: Date | null;
}

// This is a drop-in replacement for useStudentDashboard that adds caching
// without changing the data structure or UI

export function useStudentDashboard(user: User | null): UseStudentDashboardReturn {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use SWR for caching the dashboard data
  const { data, error, isLoading, mutate } = useSWR(
    user ? ['student-dashboard-cached', user.id] : null,
    async () => {
      if (!user) return null;

      logger.debug('Fetching dashboard data for user:', user.id);

      try {
        // Fetch dashboard data using the optimized service with timeout
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Dashboard fetch timeout')), 15000)
        );

        const dataPromise = StudentDashboardService.getAllDashboardData(user.id);

        const dashboardData = await Promise.race([dataPromise, timeoutPromise]) as any;

        logger.debug('Dashboard data fetched:', {
          hasStudentData: !!dashboardData.studentData,
          todayClassesCount: dashboardData.todayClasses.length,
          stats: dashboardData.stats
        });

        // Return the data, or apply fallback for student data
        const studentData = dashboardData.studentData || {
          student_id: user.id,
          student_number: user.user_metadata?.student_number || 'N/A',
          enrollment_year: 2024,
          major: user.user_metadata?.major || 'Computer Science',
          graduation_year: 2028,
          first_name: user.user_metadata?.first_name || 'Student',
          last_name: user.user_metadata?.last_name || 'User',
          email: user.email || '',
          phone: user.user_metadata?.phone || '',
          is_active: true,
          account_created: user.created_at || new Date().toISOString()
        };

        return {
          ...dashboardData,
          studentData,
          lastUpdated: new Date()
        };
      } catch (err) {
        logger.error('Error fetching dashboard data:', err);

        // Return minimal fallback data on error
        return {
          studentData: {
            student_id: user.id,
            student_number: user.user_metadata?.student_number || 'N/A',
            enrollment_year: 2024,
            major: user.user_metadata?.major || 'Computer Science',
            graduation_year: 2028,
            first_name: user.user_metadata?.first_name || 'Student',
            last_name: user.user_metadata?.last_name || 'User',
            email: user.email || '',
            phone: user.user_metadata?.phone || '',
            is_active: true,
            account_created: user.created_at || new Date().toISOString()
          },
          todayClasses: [],
          stats: {
            overallAttendance: 0,
            totalClasses: 0,
            classesToday: 0,
            attendanceStreak: 0
          },
          lastUpdated: new Date()
        };
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true, // Keep showing old data while fetching new
      onError: (err) => {
        logger.error('SWR error in student dashboard:', err);
      },
      errorRetryCount: 2,
      errorRetryInterval: 3000,
      fallbackData: {
        studentData: null,
        todayClasses: [],
        stats: {
          overallAttendance: 0,
          totalClasses: 0,
          classesToday: 0,
          attendanceStreak: 0
        },
        lastUpdated: null
      }
    }
  );

  // Real-time refresh functionality
  const startRealTimeRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    // Refresh every 30 seconds for real-time updates
    refreshIntervalRef.current = setInterval(() => {
      if (isRealTimeEnabled && user) {
        logger.log('🔄 Real-time refresh triggered');
        mutate(); // Use SWR's mutate for refresh
      }
    }, 30000); // 30 seconds
  }, [isRealTimeEnabled, user, mutate]);

  const stopRealTimeRefresh = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // Real-time refresh management
  useEffect(() => {
    if (isRealTimeEnabled && user) {
      startRealTimeRefresh();
    } else {
      stopRealTimeRefresh();
    }

    return () => {
      stopRealTimeRefresh();
    };
  }, [isRealTimeEnabled, user, startRealTimeRefresh, stopRealTimeRefresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRealTimeRefresh();
    };
  }, [stopRealTimeRefresh]);

  // Extract data with defaults
  const studentData = data?.studentData || null;
  const todayClasses = data?.todayClasses || [];
  const stats = data?.stats || {
    overallAttendance: 0,
    totalClasses: 0,
    classesToday: 0,
    attendanceStreak: 0
  };
  const lastUpdated = data?.lastUpdated || null;

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // statsLoading is the same as isLoading for this implementation
  const statsLoading = isLoading;

  return {
    studentData,
    todayClasses,
    stats,
    userProfile,
    isLoading,
    statsLoading,
    refreshData,
    setUserProfile,
    isRealTimeEnabled,
    lastUpdated
  };
}