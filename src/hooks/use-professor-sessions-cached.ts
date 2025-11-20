import { useCallback } from 'react';
import useSWR from 'swr';
import { User } from '@supabase/supabase-js';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-professor-sessions-cached');

interface Session {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  date: string;
  start_time: string;
  end_time: string;
  room_location: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  attendance_count: number;
  enrolled_students: number;
  attendance_rate: number;
  qr_code?: string;
  created_at: string;
  updated_at: string;
}

interface UseProfessorSessionsReturn {
  sessions: Session[];
  classes: any[];
  isLoading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

// Fetcher functions for SWR
const sessionsFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sessions: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.message || 'Failed to fetch sessions');
  }

  return data.data || [];
};

const classesFetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    logger.error('Failed to fetch classes for sessions:', response.statusText);
    return [];
  }

  const data = await response.json();
  return data.data || [];
};

export function useProfessorSessions(user: User | null): UseProfessorSessionsReturn {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  // Build API URLs
  const sessionsUrl = user ? `${apiBase}/api/professors/${user.id}/sessions` : null;
  const classesUrl = user ? `${apiBase}/api/professors/${user.id}/classes` : null;

  // Fetch sessions data with SWR
  const {
    data: sessionsData,
    error: sessionsError,
    isLoading: sessionsLoading,
    mutate: mutateSessions
  } = useSWR(
    sessionsUrl,
    sessionsFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      keepPreviousData: true,
      fallbackData: [],
      refreshInterval: 30000 // Auto-refresh every 30 seconds for active sessions
    }
  );

  // Fetch classes data with SWR (for filtering)
  const {
    data: classesData
  } = useSWR(
    classesUrl,
    classesFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // Cache for 1 minute
      fallbackData: []
    }
  );

  // Refresh function
  const refreshData = useCallback(async () => {
    await mutateSessions();
  }, [mutateSessions]);

  // Convert error to string format
  const errorString = sessionsError
    ? (sessionsError instanceof Error ? sessionsError.message : 'Failed to fetch sessions')
    : null;

  return {
    sessions: sessionsData || [],
    classes: classesData || [],
    isLoading: sessionsLoading,
    error: errorString,
    refreshData
  };
}