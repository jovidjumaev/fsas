import { useCallback } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { StudentAttendanceService, AttendanceRecord, AttendanceStats } from '@/lib/student-attendance-service';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-student-attendance-cached');

interface UseStudentAttendanceReturn {
  attendanceRecords: AttendanceRecord[];
  stats: AttendanceStats;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

// This is a drop-in replacement for useStudentAttendance that adds caching
// without changing the data structure or UI

export function useStudentAttendance(user: User | null): UseStudentAttendanceReturn {
  // Use SWR for caching the data
  const { data, error, isLoading, mutate } = useSWR(
    user ? ['student-attendance-cached', user.id] : null,
    async () => {
      if (!user) return null;

      logger.debug('Fetching attendance data for user:', user.id);

      // Fetch both records and stats in parallel like the original hook
      const [records, stats] = await Promise.all([
        StudentAttendanceService.getStudentAttendanceRecords(user.id),
        StudentAttendanceService.getStudentAttendanceStats(user.id)
      ]);

      logger.debug('Attendance data fetched:', { records: records.length, stats });
      return { records, stats };
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true, // Keep showing old data while fetching new
      fallbackData: {
        records: [],
        stats: {
          totalClasses: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0
        }
      }
    }
  );

  // Extract data with defaults
  const attendanceRecords = data?.records || [];
  const stats = data?.stats || {
    totalClasses: 0,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: 0
  };

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Convert error to string format
  const errorString = error ? (error instanceof Error ? error.message : 'An unknown error occurred.') : null;

  return {
    attendanceRecords,
    stats,
    isLoading,
    error: errorString,
    refreshData
  };
}