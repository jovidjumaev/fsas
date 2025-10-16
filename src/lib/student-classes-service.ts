import { supabase } from './supabase';

export interface StudentClass {
  id: string;
  class_id: string; // Add class_id for detailed view
  class_code: string;
  class_name: string;
  description: string;
  credits: number;
  professor: string;
  professor_email: string;
  room: string;
  schedule: string;
  department: string;
  department_code: string;
  academic_period: string;
  enrollment_date: string;
  attendance_rate: number;
  total_sessions: number;
  attended_sessions: number;
  max_students: number;
  current_enrollment: number;
}

export interface ClassStats {
  totalClasses: number;
  averageAttendance: number;
  favoriteClasses: number;
  upcomingClasses: number;
}

export class StudentClassesService {
  /**
   * Get student ID from user ID
   * The enrollments table uses user_id as student_id
   */
  private static async getStudentId(userId: string): Promise<string | null> {
    try {
      // The enrollments table uses user_id as student_id
      // So we can directly use the userId
      return userId;
    } catch (error) {
      console.error('Error in getStudentId:', error);
      return null;
    }
  }

  /**
   * Get all classes for a student
   */
  static async getStudentClasses(userId: string): Promise<StudentClass[]> {
    try {
      console.log('🔍 StudentClassesService: Getting classes for user ID:', userId);
      
      const studentId = await this.getStudentId(userId);
      console.log('🔍 StudentClassesService: Student ID resolved to:', studentId);
      
      if (!studentId) {
        throw new Error('Student profile not found');
      }

      console.log('🔍 StudentClassesService: Fetching from API:', `/api/students/${studentId}/classes`);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/${studentId}/classes`);
      const result = await response.json();

      console.log('🔍 StudentClassesService: API response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch classes');
      }

      console.log('🔍 StudentClassesService: Returning classes:', result.classes?.length || 0);
      return result.classes || [];
    } catch (error) {
      console.error('Error fetching student classes:', error);
      throw error;
    }
  }

  /**
   * Get class statistics for a student
   */
  static async getClassStats(userId: string): Promise<ClassStats> {
    try {
      const studentId = await this.getStudentId(userId);
      if (!studentId) {
        throw new Error('Student profile not found');
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/${studentId}/classes/stats`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch class statistics');
      }

      return result.stats || {
        totalClasses: 0,
        averageAttendance: 0,
        favoriteClasses: 0,
        upcomingClasses: 0
      };
    } catch (error) {
      console.error('Error fetching class stats:', error);
      throw error;
    }
  }

  /**
   * Get all data needed for the classes page
   */
  static async getAllClassesData(userId: string): Promise<{
    classes: StudentClass[];
    stats: ClassStats;
  }> {
    try {
      const [classes, stats] = await Promise.all([
        this.getStudentClasses(userId),
        this.getClassStats(userId)
      ]);

      return {
        classes,
        stats
      };
    } catch (error) {
      console.error('Error fetching all classes data:', error);
      throw error;
    }
  }
}
