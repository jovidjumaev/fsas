import { supabase } from './supabase';
import { createLogger } from './logger';
const logger = createLogger('student-class-detail-service');

export interface ClassSession {
  id: string;
  session_number: number;
  date: string;
  start_time: string;
  end_time: string;
  room_location: string;
  status: string;
  notes?: string;
  is_active: boolean;
  attendance_count: number;
  total_enrolled: number;
  is_past: boolean;
  is_today: boolean;
  attendance?: {
    status: string;
    scanned_at: string;
    minutes_late: number;
    status_change_reason?: string;
  } | null;
}

export interface ClassDetail {
  id: string;
  class_code: string;
  class_name: string;
  description: string;
  credits: number;
  professor: string;
  professor_email: string;
  room: string;
  schedule: string;
  academic_period: string;
  max_students: number;
  current_enrollment: number;
  enrollment_date?: string;
  enrollment_status?: string;
}

export interface AttendanceStats {
  total_sessions: number;
  attended_sessions: number;
  attendance_rate: number;
}

export interface ClassDetailResponse {
  class: ClassDetail;
  attendance_stats: AttendanceStats;
  past_sessions: ClassSession[];
  upcoming_sessions: ClassSession[];
}

export class StudentClassDetailService {
  /**
   * Get detailed class information including attendance history and upcoming sessions
   */
  static async getClassDetail(userId: string, classInstanceId: string): Promise<ClassDetailResponse> {
    try {
      logger.log('🔍 StudentClassDetailService: Getting class detail for user:', userId, 'class:', classInstanceId);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/${userId}/classes/${classInstanceId}`);
      const result = await response.json();

      logger.log('🔍 StudentClassDetailService: API response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch class details');
      }

      return result;
    } catch (error) {
      logger.error('Error fetching class details:', error);
      throw error;
    }
  }

  /**
   * Get attendance status color for UI
   */
  static getAttendanceStatusColor(status: string): string {
    switch (status) {
      case 'present':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30';
      case 'late':
        return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30';
      case 'absent':
        return 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30';
      case 'excused':
        return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  }

  /**
   * Format date for display
   */
  static formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format time for display
   */
  static formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours), parseInt(minutes));
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Get session status text
   */
  static getSessionStatusText(session: ClassSession): string {
    if (session.is_today) {
      return 'Today';
    } else if (session.is_past) {
      return 'Completed';
    } else {
      return 'Upcoming';
    }
  }
}
