import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

// Get environment variables with fallbacks
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zdtxqzpgggolbebrsymp.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1MDQyOTEsImV4cCI6MjA3NDA4MDI5MX0.sKzlSmmYQAZ2czFVMZh5bNFk14SdXLvc_vCfi_pS2Ik';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkdHhxenBnZ2dvbGJlYnJzeW1wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODUwNDI5MSwiZXhwIjoyMDc0MDgwMjkxfQ.CURDVpLekSL0iOnSEurdVwzWKCi5ldQQcgEkR1g3hqU';

// Debug environment variables
console.log('🔧 Supabase Config Debug (Updated):', {
  timestamp: new Date().toISOString(),
  supabaseUrl,
  supabaseAnonKeyLength: supabaseAnonKey?.length,
  supabaseAnonKeyFirst20: supabaseAnonKey?.substring(0, 20),
  envUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  envKeyExists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  envKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length,
  isUsingEnvVar: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
});

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Supabase URL:', supabaseUrl);
  console.error('Supabase Key exists:', !!supabaseAnonKey);
  throw new Error('Supabase configuration is missing');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Enable email confirmation for new users
    confirmEmailChange: true
  },
  global: {
    headers: {
      'x-client-info': 'fsas-web'
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Server-side client with service role key
export const supabaseAdmin = createClient<Database>(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      headers: {
        'x-client-info': 'fsas-admin'
      },
    },
    db: {
      schema: 'public',
    }
  }
);

// Database helper functions
export class DatabaseService {
  // User operations
  static async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async createUserProfile(profile: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'student' | 'professor' | 'admin';
  }) {
    const { data, error } = await supabase
      .from('users')
      .insert(profile)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Course operations
  static async getCourses(professorId: string) {
    const { data, error } = await supabase
      .from('courses')
      .select(`
        *,
        users!courses_professor_id_fkey(first_name, last_name)
      `)
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async createCourse(course: {
    course_code: string;
    course_name: string;
    professor_id: string;
    semester: string;
    year: number;
  }) {
    const { data, error } = await supabase
      .from('courses')
      .insert(course)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // Session operations
  static async getSessions(courseId: string) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select(`
        *,
        attendance_records(
          id,
          student_id,
          scanned_at,
          status,
          users!attendance_records_student_id_fkey(first_name, last_name, student_id)
        )
      `)
      .eq('course_id', courseId)
      .order('session_date', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async createSession(session: {
    course_id: string;
    session_date: string;
    start_time: string;
    end_time: string;
    qr_code_secret: string;
    qr_code_expires_at: string;
  }) {
    const { data, error } = await supabase
      .from('class_sessions')
      .insert(session)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getActiveSession(courseId: string) {
    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('course_id', courseId)
      .eq('is_active', true)
      .gte('qr_code_expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Attendance operations
  static async recordAttendance(attendance: {
    session_id: string;
    student_id: string;
    scanned_at: string;
    status: 'present' | 'late' | 'absent';
    device_fingerprint: string;
    ip_address: string;
  }) {
    const { data, error } = await supabase
      .from('attendance_records')
      .insert(attendance)
      .select(`
        *,
        users!attendance_records_student_id_fkey(first_name, last_name, student_id)
      `)
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getAttendanceRecords(sessionId: string) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        users!attendance_records_student_id_fkey(first_name, last_name, student_id)
      `)
      .eq('session_id', sessionId)
      .order('scanned_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async checkExistingAttendance(sessionId: string, studentId: string) {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Analytics operations
  static async getAttendanceAnalytics(courseId: string, startDate?: string, endDate?: string) {
    let query = supabase
      .from('class_sessions')
      .select(`
        id,
        session_date,
        attendance_records(
          status,
          users!attendance_records_student_id_fkey(student_id)
        )
      `)
      .eq('course_id', courseId);

    if (startDate) {
      query = query.gte('session_date', startDate);
    }
    if (endDate) {
      query = query.lte('session_date', endDate);
    }

    const { data, error } = await query.order('session_date', { ascending: true });
    
    if (error) throw error;
    return data;
  }

  // QR Code usage tracking
  static async trackQRUsage(usage: {
    session_id: string;
    qr_code_secret: string;
    used_by: string;
    used_at: string;
    device_fingerprint: string;
  }) {
    const { data, error } = await supabase
      .from('qr_code_usage')
      .insert(usage)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async checkQRUsage(sessionId: string, qrCodeSecret: string, studentId: string) {
    const { data, error } = await supabase
      .from('qr_code_usage')
      .select('id')
      .eq('session_id', sessionId)
      .eq('qr_code_secret', qrCodeSecret)
      .eq('used_by', studentId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }
}
