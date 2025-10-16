import { supabase } from './supabase';

export interface StudentData {
  // UUID primary key of students table (FK target from enrollments.student_id)
  id?: string;
  student_id: string;
  student_number: string;
  enrollment_year: number;
  major: string;
  graduation_year: number;
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
  status: 'present' | 'absent' | 'late';
  class_name: string;
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
          student_number,
          enrollment_year,
          major,
          graduation_year,
          users!inner(
            first_name,
            last_name,
            email,
            phone,
            is_active,
            created_at
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching student data:', error);
        return null;
      }

      return {
        id: data.id,
        student_id: data.student_id,
        student_number: data.student_number,
        enrollment_year: data.enrollment_year,
        major: data.major,
        graduation_year: data.graduation_year,
        first_name: data.users.first_name,
        last_name: data.users.last_name,
        email: data.users.email,
        phone: data.users.phone || '',
        is_active: data.users.is_active,
        account_created: data.users.created_at
      };
    } catch (error) {
      console.error('Error in getStudentData:', error);
      return null;
    }
  }

  static async getTodayClasses(userId: string): Promise<ClassSession[]> {
    try {
      console.log('🔍 getTodayClasses: Starting for user:', userId);
      
      // Get today's date and day of week
      const today = new Date();
      const todayString = today.toISOString().split('T')[0]; // YYYY-MM-DD
      const dayOfWeek = today.getDay(); // 0=Sunday, 1=Monday, ...
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[dayOfWeek];
      
      console.log('🔍 getTodayClasses: Today is', todayName, todayString);

      // Resolve the correct student identifier for the API (enrollments.student_id)
      const studentRecord = await this.getStudentData(userId);
      // Use students.id (UUID) expected by enrollments.student_id FK
      const apiStudentId = studentRecord?.id || userId;

      // Get the student's enrolled classes
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/${apiStudentId}/classes`);
      const classesData = await response.json();
      
      if (!classesData.success) {
        console.error('Failed to fetch student classes for today classes');
        return [];
      }

      console.log('🔍 getTodayClasses: Got classes data:', classesData);

      // Filter classes that actually meet today
      const todayClasses: ClassSession[] = [];
      
      for (const cls of classesData.classes) {
        const schedule = cls.schedule || '';
        const daysOfWeek = cls.days_of_week as string[] | string | null | undefined;
        const startTime = cls.start_time as string | null | undefined;
        const endTime = cls.end_time as string | null | undefined;
        console.log('🔍 Checking class', cls.class_code, 'with schedule:', { schedule, daysOfWeek, startTime, endTime });

        // Simplified day matching logic
        const todayMatchesStructured = (() => {
          if (!daysOfWeek) return false;
          if (Array.isArray(daysOfWeek)) {
            // Direct comparison with today's day name
            return daysOfWeek.includes(todayName);
          }
          return false;
        })();

        // Fallback to legacy string matching if structured days are missing
        const todayMatchesLegacy = (() => {
          let meets = false;
          if (schedule.includes('Mon/Wed') && (todayName === 'Monday' || todayName === 'Wednesday')) meets = true;
          else if ((schedule.includes('TTh') || schedule.includes('Tue/Thu') || schedule.includes('Tue & Thu')) && (todayName === 'Tuesday' || todayName === 'Thursday')) meets = true;
          else if (schedule.includes('MWF') && (todayName === 'Monday' || todayName === 'Wednesday' || todayName === 'Friday')) meets = true;
          else if (schedule.includes('Mon') && todayName === 'Monday') meets = true;
          else if (schedule.includes('Tue') && todayName === 'Tuesday') meets = true;
          else if (schedule.includes('Wed') && todayName === 'Wednesday') meets = true;
          else if (schedule.includes('Thu') && todayName === 'Thursday') meets = true;
          else if (schedule.includes('Fri') && todayName === 'Friday') meets = true;
          return meets;
        })();

        const meetsToday = todayMatchesStructured || todayMatchesLegacy;
        
        if (meetsToday) {
          console.log('✅ Class', cls.class_code, 'meets today!');
          
          // Create a compact schedule string for display
          const scheduleDisplay = (startTime && endTime) 
            ? `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`
            : (cls.schedule || 'TBD');
          
          // Check if attendance has been taken for this student today (any class)
          // Use the student_id field (like "5002378") for the attendance API
          console.log('🔍 getTodayClasses: studentRecord:', studentRecord);
          console.log('🔍 getTodayClasses: studentRecord?.student_id:', studentRecord?.student_id);
          const hasAttendanceToday = await this.checkAttendanceForToday(studentRecord?.student_id || '5002378');
          
          todayClasses.push({
            id: cls.class_id || cls.id,
            class_id: cls.class_id || cls.id,
            class_code: cls.class_code,
            class_name: cls.class_name,
            description: cls.description || '',
            credits: cls.credits || 3,
            professor: cls.professor || 'TBD',
            professor_email: cls.professor_email || '',
            room: cls.room || 'TBD',
            schedule: scheduleDisplay,
            department: cls.department || '',
            department_code: cls.department_code || '',
            academic_period: cls.academic_period || '',
            enrollment_date: cls.enrollment_date || '',
            attendance_rate: cls.attendance_rate || 0,
            total_sessions: cls.total_sessions || 0,
            attended_sessions: cls.attended_sessions || 0,
            max_students: cls.max_students || 0,
            current_enrollment: cls.current_enrollment || 0,
            hasAttendanceToday: hasAttendanceToday
          });
        } else {
          console.log('❌ Class', cls.class_code, 'does not meet today');
        }
      }

      console.log('🔍 getTodayClasses: Found', todayClasses.length, 'classes for today:', todayClasses);
      
      // Debug: Log each class and why it was included/excluded
      classesData.classes.forEach((cls, index) => {
        console.log(`🔍 Class ${index + 1}: ${cls.class_code}`);
        console.log(`  - Days of week:`, cls.days_of_week);
        console.log(`  - Schedule:`, cls.schedule);
        console.log(`  - Start time:`, cls.start_time);
        console.log(`  - End time:`, cls.end_time);
      });
      
      return todayClasses;
    } catch (error) {
      console.error('Error in getTodayClasses:', error);
      return [];
    }
  }

  static async getRecentAttendance(userId: string, limit: number = 6): Promise<AttendanceRecord[]> {
    try {
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          date,
          status,
          class_sessions!inner(class_name)
        `)
        .eq('student_id', userId)
        .order('date', { ascending: false })
        .limit(limit);

      if (attendanceError) {
        console.error('Error fetching attendance:', attendanceError);
        return [];
      }

      return attendanceData.map(record => ({
        date: record.date,
        status: record.status as 'present' | 'absent' | 'late',
        class_name: record.class_sessions.class_name
      }));
    } catch (error) {
      console.error('Error in getRecentAttendance:', error);
      return [];
    }
  }

  static async getAttendanceStats(userId: string): Promise<AttendanceStats> {
    try {
      // Get today's classes count
      const todayClasses = await this.getTodayClasses(userId);
      
      // Get overall stats from database function
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_student_attendance_stats', { student_id_param: userId });

      if (statsError) {
        console.error('Error fetching stats:', statsError);
        return {
          overallAttendance: 0,
          totalClasses: 0,
          classesToday: todayClasses.length,
          attendanceStreak: 0
        };
      }

      const stats = statsData[0] || {};
      
      return {
        overallAttendance: Math.round(stats.overall_attendance || 0),
        totalClasses: stats.total_classes || 0,
        classesToday: todayClasses.length,
        attendanceStreak: stats.attendance_streak || 0
      };
    } catch (error) {
      console.error('Error in getAttendanceStats:', error);
      return {
        overallAttendance: 0,
        totalClasses: 0,
        classesToday: 0,
        attendanceStreak: 0
      };
    }
  }

  static async getAllDashboardData(userId: string) {
    try {
      console.log('🔍 getAllDashboardData: Starting for user:', userId);
      
      // Resolve the correct student identifier for the API (enrollments.student_id)
      const studentRecord = await this.getStudentData(userId);
      const apiStudentId = studentRecord?.id || userId;

      // Use the working student classes API to get real data
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/${apiStudentId}/classes`);
      const classesData = await response.json();
      
      if (!classesData.success) {
        throw new Error('Failed to fetch student classes');
      }

      console.log('🔍 getAllDashboardData: Got classes data:', classesData);

      // Get student data from the classes response
      const studentData = await this.getStudentData(userId);
      
      // Calculate real stats from classes data
      const totalClasses = classesData.classes.length;
      const totalSessions = classesData.classes.reduce((sum: number, cls: any) => sum + cls.total_sessions, 0);
      const attendedSessions = classesData.classes.reduce((sum: number, cls: any) => sum + cls.attended_sessions, 0);
      const overallAttendance = totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;

      // Get today's classes with real data
      console.log('🔍 getAllDashboardData: About to call getTodayClasses');
      const todayClasses = await this.getTodayClasses(userId);
      console.log('🔍 getAllDashboardData: Got todayClasses:', todayClasses);

      const stats: AttendanceStats = {
        overallAttendance,
        totalClasses,
        classesToday: todayClasses.length,
        attendanceStreak: 0 // TODO: Calculate actual streak
      };

      console.log('🔍 getAllDashboardData: Returning real data with stats:', stats);
      return {
        studentData,
        todayClasses,
        recentAttendance: [], // TODO: Get recent attendance
        stats
      };
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  // Helper function to check if attendance has been taken for this student today
  private static async checkAttendanceForToday(studentId: string): Promise<boolean> {
    try {
      console.log('🔍 checkAttendanceForToday: Checking studentId:', studentId);
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      console.log('🔍 checkAttendanceForToday: Today is:', today);
      
      // Check if there are any attendance records for this student today
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/attendance/student/${studentId}?limit=20`);
      console.log('🔍 checkAttendanceForToday: API response status:', response.status);
      
      const data = await response.json();
      console.log('🔍 checkAttendanceForToday: API response data:', data);
      
      if (data.success && data.attendance && data.attendance.length > 0) {
        console.log('🔍 checkAttendanceForToday: Found', data.attendance.length, 'records');
        // Check if any record is from today
        const todayRecord = data.attendance.find((record: any) => {
          const recordDate = new Date(record.scanned_at).toISOString().split('T')[0];
          console.log('🔍 checkAttendanceForToday: Checking record date:', recordDate, 'vs today:', today);
          return recordDate === today;
        });
        console.log('🔍 checkAttendanceForToday: Found today record:', !!todayRecord);
        return !!todayRecord;
      }
      
      console.log('🔍 checkAttendanceForToday: No records found or API failed');
      return false;
    } catch (error) {
      console.error('Error checking attendance for today:', error);
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
