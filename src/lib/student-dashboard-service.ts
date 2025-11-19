import { supabase } from './supabase';
import { createLogger } from './logger';
const logger = createLogger('student-dashboard-service');

export interface StudentData {
  // UUID primary key of students table (FK target from enrollments.student_id)
  id?: string;
  student_id: string;
  student_number: string;
  enrollment_year: number;
  major: string;
  graduation_year: number | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  account_created: string;
}

export interface ClassSession {
  id: string;
  class_code: string;
  class_name: string;
  time: string;
  room: string;
  professor: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  class_name: string;
  scanned_at?: string;
}

export interface AttendanceStats {
  overallAttendance: number;
  totalClasses: number;
  classesToday: number;
  attendanceStreak: number;
}

export class StudentDashboardService {
  static async getStudentData(userId: string): Promise<StudentData | null> {
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          student_id,
          enrollment_year,
          major,
          gpa,
          graduation_date,
          created_at,
          users!inner(
            first_name,
            last_name,
            email,
            is_active,
            created_at
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        logger.error('Error fetching student data:', error);
        return null;
      }

      return {
        id: data.id,
        student_id: data.student_id,
        student_number: data.student_id, // Use student_id as student_number
        enrollment_year: data.enrollment_year,
        major: data.major,
        graduation_year: data.graduation_date ? new Date(data.graduation_date).getFullYear() : null,
        first_name: data.users.first_name,
        last_name: data.users.last_name,
        email: data.users.email,
        phone: '', // Phone field not available in users table
        is_active: data.users.is_active,
        account_created: data.users.created_at
      };
    } catch (error) {
      logger.error('Error in getStudentData:', error);
      return null;
    }
  }

  static async getTodayClasses(userId: string): Promise<ClassSession[]> {
    try {
      logger.log('🔍 getTodayClasses: Starting for user:', userId);
      
      // Get today's date and day of week
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ...
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[dayOfWeek];
      
      logger.log('🔍 getTodayClasses: Today is', todayName, todayString);
      logger.log('🔍 getTodayClasses: Current time:', today.toISOString());
      logger.log('🔍 getTodayClasses: Day of week:', dayOfWeek);

      // Get enrollments for this student, filtering out null class_instance_id values
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select(`
          class_instance_id,
          class_instances!inner(
            id,
            days_of_week,
            first_class_date,
            last_class_date,
            start_time,
            end_time,
            room_location,
            professor_id,
            courses(code, name)
          )
        `)
        .eq('student_id', userId)
        .eq('status', 'active')
        .not('class_instance_id', 'is', null); // Filter out null class_instance_id values

      if (enrollmentError) {
        logger.error('Error fetching enrollments:', enrollmentError);
        return [];
      }

      logger.log('🔍 getTodayClasses: Got enrollments:', enrollments.length);

      // Get all professor IDs
      const professorIds = [...new Set(enrollments.map(e => e.class_instances.professor_id).filter(Boolean))];
      logger.log('🔍 getTodayClasses: Professor IDs found:', professorIds.length);

      // Get professor information with cache busting
      const timestamp = Date.now();
      const { data: professors, error: professorsError } = await supabase
        .from('users')
        .select('id, first_name, last_name, email, role')
        .in('id', professorIds)
        .gte('created_at', '2020-01-01'); // Add filter to bust cache

      if (professorsError) {
        logger.error('Error fetching professors:', professorsError);
        return [];
      }

      logger.log('🔍 getTodayClasses: Professors loaded:', professors.length);

      // Create professor lookup map
      const professorMap: { [key: string]: any } = {};
      professors.forEach(prof => {
        professorMap[prof.id] = prof;
      });

      // Filter classes that actually meet today
      const todayClasses: ClassSession[] = [];
      
      for (const enrollment of enrollments) {
        const classInstance = enrollment.class_instances;
        const daysOfWeek = classInstance.days_of_week;
        const firstClassDate = classInstance.first_class_date;
        const lastClassDate = classInstance.last_class_date;
        const startTime = classInstance.start_time;
        const endTime = classInstance.end_time;
        
        logger.log('🔍 Checking class', classInstance.courses.code, 'with schedule:', { daysOfWeek, firstClassDate, lastClassDate });

        // Check if today is within the class period and matches the schedule
        const withinPeriod = todayString >= firstClassDate && todayString <= lastClassDate;
        const matchesSchedule = Array.isArray(daysOfWeek) && daysOfWeek.includes(todayName);
        
        const meetsToday = withinPeriod && matchesSchedule;
        
        if (meetsToday) {
          logger.log('✅ Class', classInstance.courses.code, 'meets today!');
          
          const professor = professorMap[classInstance.professor_id];
          const professorName = professor ? 
            `${professor.first_name} ${professor.last_name}` : 
            'TBD';
          
          todayClasses.push({
            id: classInstance.id,
            class_code: classInstance.courses.code,
            class_name: classInstance.courses.name,
            time: `${startTime || 'TBD'} - ${endTime || 'TBD'}`,
            room: classInstance.room_location || 'TBD',
            professor: professorName,
            status: 'upcoming' as const
          });
        } else {
          logger.log('❌ Class', classInstance.courses.code, 'does not meet today');
        }
      }

      logger.log('🔍 getTodayClasses: Found', todayClasses.length, 'classes for today');
      todayClasses.forEach(cls => {
        logger.log('🔍 getTodayClasses: Class found:', cls.class_code, cls.class_name, 'Professor:', cls.professor);
      });
      
      return todayClasses;
    } catch (error) {
      logger.error('Error in getTodayClasses:', error);
      return [];
    }
  }

  static async getRecentAttendance(userId: string, limit: number = 6): Promise<AttendanceRecord[]> {
    try {
      logger.log('🔍 getRecentAttendance: Starting for user:', userId);
      
      // Use userId directly (UUID) for attendance_records.student_id
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          class_sessions!inner(
            date,
            class_instances!inner(
              courses(code, name)
            )
          )
        `)
        .eq('student_id', userId) // userId is the UUID that matches attendance_records.student_id
        .order('scanned_at', { ascending: false })
        .limit(limit);

      if (attendanceError) {
        logger.error('Error fetching attendance:', attendanceError);
        return [];
      }

      const recentAttendance = attendanceData.map(record => ({
        date: record.class_sessions.date,
        status: record.status as 'present' | 'absent' | 'late' | 'excused',
        class_name: record.class_sessions.class_instances.courses.name,
        scanned_at: record.scanned_at
      }));

      logger.log('🔍 getRecentAttendance: Found', recentAttendance.length, 'records');
      return recentAttendance;
    } catch (error) {
      logger.error('Error in getRecentAttendance:', error);
      return [];
    }
  }

  static async getAttendanceStats(userId: string): Promise<AttendanceStats> {
    try {
      logger.log('🔍 getAttendanceStats: Starting for user:', userId);
      
      // Get all attendance records for this student using userId (UUID)
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          class_sessions!inner(
            date,
            status,
            class_instance_id,
            class_instances!inner(
              courses(code, name)
            )
          )
        `)
        .eq('student_id', userId) // userId is the UUID that matches attendance_records.student_id
        .order('scanned_at', { ascending: false });

      if (attendanceError) {
        logger.error('Error fetching attendance records:', attendanceError);
        throw attendanceError;
      }

      // Get active enrollments using userId (UUID), filtering out null class_instance_id values
      const { data: enrollments, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('class_instance_id')
        .eq('student_id', userId) // userId is the UUID that matches enrollments.student_id
        .eq('status', 'active')
        .not('class_instance_id', 'is', null); // Filter out enrollments with null class_instance_id

      if (enrollmentError) {
        logger.error('Error fetching enrollments:', enrollmentError);
        throw enrollmentError;
      }

      // Get today's classes
      const todayClasses = await this.getTodayClasses(userId);

      // Calculate overall attendance
      const totalRecords = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
      const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
      const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
      const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
      
      const overallAttendance = totalRecords > 0 
        ? Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100)
        : 0;

      // Calculate attendance streak
      const attendanceStreak = this.calculateAttendanceStreak(attendanceRecords);

      const stats: AttendanceStats = {
        overallAttendance,
        totalClasses: enrollments.length,
        classesToday: todayClasses.length,
        attendanceStreak
      };

      logger.log('🔍 getAttendanceStats: Calculated stats:', stats);
      return stats;
    } catch (error) {
      logger.error('Error calculating attendance stats:', error);
      return {
        overallAttendance: 0,
        totalClasses: 0,
        classesToday: 0,
        attendanceStreak: 0
      };
    }
  }

  // Calculate attendance streak (consecutive days with attendance)
  private static calculateAttendanceStreak(attendanceRecords: any[]): number {
    if (attendanceRecords.length === 0) return 0;

    // Group records by date
    const recordsByDate = new Map<string, any[]>();
    attendanceRecords.forEach(record => {
      const date = record.class_sessions.date;
      if (!recordsByDate.has(date)) {
        recordsByDate.set(date, []);
      }
      recordsByDate.get(date)!.push(record);
    });

    // Sort dates in descending order
    const sortedDates = Array.from(recordsByDate.keys()).sort((a, b) => b.localeCompare(a));

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const date of sortedDates) {
      const dayRecords = recordsByDate.get(date)!;
      const hasAttendance = dayRecords.some(record => 
        ['present', 'late', 'excused'].includes(record.status)
      );

      if (hasAttendance) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  static async getAllDashboardData(userId: string) {
    try {
      logger.log('🔍 getAllDashboardData: Starting for user:', userId);
      
      // Get student data
      const studentData = await this.getStudentData(userId);
      if (!studentData) {
        throw new Error('Student data not found');
      }

      // Get today's classes
      const todayClasses = await this.getTodayClasses(userId);
      
      // Get recent attendance records
      const recentAttendance = await this.getRecentAttendance(userId, 10);
      
      // Calculate comprehensive stats
      const stats = await this.getAttendanceStats(userId);

      logger.log('🔍 getAllDashboardData: Returning comprehensive data with stats:', stats);
      return {
        studentData,
        todayClasses,
        recentAttendance,
        stats
      };
    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  // Helper function to check if attendance has been taken for this student today
  private static async checkAttendanceForToday(studentId: string): Promise<boolean> {
    try {
      logger.log('🔍 checkAttendanceForToday: Checking studentId:', studentId);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      logger.log('🔍 checkAttendanceForToday: Today is:', today);
      
      // Check if there are any attendance records for this student today
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/attendance/student/${studentId}?limit=20`);
      logger.log('🔍 checkAttendanceForToday: API response status:', response.status);
      
      const data = await response.json();
      logger.log('🔍 checkAttendanceForToday: API response data:', data);
      
      if (data.success && data.attendance && data.attendance.length > 0) {
        logger.log('🔍 checkAttendanceForToday: Found', data.attendance.length, 'records');
        // Check if any record is from today
        const todayRecord = data.attendance.find((record: any) => {
          const recordDate = new Date(record.scanned_at).toISOString().split('T')[0];
          logger.log('🔍 checkAttendanceForToday: Checking record date:', recordDate, 'vs today:', today);
          return recordDate === today;
        });
        logger.log('🔍 checkAttendanceForToday: Found today record:', !!todayRecord);
        return !!todayRecord;
      }
      
      logger.log('🔍 checkAttendanceForToday: No records found or API failed');
      return false;
    } catch (error) {
      logger.error('Error checking attendance for today:', error);
      return false;
    }
  }

  // Helper function to format time
  private static formatTime(timeString: string): string {
    const [hourString, minuteString] = timeString.split(':');
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  }
}
