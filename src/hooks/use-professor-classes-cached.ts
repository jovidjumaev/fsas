import { useCallback } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-professor-classes-cached');

interface ClassData {
  id: string;
  code: string;
  name: string;
  description: string;
  credits: number;
  class_code: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  room_location: string;
  max_students: number;
  enrolled_students: number;
  capacity_percentage: number;
  attendance_rate: number;
  total_sessions: number;
  active_sessions: number;
  academic_period: string;
  is_active: boolean;
  created_at: string;
  status?: 'active' | 'inactive' | 'completed';
  is_pinned?: boolean;
  performance_grade?: 'excellent' | 'good' | 'average' | 'needs_attention';
  next_session?: {
    date: string;
    start_time: string;
  };
}

interface AcademicPeriod {
  id: string;
  name: string;
  year: number;
  semester: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
}

interface UseProfessorClassesReturn {
  classes: ClassData[];
  availableCourses: any[];
  academicPeriods: AcademicPeriod[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

// Fetcher functions for SWR
const classesFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch classes: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch classes');
  }

  return data.data || [];
};

const coursesFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    logger.error('Failed to fetch courses:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.data || [];
};

const periodsFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    logger.error('Failed to fetch periods:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.data || [];
};

export function useProfessorClasses(user: User | null): UseProfessorClassesReturn {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Build API URLs
  const classesUrl = user ? `${apiBase}/api/professors/${user.id}/classes` : null;
  const coursesUrl = user ? `${apiBase}/api/courses` : null;
  const periodsUrl = user ? `${apiBase}/api/academic-periods` : null;

  // Fetch classes data with SWR
  const {
    data: classesData,
    error: classesError,
    isLoading: classesLoading,
    mutate: mutateClasses
  } = useSWR(
    classesUrl,
    classesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true,
      fallbackData: []
    }
  );

  // Fetch available courses with SWR
  const {
    data: coursesData
  } = useSWR(
    coursesUrl,
    coursesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // Cache for 5 minutes (rarely changes)
      fallbackData: []
    }
  );

  // Fetch academic periods with SWR
  const {
    data: periodsData
  } = useSWR(
    periodsUrl,
    periodsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 300000, // Cache for 5 minutes (rarely changes)
      fallbackData: []
    }
  );

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutateClasses();
  }, [mutateClasses]);

  // Convert error to string format
  const errorString = classesError
    ? (classesError instanceof Error ? classesError.message : 'Failed to fetch classes')
    : null;

  return {
    classes: classesData || [],
    availableCourses: coursesData || [],
    academicPeriods: periodsData || [],
    isLoading: classesLoading,
    error: errorString,
    refreshData
  };
}