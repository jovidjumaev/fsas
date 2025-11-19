import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import { createLogger } from '@/lib/logger';

const logger = createLogger('use-student-data-swr');

// Cache for 5 minutes by default
const CACHE_TIME = 5 * 60 * 1000;

// Fetcher functions for SWR
const fetchers = {
  classes: async (userId: string) => {
    logger.debug('Fetching classes for user:', userId);

    const { data: enrollments, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        class_instances!inner(
          *,
          courses(*),
          professors:users!class_instances_professor_id_fkey(
            id,
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('student_id', userId)
      .eq('status', 'active');

    if (error) throw error;

    // Transform the data
    const classes = enrollments?.map(enrollment => ({
      id: enrollment.class_instance_id,
      courseCode: enrollment.class_instances.courses.code,
      courseName: enrollment.class_instances.courses.name,
      professor: `${enrollment.class_instances.professors.first_name} ${enrollment.class_instances.professors.last_name}`,
      schedule: enrollment.class_instances.days_of_week?.join(', ') || 'TBD',
      time: `${enrollment.class_instances.start_time || 'TBD'} - ${enrollment.class_instances.end_time || 'TBD'}`,
      room: enrollment.class_instances.room_location || 'TBD',
      enrollmentDate: enrollment.enrollment_date
    })) || [];

    return classes;
  },

  attendance: async (userId: string) => {
    logger.debug('Fetching attendance for user:', userId);

    const { data: attendanceRecords, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          date,
          status,
          class_instances!inner(
            courses(code, name)
          )
        )
      `)
      .eq('student_id', userId)
      .order('scanned_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    // Transform and group by class
    const attendanceByClass = new Map();

    attendanceRecords?.forEach(record => {
      const className = record.class_sessions.class_instances.courses.name;
      const classCode = record.class_sessions.class_instances.courses.code;

      if (!attendanceByClass.has(className)) {
        attendanceByClass.set(className, {
          className,
          classCode,
          records: []
        });
      }

      attendanceByClass.get(className).records.push({
        date: record.class_sessions.date,
        status: record.status,
        scannedAt: record.scanned_at
      });
    });

    return Array.from(attendanceByClass.values());
  },

  classDetail: async ([userId, classId]: [string, string]) => {
    logger.debug('Fetching class detail:', classId);

    // Fetch class details and attendance in parallel
    const [classResult, attendanceResult, sessionsResult] = await Promise.all([
      supabase
        .from('class_instances')
        .select(`
          *,
          courses(*),
          professors:users!class_instances_professor_id_fkey(
            first_name,
            last_name,
            email,
            office_location
          )
        `)
        .eq('id', classId)
        .single(),

      supabase
        .from('attendance_records')
        .select(`
          *,
          class_sessions!inner(
            date,
            class_instance_id
          )
        `)
        .eq('student_id', userId)
        .eq('class_sessions.class_instance_id', classId),

      supabase
        .from('class_sessions')
        .select('*')
        .eq('class_instance_id', classId)
        .order('date', { ascending: false })
    ]);

    if (classResult.error) throw classResult.error;

    const classData = classResult.data;
    const attendance = attendanceResult.data || [];
    const sessions = sessionsResult.data || [];

    // Calculate attendance stats
    const totalSessions = sessions.filter(s => s.status === 'completed').length;
    const attendedSessions = attendance.filter(a => a.status === 'present').length;
    const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;

    return {
      classInfo: {
        code: classData.courses.code,
        name: classData.courses.name,
        description: classData.courses.description,
        credits: classData.courses.credit_hours,
        professor: `${classData.professors.first_name} ${classData.professors.last_name}`,
        professorEmail: classData.professors.email,
        officeLocation: classData.professors.office_location,
        schedule: classData.days_of_week?.join(', ') || 'TBD',
        time: `${classData.start_time || 'TBD'} - ${classData.end_time || 'TBD'}`,
        room: classData.room_location || 'TBD'
      },
      attendance: {
        rate: Math.round(attendanceRate),
        present: attendedSessions,
        total: totalSessions,
        records: attendance.map(a => ({
          date: a.class_sessions.date,
          status: a.status,
          scannedAt: a.scanned_at
        }))
      },
      upcomingSessions: sessions
        .filter(s => s.status === 'scheduled')
        .slice(0, 5)
        .map(s => ({
          date: s.date,
          time: s.start_time
        }))
    };
  }
};

// Custom hooks using SWR
export function useStudentClasses(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['student-classes', userId] : null,
    () => fetchers.classes(userId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: CACHE_TIME,
      fallbackData: [],
      keepPreviousData: true // Keep showing old data while fetching new
    }
  );

  return {
    classes: data || [],
    isLoading,
    error,
    refresh: mutate
  };
}

export function useStudentAttendance(userId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['student-attendance', userId] : null,
    () => fetchers.attendance(userId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: CACHE_TIME,
      fallbackData: [],
      keepPreviousData: true
    }
  );

  return {
    attendance: data || [],
    isLoading,
    error,
    refresh: mutate
  };
}

export function useClassDetail(userId: string | undefined, classId: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    userId && classId ? ['class-detail', userId, classId] : null,
    () => fetchers.classDetail([userId!, classId!]),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: CACHE_TIME,
      keepPreviousData: true
    }
  );

  return {
    classDetail: data,
    isLoading,
    error,
    refresh: mutate
  };
}

// Prefetch functions for smoother navigation
export const prefetchStudentData = {
  classes: (userId: string) => {
    return fetchers.classes(userId);
  },
  attendance: (userId: string) => {
    return fetchers.attendance(userId);
  },
  classDetail: (userId: string, classId: string) => {
    return fetchers.classDetail([userId, classId]);
  }
};