'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { 
  Calendar, Clock, Users, QrCode, Play, Pause, Square, 
  ArrowLeft, Download, Eye, CheckCircle, XCircle, AlertCircle,
  MapPin, BookOpen, Activity, BarChart3, FileText, Timer
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProfessorHeader from '@/components/professor/professor-header';
import { createLogger } from '../../../../lib/logger';
const logger = createLogger('page');

interface SessionData {
  id: string;
  class_instance_id: string;
  session_number: number;
  date: string;
  start_time: string;
  end_time: string;
  room_location: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  is_active: boolean;
  qr_secret?: string;
  qr_expires_at?: string;
  attendance_count: number;
  total_enrolled: number;
  notes?: string;
  created_at: string;
  class_instances: {
    id: string;
    room_location: string;
    courses: {
      code: string;
      name: string;
    };
    academic_periods: {
      name: string;
    };
  };
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  scanned_at: string;
  timestamp?: string;
  students: {
    student_id: string;
    users: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
}

interface EnrolledStudent {
  id: string;
  user_id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  enrollment_date: string;
  status: string;
}

function SessionDetailsContent() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  
  const [session, setSession] = useState<SessionData | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);

  // Fetch session details
  const fetchSessionDetails = useCallback(async () => {
    if (!user || !sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}`);
      if (!response.ok) throw new Error('Failed to fetch session details');
      
      const data = await response.json();
      setSession(data.session);
    } catch (error) {
      logger.error('Error fetching session details:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, sessionId]);

  // Fetch attendance records
  const fetchAttendance = useCallback(async () => {
    if (!sessionId) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/attendance`);
      if (!response.ok) throw new Error('Failed to fetch attendance');
      
      const data = await response.json();
      setAttendance(data.data || []);
    } catch (error) {
      logger.error('Error fetching attendance:', error);
      setAttendance([]);
    }
  }, [sessionId]);

  // Fetch enrolled students for the class
  const fetchEnrolledStudents = useCallback(async () => {
    if (!session?.class_instance_id) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${session.class_instance_id}/students`);
      if (!response.ok) throw new Error('Failed to fetch enrolled students');
      
      const data = await response.json();
      setEnrolledStudents(data.data || []);
    } catch (error) {
      logger.error('Error fetching enrolled students:', error);
      setEnrolledStudents([]);
    }
  }, [session?.class_instance_id]);

  // Session management functions
  const activateSession = useCallback(async (notes?: string) => {
    if (!session) return;
    
    setIsActionLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${session.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      
      if (!response.ok) throw new Error('Failed to activate session');
      
      await fetchSessionDetails();
      await fetchAttendance();
    } catch (error) {
      logger.error('Error activating session:', error);
      alert('Failed to activate session. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [session, fetchSessionDetails, fetchAttendance]);

  const completeSession = useCallback(async () => {
    if (!session) return;
    
    setIsActionLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${session.id}/complete`, {
        method: 'POST',
      });
      
      if (!response.ok) throw new Error('Failed to complete session');
      
      await fetchSessionDetails();
      await fetchAttendance();
    } catch (error) {
      logger.error('Error completing session:', error);
      alert('Failed to complete session. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [session, fetchSessionDetails, fetchAttendance]);

  const cancelSession = useCallback(async (notes?: string) => {
    if (!session) return;
    
    setIsActionLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${session.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      
      if (!response.ok) throw new Error('Failed to cancel session');
      
      await fetchSessionDetails();
    } catch (error) {
      logger.error('Error cancelling session:', error);
      alert('Failed to cancel session. Please try again.');
    } finally {
      setIsActionLoading(false);
    }
  }, [session, fetchSessionDetails]);

  // Load data on mount
  useEffect(() => {
    fetchSessionDetails();
    fetchAttendance();
  }, [fetchSessionDetails, fetchAttendance]);

  // Check for manage mode from URL params
  useEffect(() => {
    const manage = searchParams.get('manage');
    setIsManageMode(manage === 'true');
  }, [searchParams]);

  // Fetch enrolled students when session is loaded
  useEffect(() => {
    if (session?.class_instance_id) {
      fetchEnrolledStudents();
    }
  }, [session?.class_instance_id, fetchEnrolledStudents]);

  // Update student attendance status
  const updateAttendanceStatus = async (studentId: string, newStatus: 'present' | 'late' | 'absent' | 'excused') => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/attendance/${studentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus
        }),
      });

      if (!response.ok) throw new Error('Failed to update attendance status');
      
      // Refresh attendance data
      await fetchAttendance();
      setEditingStudent(null);
    } catch (error) {
      logger.error('Error updating attendance status:', error);
      alert('Failed to update attendance status. Please try again.');
    }
  };

  // Get session status info
  const getSessionStatus = useCallback((session: SessionData) => {
    switch (session.status) {
      case 'active':
        return { 
          text: 'Active', 
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
          icon: Activity
        };
      case 'completed':
        return { 
          text: 'Completed', 
          color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
          icon: CheckCircle
        };
      case 'scheduled':
        return { 
          text: 'Scheduled', 
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
          icon: Clock
        };
      case 'cancelled':
        return { 
          text: 'Cancelled', 
          color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
          icon: XCircle
        };
      default:
        return { 
          text: 'Unknown', 
          color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
          icon: AlertCircle
        };
    }
  }, []);

  // Create complete attendance list including absent students
  const getAllStudentsWithAttendance = useCallback(() => {
    if (!enrolledStudents.length) return [];

    const attendedStudentIds = new Set(attendance.map(a => a.students.student_id));
    
    // Create attendance records for all students
    const allStudentsAttendance = enrolledStudents.map(student => {
      const attendanceRecord = attendance.find(a => a.students.student_id === student.student_id);
      
      if (attendanceRecord) {
        // Student attended (present or late)
        return {
          id: attendanceRecord.id,
          student_id: student.student_id,
          session_id: sessionId,
          status: attendanceRecord.status,
          timestamp: attendanceRecord.scanned_at || attendanceRecord.timestamp,
          students: {
            user_id: student.user_id,
            student_id: student.student_id,
            users: {
              first_name: student.first_name,
              last_name: student.last_name,
              email: student.email
            }
          }
        };
      } else {
        // Student was absent
        return {
          id: `absent-${student.user_id}`,
          student_id: student.student_id,
          session_id: sessionId,
          status: 'absent' as const,
          timestamp: session?.date || new Date().toISOString(),
          students: {
            user_id: student.user_id,
            student_id: student.student_id,
            users: {
              first_name: student.first_name,
              last_name: student.last_name,
              email: student.email
            }
          }
        };
      }
    });

    // Sort attendance records by check-in time (earliest first), then absent students at the end
    const sortedAttendance = allStudentsAttendance.sort((a, b) => {
      // Absent students always go to the end
      if (a.status === 'absent' && b.status !== 'absent') return 1;
      if (b.status === 'absent' && a.status !== 'absent') return -1;
      if (a.status === 'absent' && b.status === 'absent') {
        // If both absent, sort by name
        return `${a.students.users.first_name} ${a.students.users.last_name}`.localeCompare(
          `${b.students.users.first_name} ${b.students.users.last_name}`
        );
      }
      
      // For present/late students, sort by check-in time (earliest first)
      const aTime = new Date(a.timestamp || '').getTime();
      const bTime = new Date(b.timestamp || '').getTime();
      
      // If times are the same, sort by name
      if (aTime === bTime) {
        return `${a.students.users.first_name} ${a.students.users.last_name}`.localeCompare(
          `${b.students.users.first_name} ${b.students.users.last_name}`
        );
      }
      
      return aTime - bTime;
    });

    return sortedAttendance;
  }, [enrolledStudents, attendance, sessionId, session?.date]);

  // Calculate attendance statistics
  const allStudentsAttendance = getAllStudentsWithAttendance();
  const attendanceStats = {
    present: allStudentsAttendance.filter(a => a.status === 'present').length,
    late: allStudentsAttendance.filter(a => a.status === 'late').length,
    excused: allStudentsAttendance.filter(a => a.status === 'excused').length,
    absent: allStudentsAttendance.filter(a => a.status === 'absent').length,
    total: allStudentsAttendance.length
  };

  // For analytics: count excused as present (doesn't affect student grade but helps with statistics)
  const analyticsStats = {
    present: attendanceStats.present + attendanceStats.excused, // Excused counts as present for analytics
    late: attendanceStats.late,
    absent: attendanceStats.absent,
    total: attendanceStats.total
  };

  const attendanceRate = analyticsStats.total > 0 ? ((analyticsStats.present + analyticsStats.late) / analyticsStats.total) * 100 : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <ProfessorHeader 
          currentPage="sessions"
          userProfile={null}
          onSignOut={() => {}}
          onEditProfile={() => {}}
          onChangePassword={() => {}}
          onUploadAvatar={async () => {}}
          onDeleteAvatar={async () => {}}
        />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Card className="p-12 text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Session Not Found
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              The session you're looking for doesn't exist or you don't have permission to view it.
            </p>
            <Button onClick={() => router.push('/professor/sessions')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sessions
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  const status = getSessionStatus(session);
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-safe">
      {/* Header */}
      <ProfessorHeader
        currentPage="sessions"
        userProfile={null}
        onSignOut={() => {}}
        onEditProfile={() => {}}
        onChangePassword={() => {}}
        onUploadAvatar={async () => {}}
        onDeleteAvatar={async () => {}}
      />

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        {/* Breadcrumb Navigation */}
        <div className="mb-4 sm:mb-6">
          <nav className="flex items-center space-x-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <button
              onClick={() => router.push('/professor/sessions')}
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Sessions
            </button>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-medium truncate">
              {session?.class_instances?.courses?.code} - Session {session?.session_number}
            </span>
          </nav>
        </div>

        {/* Session Header */}
        <Card className="p-4 sm:p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start space-x-3 sm:space-x-4 min-w-0 flex-1">
              <div className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br ${
                session.status === 'active'
                  ? 'from-emerald-500 to-emerald-600'
                  : session.status === 'completed'
                  ? 'from-indigo-500 to-indigo-600'
                  : session.status === 'scheduled'
                  ? 'from-amber-500 to-amber-600'
                  : 'from-slate-400 to-slate-500'
              } rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0`}>
                <StatusIcon className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-white mb-1 sm:mb-2">
                  {session.class_instances.courses.code} - Session {session.session_number}
                </h1>
                {isManageMode && (
                  <span className="inline-block mb-2 px-2 sm:px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full text-xs sm:text-sm font-medium">
                    Manage Mode
                  </span>
                )}
                <div className="text-sm sm:text-base lg:text-lg text-slate-600 dark:text-slate-400 mb-1 sm:mb-2">
                  {new Date(session.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })} • {session.start_time} - {session.end_time}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${status.color}`}>
                    {session.status === 'active' && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-current rounded-full mr-1.5 sm:mr-2 animate-pulse"></div>}
                    {status.text}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
              {session.status === 'active' ? (
                <>
                  <Button
                    onClick={completeSession}
                    disabled={isActionLoading}
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white w-full sm:w-auto"
                  >
                    <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="text-xs sm:text-sm">Stop Session</span>
                  </Button>
                  <Button
                    onClick={() => router.push(`/professor/sessions/active/${session.id}`)}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    <span className="text-xs sm:text-sm">View Live</span>
                  </Button>
                </>
              ) : session.status === 'scheduled' ? (
                <Button
                  onClick={() => activateSession()}
                  disabled={isActionLoading}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                >
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  <span className="text-xs sm:text-sm">Start Session</span>
                </Button>
              ) : null}

              <Button
                variant="outline"
                size="sm"
                className="hover:bg-slate-100 dark:hover:bg-slate-700 w-full sm:w-auto"
                onClick={() => {
                  if (allStudentsAttendance.length === 0) {
                    alert('No attendance data to export');
                    return;
                  }
                  
                  // Export to CSV (for analytics: excused counts as present)
                  const headers = ['Student Name', 'Student ID', 'Email', 'Status', 'Analytics Status', 'Scanned At'];
                  const csvContent = [
                    headers.join(','),
                    ...allStudentsAttendance.map(record => {
                      // For analytics: excused students are treated as present
                      const analyticsStatus = record.status === 'excused' ? 'present' : record.status;
                      return [
                        `"${record.students.users.first_name} ${record.students.users.last_name}"`,
                        `"${record.students.student_id}"`,
                        `"${record.students.users.email}"`,
                        `"${record.status}"`, // Original status for professor reference
                        `"${analyticsStatus}"`, // Analytics status (excused = present)
                        record.status === 'absent' ? '""' : `"${new Date(record.timestamp || '').toLocaleString()}"`
                      ].join(',');
                    })
                  ].join('\n');
                  
                  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                  const link = document.createElement('a');
                  const url = URL.createObjectURL(blob);
                  link.setAttribute('href', url);
                  link.setAttribute('download', `attendance_${session?.class_instances.courses.code}_${session?.date || new Date().toISOString().split('T')[0]}.csv`);
                  link.style.visibility = 'hidden';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Session Information */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            {/* Course Details */}
            <Card className="p-4 sm:p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-3 sm:mb-4 flex items-center">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                Course Information
              </h2>
              <div className="space-y-2 sm:space-y-3">
                <div>
                  <span className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">Course</span>
                  <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
                    {session.class_instances.courses.code} - {session.class_instances.courses.name}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Session</span>
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    Session {session.session_number} of {session.class_instances.courses.code}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Time</span>
                    <p className="text-slate-900 dark:text-white">
                      {session.start_time} - {session.end_time}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Room</span>
                    <p className="text-slate-900 dark:text-white">{session.room_location}</p>
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Academic Period</span>
                  <p className="text-slate-900 dark:text-white">{session.class_instances.academic_periods.name}</p>
                </div>
              </div>
            </Card>

            {/* Attendance Records */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Attendance Records ({allStudentsAttendance.length} students)
              </h2>
              
              {allStudentsAttendance.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">
                    {session.status === 'active' ? 'No students enrolled yet' : 'No students enrolled'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {allStudentsAttendance.map((record) => (
                    <div key={record.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg gap-2 sm:gap-0 ${
                      record.status === 'present'
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700'
                        : record.status === 'late'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700'
                        : record.status === 'excused'
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                        : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
                    }`}>
                      <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                        <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                          record.status === 'present' ? 'bg-emerald-500' :
                          record.status === 'late' ? 'bg-amber-500' :
                          record.status === 'excused' ? 'bg-blue-500' : 'bg-red-500'
                        }`}></div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base text-slate-900 dark:text-white truncate">
                            {record.students.users.first_name} {record.students.users.last_name}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
                            {record.students.users.email} • ID: {record.students.student_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
                        <div className="text-right">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            record.status === 'present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' :
                            record.status === 'late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' :
                            record.status === 'excused' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                            'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                          </span>
                          {record.status !== 'absent' && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {new Date(record.timestamp || '').toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        {isManageMode && (
                          <div className="flex flex-col space-y-1">
                            {editingStudent === record.students.student_id ? (
                              <div className="flex space-x-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAttendanceStatus(record.students.student_id, 'present')}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  Present
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAttendanceStatus(record.students.student_id, 'late')}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  Late
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAttendanceStatus(record.students.student_id, 'excused')}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  Excused
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateAttendanceStatus(record.students.student_id, 'absent')}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  Absent
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingStudent(null)}
                                  className="text-xs px-2 py-1 h-6"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingStudent(record.students.student_id)}
                                className="text-xs px-2 py-1 h-6"
                              >
                                Edit
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Statistics Sidebar */}
          <div className="space-y-6">
            {/* Attendance Stats */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Attendance Statistics
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Overall Rate</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {attendanceRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                    <div
                      className="h-3 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                      style={{ width: `${attendanceRate}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Detailed Breakdown */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Detailed Breakdown</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {attendanceStats.present}
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">Present</p>
                      </div>
                      <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          {attendanceStats.late}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">Late</p>
                      </div>
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {attendanceStats.excused}
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">Excused</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {attendanceStats.absent}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">Absent</p>
                      </div>
                    </div>
                  </div>

                  {/* Analytics View (Excused counts as Present) */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Analytics View</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {analyticsStats.present}
                        </p>
                        <p className="text-xs text-emerald-700 dark:text-emerald-300">Present*</p>
                      </div>
                      <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                          {analyticsStats.late}
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300">Late</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          {analyticsStats.absent}
                        </p>
                        <p className="text-xs text-red-700 dark:text-red-300">Absent</p>
                      </div>
                      <div className="text-center p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                        <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
                          {analyticsStats.total}
                        </p>
                        <p className="text-xs text-slate-700 dark:text-slate-300">Total</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                      *Includes excused students (doesn't affect student grades)
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Session Notes */}
            {session.notes && (
              <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                  <FileText className="w-5 h-5 mr-2" />
                  Session Notes
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {session.notes}
                </p>
              </Card>
            )}

            {/* Session Timer (if active) */}
            {session.status === 'active' && session.qr_expires_at && (
              <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                  <Timer className="w-5 h-5 mr-2" />
                  Session Timer
                </h3>
                <div className="text-center">
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    Active
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Session will auto-complete in 1 hour
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SessionDetailsPage() {
  return (
    <ProtectedRoute requiredRole="professor">
      <SessionDetailsContent />
    </ProtectedRoute>
  );
}
