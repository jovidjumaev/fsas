import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { StudentClassesService, StudentClass, ClassStats } from '@/lib/student-classes-service';
import { createLogger } from '../lib/logger';
const logger = createLogger('use-student-classes');

interface UseStudentClassesReturn {
  classes: StudentClass[];
  stats: ClassStats;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export function useStudentClasses(user: User | null): UseStudentClassesReturn {
  const [classes, setClasses] = useState<StudentClass[]>([]);
  const [stats, setStats] = useState<ClassStats>({
    totalClasses: 0,
    averageAttendance: 0,
    favoriteClasses: 0,
    upcomingClasses: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await StudentClassesService.getAllClassesData(user.id);
      
      setClasses(data.classes);
      setStats(data.stats);

    } catch (error) {
      logger.error('Error fetching classes data:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch classes');
      setClasses([]);
      setStats({
        totalClasses: 0,
        averageAttendance: 0,
        favoriteClasses: 0,
        upcomingClasses: 0
      });
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refreshData = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    classes,
    stats,
    isLoading,
    error,
    refreshData
  };
}
