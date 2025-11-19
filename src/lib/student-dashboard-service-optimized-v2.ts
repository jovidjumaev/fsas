import { supabase } from './supabase';
import { createLogger } from './logger';

const logger = createLogger('student-dashboard-optimized-v2');

export interface StudentData {
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

export class OptimizedStudentDashboardServiceV2 {
  /**
   * OPTIMIZED V2: Uses 3-4 parallel queries with simpler structure
   * More reliable than complex nested queries
   */
  static async getAllDashboardDataOptimized(userId: string) {
    try {
      logger.log('⚡ Starting optimized V2 dashboard data fetch for user:', userId);
      const startTime = Date.now();

      // Prepare today's date info
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = dayNames[today.getDay()];

      // QUERY 1: Student basic data
      const studentPromise = supabase
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

      // QUERY 2: Enrollments with class details (for today's classes and stats)
      const enrollmentsPromise = supabase
        .from('enrollments')
        .select(`
          id,
          status,
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
            courses(
              code,
              name,
              description
            )
          )
        `)
        .eq('student_id', userId)
        .eq('status', 'active')
        .not('class_instance_id', 'is', null);

      // QUERY 3: Recent attendance records
      const attendancePromise = supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          scanned_at,
          class_sessions!inner(
            date,
            status,
            class_instances!inner(
              courses(
                code,
                name
              )
            )
          )
        `)
        .eq('student_id', userId)
        .order('scanned_at', { ascending: false });

      // Execute all queries in parallel
      logger.log('⚡ Executing 3 parallel queries...');
      const [studentResult, enrollmentsResult, attendanceResult] = await Promise.all([
        studentPromise,
        enrollmentsPromise,
        attendancePromise
      ]);

      const queryTime = Date.now() - startTime;
      logger.log(`⚡ Base queries completed in ${queryTime}ms`);

      // Handle errors
      if (studentResult.error) {
        logger.error('Error fetching student data:', studentResult.error);
        // Fallback to sequential queries if optimized version fails
        return this.fallbackToSequentialQueries(userId);
      }

      if (enrollmentsResult.error) {
        logger.error('Error fetching enrollments:', enrollmentsResult.error);
        return this.fallbackToSequentialQueries(userId);
      }

      if (attendanceResult.error) {
        logger.error('Error fetching attendance:', attendanceResult.error);
        // Continue without attendance data
        attendanceResult.data = [];
      }

      const studentRawData = studentResult.data;
      const enrollments = enrollmentsResult.data || [];
      const attendanceRecords = attendanceResult.data || [];

      // Get professor IDs and fetch professor details
      const professorIds = [...new Set(enrollments
        .map(e => e.class_instances?.professor_id)
        .filter(Boolean)
      )];

      let professors: any[] = [];
      if (professorIds.length > 0) {
        const { data: professorData } = await supabase
          .from('users')
          .select('id, first_name, last_name, email')
          .in('id', professorIds);
        professors = professorData || [];
      }

      // Create professor lookup map
      const professorMap: { [key: string]: any } = {};
      professors.forEach(prof => {
        professorMap[prof.id] = prof;
      });

      // Process student data
      const studentData: StudentData = {
        id: studentRawData.id,
        student_id: studentRawData.student_id,
        student_number: studentRawData.student_id,
        enrollment_year: studentRawData.enrollment_year,
        major: studentRawData.major,
        graduation_year: studentRawData.graduation_date
          ? new Date(studentRawData.graduation_date).getFullYear()
          : null,
        first_name: studentRawData.users.first_name,
        last_name: studentRawData.users.last_name,
        email: studentRawData.users.email,
        phone: '',
        is_active: studentRawData.users.is_active,
        account_created: studentRawData.users.created_at
      };

      // Process today's classes
      const todayClasses: ClassSession[] = [];
      for (const enrollment of enrollments) {
        if (!enrollment.class_instances) continue;

        const classInstance = enrollment.class_instances;
        const daysOfWeek = classInstance.days_of_week;
        const firstClassDate = classInstance.first_class_date;
        const lastClassDate = classInstance.last_class_date;

        // Check if class meets today
        const withinPeriod = todayString >= firstClassDate && todayString <= lastClassDate;
        const matchesSchedule = Array.isArray(daysOfWeek) && daysOfWeek.includes(todayName);

        if (withinPeriod && matchesSchedule) {
          const professor = professorMap[classInstance.professor_id];
          const professorName = professor
            ? `${professor.first_name} ${professor.last_name}`
            : 'TBD';

          todayClasses.push({
            id: classInstance.id,
            class_code: classInstance.courses.code,
            class_name: classInstance.courses.name,
            time: `${classInstance.start_time || 'TBD'} - ${classInstance.end_time || 'TBD'}`,
            room: classInstance.room_location || 'TBD',
            professor: professorName,
            status: 'upcoming'
          });
        }
      }

      // Process recent attendance
      const recentAttendance: AttendanceRecord[] = attendanceRecords
        .slice(0, 10)
        .map(record => ({
          date: record.class_sessions.date,
          status: record.status as 'present' | 'absent' | 'late' | 'excused',
          class_name: record.class_sessions.class_instances.courses.name,
          scanned_at: record.scanned_at
        }));

      // Calculate attendance stats
      const totalRecords = attendanceRecords.length;
      const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
      const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
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

      const totalTime = Date.now() - startTime;
      logger.log(`⚡ Total dashboard load time: ${totalTime}ms`);
      logger.log(`⚡ Optimization V2: Reduced from 12+ queries to 3-4 queries`);
      logger.log(`⚡ Found ${todayClasses.length} classes today, ${recentAttendance.length} recent attendance records`);

      return {
        studentData,
        todayClasses,
        recentAttendance,
        stats
      };
    } catch (error) {
      logger.error('Error in optimized V2 dashboard fetch:', error);
      // Fallback to original service if optimization fails
      return this.fallbackToSequentialQueries(userId);
    }
  }

  /**
   * Fallback to the original sequential queries if optimization fails
   */
  private static async fallbackToSequentialQueries(userId: string) {
    logger.warn('⚠️ Falling back to sequential queries due to optimization error');

    // Import and use the original service
    const { StudentDashboardService } = await import('./student-dashboard-service');
    return StudentDashboardService.getAllDashboardData(userId);
  }

  /**
   * Calculate attendance streak (consecutive days with attendance)
   */
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

  /**
   * Fallback methods that can be used individually if needed
   */
  static async getStudentData(userId: string): Promise<StudentData | null> {
    const result = await this.getAllDashboardDataOptimized(userId);
    return result.studentData;
  }

  static async getTodayClasses(userId: string): Promise<ClassSession[]> {
    const result = await this.getAllDashboardDataOptimized(userId);
    return result.todayClasses;
  }

  static async getRecentAttendance(userId: string, limit: number = 6): Promise<AttendanceRecord[]> {
    const result = await this.getAllDashboardDataOptimized(userId);
    return result.recentAttendance.slice(0, limit);
  }

  static async getAttendanceStats(userId: string): Promise<AttendanceStats> {
    const result = await this.getAllDashboardDataOptimized(userId);
    return result.stats;
  }

  /**
   * Legacy method for compatibility
   */
  static async getAllDashboardData(userId: string) {
    return this.getAllDashboardDataOptimized(userId);
  }
}

// Export as default for easy migration
export default OptimizedStudentDashboardServiceV2;