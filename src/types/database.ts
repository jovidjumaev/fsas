export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          first_name: string
          last_name: string
          role: 'student' | 'professor' | 'admin'
          is_active: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          first_name: string
          last_name: string
          role: 'student' | 'professor' | 'admin'
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          first_name?: string
          last_name?: string
          role?: 'student' | 'professor' | 'admin'
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          user_id: string
          student_id: string
          enrollment_year: number
          major: string | null
          gpa: number | null
          graduation_date: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          student_id: string
          enrollment_year: number
          major?: string | null
          gpa?: number | null
          graduation_date?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          student_id?: string
          enrollment_year?: number
          major?: string | null
          gpa?: number | null
          graduation_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      professors: {
        Row: {
          user_id: string
          employee_id: string
          title: string | null
          office_location: string | null
          phone: string | null
          created_at: string
        }
        Insert: {
          user_id: string
          employee_id: string
          title?: string | null
          office_location?: string | null
          phone?: string | null
          created_at?: string
        }
        Update: {
          user_id?: string
          employee_id?: string
          title?: string | null
          office_location?: string | null
          phone?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "professors_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      courses: {
        Row: {
          id: string
          course_code: string
          course_name: string
          professor_id: string
          semester: string
          year: number
          created_at: string
        }
        Insert: {
          id?: string
          course_code: string
          course_name: string
          professor_id: string
          semester: string
          year: number
          created_at?: string
        }
        Update: {
          id?: string
          course_code?: string
          course_name?: string
          professor_id?: string
          semester?: string
          year?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_professor_id_fkey"
            columns: ["professor_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      class_sessions: {
        Row: {
          id: string
          course_id: string
          session_date: string
          start_time: string
          end_time: string
          qr_code_secret: string
          qr_code_expires_at: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          course_id: string
          session_date: string
          start_time: string
          end_time: string
          qr_code_secret: string
          qr_code_expires_at: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          session_date?: string
          start_time?: string
          end_time?: string
          qr_code_secret?: string
          qr_code_expires_at?: string
          is_active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_sessions_course_id_fkey"
            columns: ["course_id"]
            referencedRelation: "courses"
            referencedColumns: ["id"]
          }
        ]
      }
      attendance_records: {
        Row: {
          id: string
          session_id: string
          student_id: string
          scanned_at: string
          status: 'present' | 'late' | 'absent'
          device_fingerprint: string
          ip_address: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          student_id: string
          scanned_at: string
          status: 'present' | 'late' | 'absent'
          device_fingerprint: string
          ip_address: string
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          student_id?: string
          scanned_at?: string
          status?: 'present' | 'late' | 'absent'
          device_fingerprint?: string
          ip_address?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["student_id"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      qr_code_usage: {
        Row: {
          id: string
          session_id: string
          qr_code_secret: string
          used_by: string
          used_at: string
          device_fingerprint: string
        }
        Insert: {
          id?: string
          session_id: string
          qr_code_secret: string
          used_by: string
          used_at: string
          device_fingerprint: string
        }
        Update: {
          id?: string
          session_id?: string
          qr_code_secret?: string
          used_by?: string
          used_at?: string
          device_fingerprint?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_code_usage_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "class_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_code_usage_used_by_fkey"
            columns: ["used_by"]
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'attendance_reminder' | 'attendance_marked' | 'class_cancelled' | 'class_rescheduled' | 'grade_posted' | 'assignment_due' | 'announcement' | 'system' | 'class_enrolled' | 'session_started' | 'attendance_recorded'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          title: string
          message: string
          link: string | null
          is_read: boolean
          read_at: string | null
          class_id: string | null
          session_id: string | null
          metadata: Json | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'attendance_reminder' | 'attendance_marked' | 'class_cancelled' | 'class_rescheduled' | 'grade_posted' | 'assignment_due' | 'announcement' | 'system' | 'class_enrolled' | 'session_started' | 'attendance_recorded'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          title: string
          message: string
          link?: string | null
          is_read?: boolean
          read_at?: string | null
          class_id?: string | null
          session_id?: string | null
          metadata?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'attendance_reminder' | 'attendance_marked' | 'class_cancelled' | 'class_rescheduled' | 'grade_posted' | 'assignment_due' | 'announcement' | 'system'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          title?: string
          message?: string
          link?: string | null
          is_read?: boolean
          read_at?: string | null
          class_id?: string | null
          session_id?: string | null
          metadata?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_class_id_fkey"
            columns: ["class_id"]
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
