import { supabase } from './supabase';

export interface AttendanceRecord {
  id: string;
  class_code: string;
  class_name: string;
  professor: string;
  room: string;
  date: string;
  time: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  scanned_at?: string;
  minutes_late?: number;
}

export interface AttendanceStats {
  totalClasses: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export class StudentAttendanceService {
  /**
   * Get all attendance records for a student
   */
  static async getStudentAttendanceRecords(userId: string): Promise<AttendanceRecord[]> {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active auth session - attendance records blocked by RLS');
        return [];
      }
      
      // Get all attendance records for this student with class and session details  
      const { data: attendanceRecords, error } = await supabase
        .from('attendance_records')
        .select(`
          id,
          status,
          scanned_at,
          minutes_late,
          session_id,
          student_id
        `)
        .eq('student_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching attendance records:', error);
        throw new Error('Failed to fetch attendance records');
      }
      
      if (!attendanceRecords || attendanceRecords.length === 0) {
        return [];
      }
      
      // Get session details for all attendance records
      const sessionIds = attendanceRecords.map(r => r.session_id);
      const { data: sessions, error: sessionsError } = await supabase
        .from('class_sessions')
        .select(`
          id,
          session_number,
          date,
          start_time,
          end_time,
          room_location,
          class_instance_id
        `)
        .in('id', sessionIds);
      
      if (sessionsError) {
        console.error('❌ Error fetching sessions:', sessionsError);
        throw new Error('Failed to fetch sessions');
      }
      
      // Get class instance details
      const classInstanceIds = [...new Set(sessions?.map(s => s.class_instance_id) || [])];
      const { data: classInstances, error: classInstancesError } = await supabase
        .from('class_instances')
        .select(`
          id,
          course_id,
          professor_id
        `)
        .in('id', classInstanceIds);
      
      if (classInstancesError) {
        console.error('❌ Error fetching class instances:', classInstancesError);
        throw new Error('Failed to fetch class instances');
      }
      
      // Get course details
      const courseIds = [...new Set(classInstances?.map(ci => ci.course_id) || [])];
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id, code, name')
        .in('id', courseIds);
      
      if (coursesError) {
        console.error('❌ Error fetching courses:', coursesError);
        throw new Error('Failed to fetch courses');
      }
      
      // Get professor details
      const professorIds = [...new Set(classInstances?.map(ci => ci.professor_id) || [])];
      const { data: professors, error: professorsError } = await supabase
        .from('professors')
        .select('user_id')
        .in('user_id', professorIds);
      
      if (professorsError) {
        console.error('❌ Error fetching professors:', professorsError);
      }
      
      // Get user details for professors
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .in('id', professorIds);
      
      if (usersError) {
        console.error('Error fetching users:', usersError);
      }

      // Create lookup maps for efficient data access
      const sessionMap = new Map(sessions?.map(s => [s.id, s]) || []);
      const classInstanceMap = new Map(classInstances?.map(ci => [ci.id, ci]) || []);
      const courseMap = new Map(courses?.map(c => [c.id, c]) || []);
      const userMap = new Map(users?.map(u => [u.id, u]) || []);

      // Transform the data to match the expected interface
      const transformedRecords: AttendanceRecord[] = attendanceRecords
        .map((record) => {
          const session = sessionMap.get(record.session_id);
          if (!session) return null;
          
          const classInstance = classInstanceMap.get(session.class_instance_id);
          if (!classInstance) return null;
          
          const course = courseMap.get(classInstance.course_id);
          if (!course) return null;
          
          const professorUser = userMap.get(classInstance.professor_id);
          const professorName = professorUser 
            ? `${professorUser.first_name} ${professorUser.last_name}`
            : 'Unknown Professor';

          // Format time
          const startTime = this.formatTime(session.start_time);
          const endTime = this.formatTime(session.end_time);
          const timeString = `${startTime} - ${endTime}`;

          return {
            id: record.id,
            class_code: course.code,
            class_name: course.name,
            professor: professorName,
            room: session.room_location || 'TBD',
            date: session.date,
            time: timeString,
            status: record.status as 'present' | 'absent' | 'late' | 'excused',
            scanned_at: record.scanned_at,
            minutes_late: record.minutes_late
          };
        })
        .filter((record): record is AttendanceRecord => record !== null);

      return transformedRecords;
    } catch (error) {
      console.error('Error fetching student attendance records:', error);
      throw error;
    }
  }

  /**
   * Get attendance statistics for a student
   */
  static async getStudentAttendanceStats(userId: string): Promise<AttendanceStats> {
    try {
      const records = await this.getStudentAttendanceRecords(userId);
      
      const totalClasses = records.length;
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const late = records.filter(r => r.status === 'late').length;
      const excused = records.filter(r => r.status === 'excused').length;
      
      // Calculate attendance rate (present + late + excused count as attended)
      const attended = present + late + excused;
      const attendanceRate = totalClasses > 0 ? Math.round((attended / totalClasses) * 100) : 0;

      return {
        totalClasses,
        present,
        absent,
        late,
        excused,
        attendanceRate
      };
    } catch (error) {
      console.error('Error fetching student attendance stats:', error);
      throw error;
    }
  }

  /**
   * Format time from 24-hour to 12-hour format
   */
  private static formatTime(timeString: string): string {
    const [hourString, minuteString] = timeString.split(':');
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);
    
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    return `${hour12}:${minute.toString().padStart(2, '0')} ${period}`;
  }
}
