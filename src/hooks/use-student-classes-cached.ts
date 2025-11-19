import { useCallback } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { StudentClassesService, StudentClass, ClassStats } from '@/lib/student-classes-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-student-classes-cached');

interface UseStudentClassesReturn {
  classes: StudentClass[];
  stats: ClassStats;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

// This is a drop-in replacement for useStudentClasses that adds caching
// without changing the data structure or UI

export function useStudentClasses(user: User | null): UseStudentClassesReturn {
  // Use SWR for caching the data
  const { data, error, isLoading, mutate } = useSWR(
    user ? ['student-classes-cached', user.id] : null,
    async () => {
      if (!user) return null;

      logger.debug('Fetching classes data for user:', user.id);

      // Fetch classes data using the service
      const result = await StudentClassesService.getAllClassesData(user.id);

      logger.debug('Classes data fetched:', {
        classesCount: result.classes.length,
        stats: result.stats
      });

      return result;
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true, // Keep showing old data while fetching new
      fallbackData: {
        classes: [],
        stats: {
          totalClasses: 0,
          averageAttendance: 0,
          favoriteClasses: 0,
          upcomingClasses: 0
        }
      }
    }
  );

  // Extract data with defaults
  const classes = data?.classes || [];
  const stats = data?.stats || {
    totalClasses: 0,
    averageAttendance: 0,
    favoriteClasses: 0,
    upcomingClasses: 0
  };

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Convert error to string format
  const errorString = error ? (error instanceof Error ? error.message : 'Failed to fetch classes') : null;

  return {
    classes,
    stats,
    isLoading,
    error: errorString,
    refreshData
  };
}