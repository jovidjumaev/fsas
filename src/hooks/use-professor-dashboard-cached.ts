import { useCallback, useState, useEffect } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-professor-dashboard-cached');

interface ProfessorStats {
  totalClasses: number;
  totalStudents: number;
  activeSessions: number;
  averageAttendance: number;
}

interface ClassData {
  id: string;
  code: string;
  name: string;
  room_location: string;
  schedule_info: string;
  enrolled_students: number;
  max_students: number;
  attendance_rate: number;
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
  next_session?: {
    date: string;
    start_time: string;
    end_time: string;
  };
  status: 'active' | 'upcoming' | 'completed';
  isToday?: boolean;
  today_session_id?: string | null;
  active_session_id?: string | null;
  has_active_session?: boolean;
  session_status?: 'not_started' | 'active' | 'completed';
}

interface ActiveSession {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  room_location: string;
  status: 'active' | 'scheduled' | 'completed';
  start_time: string;
  end_time: string;
  qr_code: string;
  enrolled_students: number;
  present_count: number;
  attendance_rate: number;
}

interface UseProfessorDashboardReturn {
  stats: ProfessorStats;
  myClasses: ClassData[];
  activeSessions: ActiveSession[];
  todayClasses: ClassData[];
  userProfile: any;
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  setUserProfile: (profile: any) => void;
}

// Fetcher function for SWR
const dashboardFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch dashboard data');
  }

  return data.data;
};

export function useProfessorDashboard(user: User | null): UseProfessorDashboardReturn {
  const [userProfile, setUserProfile] = useState<any>(null);

  // Build API URL
  const apiUrl = user
    ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/professors/${user.id}/dashboard`
    : null;

  // Use SWR for caching dashboard data
  const { data, error, isLoading, mutate } = useSWR(
    apiUrl,
    dashboardFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true, // Keep showing old data while fetching new
      fallbackData: {
        stats: {
          totalClasses: 0,
          totalStudents: 0,
          activeSessions: 0,
          averageAttendance: 0
        },
        classes: [],
        activeSessions: [],
        todayClasses: []
      }
    }
  );

  // Extract data with defaults
  const stats = data?.stats || {
    totalClasses: 0,
    totalStudents: 0,
    activeSessions: 0,
    averageAttendance: 0
  };

  const myClasses = data?.classes || [];
  const activeSessions = data?.activeSessions || [];
  const todayClasses = data?.todayClasses || [];

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutate();
  }, [mutate]);

  // Convert error to string format
  const errorString = error ? (error instanceof Error ? error.message : 'Failed to fetch dashboard data') : null;

  return {
    stats,
    myClasses,
    activeSessions,
    todayClasses,
    userProfile,
    isLoading,
    error: errorString,
    refreshData,
    setUserProfile
  };
}