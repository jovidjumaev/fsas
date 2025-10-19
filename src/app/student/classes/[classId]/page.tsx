'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { StudentClassDetailService, ClassDetailResponse, ClassSession } from '@/lib/student-class-detail-service';
import { 
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Calendar,
  BookOpen,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  CalendarDays,
  TrendingUp,
  Users,
  RefreshCw,
  Brain
} from 'lucide-react';
import { StudentAIAssistant } from '@/components/student/ai-assistant';

function ClassDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const classId = params.classId as string;

  const [classDetail, setClassDetail] = useState<ClassDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'history' | 'upcoming' | 'ai-assistant'>('history');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'present' | 'late' | 'absent' | 'excused' | 'not_marked'>('all');

  const fetchClassDetail = async () => {
    if (!user || !classId) {
      setIsLoading(false);
      setError('User not authenticated or class ID missing');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔍 Fetching class detail for user:', user.id, 'class:', classId);
      const data = await StudentClassDetailService.getClassDetail(user.id, classId);
      console.log('🔍 Received class detail data:', data);
      setClassDetail(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching class detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch class details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClassDetail();
  }, [user, classId]);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading class details...</p>
        </div>
      </div>
    );
  }

  if (error || !classDetail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Class</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error || 'Class not found. Please check if you are enrolled in this class.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={fetchClassDetail} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { class: classInfo, attendance_stats, past_sessions, upcoming_sessions } = classDetail;

  // Filter sessions based on attendance status
  const getFilteredSessions = (sessions: any[]) => {
    if (attendanceFilter === 'all') {
      return sessions;
    }
    
    return sessions.filter(session => {
      if (!session.attendance) {
        return attendanceFilter === 'not_marked';
      }
      
      if (attendanceFilter === 'present') {
        return session.attendance.status === 'present';
      } else if (attendanceFilter === 'late') {
        return session.attendance.status === 'late';
      } else if (attendanceFilter === 'absent') {
        return session.attendance.status === 'absent';
      } else if (attendanceFilter === 'excused') {
        return session.attendance.status === 'excused';
      } else if (attendanceFilter === 'not_marked') {
        return !session.attendance;
      }
      
      return true;
    });
  };

  const filteredPastSessions = getFilteredSessions(past_sessions);
  const filteredUpcomingSessions = getFilteredSessions(upcoming_sessions);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Classes
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {classInfo.class_code} - {classInfo.class_name}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  {classInfo.professor} • {classInfo.academic_period}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Time */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchClassDetail}
                disabled={isLoading}
                className="hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Link href="/student/scan">
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                  Scan QR
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Class Info Card */}
        <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Professor</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{classInfo.professor}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MapPin className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Room</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{classInfo.room}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Schedule</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{classInfo.schedule}</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <BookOpen className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Credits</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{classInfo.credits}</p>
              </div>
            </div>
          </div>
          
          {classInfo.description && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className="text-gray-700 dark:text-gray-300">{classInfo.description}</p>
            </div>
          )}
        </Card>

        {/* Attendance Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {attendance_stats.attendance_rate}%
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900 rounded-full">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sessions Attended</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {attendance_stats.attended_sessions}/{attendance_stats.total_sessions}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>
          
          <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Upcoming Sessions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {upcoming_sessions.length}
                </p>
              </div>
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                <CalendarDays className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Last Updated */}
        {lastUpdated && (
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {lastUpdated.toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('history')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Attendance History ({past_sessions.length})
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'upcoming'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Upcoming Sessions ({upcoming_sessions.length})
              </button>
              <button
                onClick={() => setActiveTab('ai-assistant')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'ai-assistant'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Brain className="w-4 h-4" />
                <span>AI Assistant</span>
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'ai-assistant' ? (
          <StudentAIAssistant classId={classId} studentId={user.id} />
        ) : (
          <>
            {/* Attendance Filter */}
            {activeTab === 'history' && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Filter by:</span>
                  {[
                    { key: 'all', label: 'All', count: past_sessions.length },
                    { key: 'present', label: 'Present', count: past_sessions.filter(s => s.attendance?.status === 'present').length },
                    { key: 'late', label: 'Late', count: past_sessions.filter(s => s.attendance?.status === 'late').length },
                    { key: 'absent', label: 'Absent', count: past_sessions.filter(s => s.attendance?.status === 'absent').length },
                    { key: 'excused', label: 'Excused', count: past_sessions.filter(s => s.attendance?.status === 'excused').length },
                    { key: 'not_marked', label: 'Not Marked', count: past_sessions.filter(s => !s.attendance).length }
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setAttendanceFilter(filter.key as any)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        attendanceFilter === filter.key
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {filter.label} ({filter.count})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions List */}
            <div className="space-y-4">
              {(activeTab === 'history' ? filteredPastSessions : filteredUpcomingSessions).map((session) => (
                <SessionCard key={session.id} session={session} />
              ))}
              
              {((activeTab === 'history' ? filteredPastSessions : filteredUpcomingSessions).length === 0) && (
                <Card className="p-12 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="text-center">
                    <Calendar className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {activeTab === 'history' 
                        ? (attendanceFilter === 'all' 
                            ? 'No past sessions' 
                            : `No ${attendanceFilter} sessions`)
                        : 'No upcoming sessions'
                      }
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {activeTab === 'history' 
                        ? (attendanceFilter === 'all' 
                            ? 'No class sessions have been completed yet.'
                            : `No sessions found with ${attendanceFilter} attendance status.`)
                        : 'No upcoming class sessions are scheduled.'
                      }
                    </p>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SessionCard({ session }: { session: ClassSession }) {
  const getStatusIcon = () => {
    if (!session.attendance) {
      return <XCircle className="w-5 h-5 text-gray-400" />;
    }
    
    switch (session.attendance.status) {
      case 'present':
        return <CheckCircle className="w-5 h-5 text-emerald-500" />;
      case 'late':
        return <AlertCircle className="w-5 h-5 text-amber-500" />;
      case 'absent':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'excused':
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
      default:
        return <XCircle className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    if (!session.attendance) {
      return 'Not marked';
    }
    
    switch (session.attendance.status) {
      case 'present':
        return 'Present';
      case 'late':
        return `Late (${session.attendance.minutes_late} min)`;
      case 'absent':
        return 'Absent';
      case 'excused':
        return 'Excused';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!session.attendance) {
      return 'text-gray-600 bg-gray-100 dark:bg-gray-700';
    }
    
    return StudentClassDetailService.getAttendanceStatusColor(session.attendance.status);
  };

  return (
    <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {StudentClassDetailService.formatDate(session.date)}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session {session.session_number} • {StudentClassDetailService.formatTime(session.start_time)} - {StudentClassDetailService.formatTime(session.end_time)}
              </p>
              {session.room_location && (
                <p className="text-sm text-gray-500 dark:text-gray-500 flex items-center mt-1">
                  <MapPin className="w-3 h-3 mr-1" />
                  {session.room_location}
                </p>
              )}
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
          {session.attendance?.scanned_at && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Scanned: {new Date(session.attendance.scanned_at).toLocaleString()}
            </p>
          )}
        </div>
      </div>
      
      {session.notes && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">{session.notes}</p>
        </div>
      )}
    </Card>
  );
}

export default function ClassDetailPage() {
  return (
    <ProtectedRoute allowedRoles={['student']}>
      <ClassDetailContent />
    </ProtectedRoute>
  );
}
