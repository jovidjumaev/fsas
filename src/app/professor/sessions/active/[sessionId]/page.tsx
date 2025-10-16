'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { 
  QrCode, Users, Clock, Square, Pause, Play, 
  Maximize2, Minimize2, Volume2, VolumeX, RefreshCw,
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  Calendar, MapPin, BarChart3, Download, Settings,
  ArrowLeft, Activity, Timer, FileText, Table
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import io from 'socket.io-client';

interface ActiveSessionData {
  id: string;
  class_id: string;
  class_code: string;
  class_name: string;
  date: string;
  start_time: string;
  end_time: string;
  room_location: string;
  is_active: boolean;
  status: 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
  qr_code: string;
  qr_code_expires_at: string;
  refresh_interval: number; // seconds
  attendance_count: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  total_enrolled: number;
  created_at: string;
  activated_at?: string;
  notes?: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_photo?: string;
  status: 'present' | 'late' | 'absent';
  scanned_at: string;
  device_info?: string;
  students?: {
    users?: {
      email: string;
    };
  };
}

function ActiveSessionContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const sessionId = params.sessionId as string;
  
  const [session, setSession] = useState<ActiveSessionData | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStudentList, setShowStudentList] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [qrRefreshCountdown, setQrRefreshCountdown] = useState(30);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isStopDialogOpen, setIsStopDialogOpen] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const qrRefreshInterval = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSessionData();
      startRealTimeUpdates();
    }

    return () => {
      stopRealTimeUpdates();
    };
  }, [sessionId]);

  useEffect(() => {
    if (session?.is_active && session?.status === 'active') {
      startQRRefreshTimer();
      startSessionTimer();
    } else {
      stopQRRefreshTimer();
      stopSessionTimer();
    }

    return () => {
      stopQRRefreshTimer();
      stopSessionTimer();
    };
  }, [session?.is_active, session?.status]);

  const fetchAttendanceRecords = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/attendance`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const attendanceRecords = data.data.map((record: any) => ({
            id: record.id,
            student_id: record.students.student_id,
            student_name: `${record.students.users.first_name} ${record.students.users.last_name}`,
            status: record.status,
            scanned_at: record.scanned_at,
            students: record.students // Include for email export
          }));
          setAttendanceRecords(attendanceRecords);
          
          // Update session counts based on actual attendance records
          updateSessionCounts(attendanceRecords);
        }
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    }
  };

  const updateSessionCounts = (records: AttendanceRecord[]) => {
    const presentCount = records.filter(record => record.status === 'present').length;
    const lateCount = records.filter(record => record.status === 'late').length;
    const totalScanned = records.length;
    
    setSession(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        present_count: presentCount,
        late_count: lateCount,
        attendance_count: totalScanned,
        absent_count: Math.max(0, prev.total_enrolled - totalScanned)
      };
    });
  };

  const fetchSessionData = async () => {
    setIsLoading(true);
    try {
      // Fetch session details
      const sessionResponse = await fetch(`/api/sessions/${sessionId}`);
      if (!sessionResponse.ok) throw new Error('Failed to fetch session');
      const sessionData = await sessionResponse.json();
      
      if (!sessionData.success) {
        throw new Error(sessionData.error || 'Session not found');
      }
      
      const session = sessionData.session;
      
      // Fetch QR code if session is active
      let qrCodeData = null;
      if (session.status === 'active') {
        const qrResponse = await fetch(`/api/sessions/${sessionId}/qr-code`);
        if (qrResponse.ok) {
          qrCodeData = await qrResponse.json();
        }
      }
      
      const activeSession: ActiveSessionData = {
        id: session.id,
        class_id: session.class_instance_id,
        class_code: session.class_instances.courses.code,
        class_name: session.class_instances.courses.name,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        room_location: session.room_location,
        is_active: session.status === 'active',
        status: session.status,
        qr_code: qrCodeData?.qr_code || '',
        qr_code_expires_at: qrCodeData?.expires_at || session.qr_expires_at,
        refresh_interval: 30,
        attendance_count: session.attendance_count || 0,
        present_count: 0, // Will be calculated from attendance records
        absent_count: Math.max(0, (session.total_enrolled || 0) - (session.attendance_count || 0)),
        late_count: 0, // Will be calculated from attendance records
        total_enrolled: session.total_enrolled || 0,
        created_at: session.created_at,
        activated_at: session.updated_at, // Use updated_at as activation time
        notes: session.notes
      };

      setSession(activeSession);
      
      // Fetch real attendance records
      await fetchAttendanceRecords();
      
      // Calculate time remaining (1 hour from session activation)
      // Only calculate if session is active and has an activation time
      if (activeSession.status === 'active' && activeSession.activated_at) {
        const activationTime = new Date(activeSession.activated_at);
        const sessionEndTime = new Date(activationTime.getTime() + (60 * 60 * 1000)); // 1 hour later
        const now = new Date();
        const remaining = Math.max(0, Math.floor((sessionEndTime.getTime() - now.getTime()) / 1000));
        
        console.log('🕐 Timer calculation:', {
          activated_at: activeSession.activated_at,
          activationTime: activationTime.toISOString(),
          sessionEndTime: sessionEndTime.toISOString(),
          now: now.toISOString(),
          remaining: remaining,
          remainingMinutes: Math.floor(remaining / 60)
        });
        
        setTimeRemaining(remaining);
        
        // If session has expired, automatically complete it
        if (remaining === 0) {
          console.log('⏰ Session has expired, completing automatically');
          handleStopSession();
        }
      } else {
        // For non-active sessions or sessions without activation time, set to 0
        console.log('⏹️ Session not active or no activation time:', {
          status: activeSession.status,
          activated_at: activeSession.activated_at
        });
        setTimeRemaining(0);
      }
      
    } catch (error) {
      console.error('Error fetching session data:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const startRealTimeUpdates = () => {
    // Set up WebSocket connection for real-time updates
    if (typeof window !== 'undefined') {
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      socketRef.current = socket; // Store socket reference
      
      socket.on('connect', () => {
        console.log('🔗 Connected to WebSocket for real-time updates');
        console.log('📡 Joining session room:', sessionId);
        socket.emit('join-session', sessionId);
      });
      
      socket.on('disconnect', () => {
        console.log('🔌 WebSocket disconnected');
      });
      
      socket.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });

      socket.on('attendance_update', (data) => {
        console.log('🎯 Real-time attendance update received:', data);
        
        // Refresh attendance records to get the full list with correct counts
        fetchAttendanceRecords();
        setLastScanTime(new Date());
        
        // Play sound notification
        if (soundEnabled && audioRef.current) {
          audioRef.current.play().catch(console.error);
        }
      });

      socket.on('qr_code_update', (data) => {
        console.log('Real-time QR code update received:', data);
        if (data.sessionId === sessionId) {
          setSession(prev => prev ? {
            ...prev,
            qr_code: data.qr_code,
            qr_code_expires_at: data.expires_at
          } : null);
        }
      });

      return () => {
        socket.emit('leave-session', sessionId);
        socket.disconnect();
      };
    }
  };

  const stopRealTimeUpdates = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-session', sessionId);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  const startQRRefreshTimer = () => {
    if (qrRefreshInterval.current) return;
    
    qrRefreshInterval.current = setInterval(async () => {
      await refreshQRCode();
    }, 30000); // Refresh every 30 seconds

    // Countdown timer
    setQrRefreshCountdown(30);
    countdownInterval.current = setInterval(() => {
      setQrRefreshCountdown(prev => {
        if (prev <= 1) {
          return 30; // Reset countdown
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopQRRefreshTimer = () => {
    if (qrRefreshInterval.current) {
      clearInterval(qrRefreshInterval.current);
      qrRefreshInterval.current = null;
    }
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
  };

  const startSessionTimer = () => {
    if (sessionTimerInterval.current) {
      clearInterval(sessionTimerInterval.current);
    }
    
    sessionTimerInterval.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(sessionTimerInterval.current!);
          sessionTimerInterval.current = null;
          setSessionExpired(true);
          // Automatically complete the session when timer expires
          handleStopSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopSessionTimer = () => {
    if (sessionTimerInterval.current) {
      clearInterval(sessionTimerInterval.current);
      sessionTimerInterval.current = null;
    }
  };

  const refreshQRCode = async () => {
    if (!session || session.status !== 'active') return;
    
    try {
      const response = await fetch(`/api/sessions/${sessionId}/qr-code`);
      if (response.ok) {
        const qrData = await response.json();
        if (qrData.success) {
          setSession(prev => prev ? {
            ...prev,
            qr_code: qrData.qr_code,
            qr_code_expires_at: qrData.expires_at
          } : null);
          setQrRefreshCountdown(30);
        }
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
    }
  };

  const handleStopSession = async () => {
    if (!sessionId) return;
    setIsCompleting(true);
    setIsStopDialogOpen(false);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/complete`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to complete session');
      await fetchSessionData(); // Refresh session data to reflect completion
      router.push('/professor/sessions?tab=completed'); // Redirect to sessions page with completed tab
    } catch (error) {
      console.error('Error completing session:', error);
      alert('Failed to complete session. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  const exportToCSV = () => {
    if (!attendanceRecords.length) return;
    
    const headers = ['Student Name', 'Student ID', 'Email', 'Status', 'Scanned At'];
    const csvContent = [
      headers.join(','),
      ...attendanceRecords.map(record => [
        `"${record.student_name}"`,
        `"${record.student_id}"`,
        `"${record.students?.users?.email || ''}"`,
        `"${record.status}"`,
        `"${new Date(record.scanned_at).toLocaleString()}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `attendance_${session?.class_code}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportDialogOpen(false);
  };

  const exportToXLSX = async () => {
    if (!attendanceRecords.length) return;
    
    try {
      // Dynamic import for XLSX library
      const XLSX = await import('xlsx');
      
      const data = attendanceRecords.map(record => ({
        'Student Name': record.student_name,
        'Student ID': record.student_id,
        'Email': record.students?.users?.email || '',
        'Status': record.status,
        'Scanned At': new Date(record.scanned_at).toLocaleString()
      }));
      
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
      
      XLSX.writeFile(workbook, `attendance_${session?.class_code}_${new Date().toISOString().split('T')[0]}.xlsx`);
      setIsExportDialogOpen(false);
    } catch (error) {
      console.error('Error exporting to XLSX:', error);
      alert('Failed to export to XLSX. Please try CSV instead.');
    }
  };

  const handleAnalytics = () => {
    router.push(`/professor/sessions/${sessionId}`);
  };

  const handlePauseSession = async () => {
    try {
      setIsPausing(true);
      console.log('Pausing session:', sessionId);
      
      // Call the backend API to pause the session
      const response = await fetch(`/api/sessions/${sessionId}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update session state to reflect pause
          setSession(prev => prev ? { ...prev, is_active: false, status: 'paused' } : null);
          // Stop QR refresh timer when paused
          stopQRRefreshTimer();
          // Refresh attendance records to ensure counts are accurate
          await fetchAttendanceRecords();
          console.log('✅ Session paused successfully');
        } else {
          throw new Error(data.error || 'Failed to pause session');
        }
      } else {
        throw new Error('Failed to pause session');
      }
    } catch (error) {
      console.error('Error pausing session:', error);
      alert('Failed to pause session. Please try again.');
    } finally {
      setIsPausing(false);
    }
  };

  const handleResumeSession = async () => {
    try {
      setIsResuming(true);
      console.log('Resuming session:', sessionId);
      
      // Call the backend API to resume the session
      const response = await fetch(`/api/sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Update session state to reflect resume
          setSession(prev => prev ? { ...prev, is_active: true, status: 'active' } : null);
          // Restart QR refresh timer when resumed
          startQRRefreshTimer();
          // Refresh attendance records to ensure counts are accurate
          await fetchAttendanceRecords();
          console.log('✅ Session resumed successfully');
        } else {
          throw new Error(data.error || 'Failed to resume session');
        }
      } else {
        throw new Error('Failed to resume session');
      }
    } catch (error) {
      console.error('Error resuming session:', error);
      alert('Failed to resume session. Please try again.');
    } finally {
      setIsResuming(false);
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getAttendanceRate = () => {
    if (!session || !session.total_enrolled || session.total_enrolled === 0) return 0;
    return Math.round((session.attendance_count / session.total_enrolled) * 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-8 text-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Session Not Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested session could not be found.</p>
          <Link href="/professor/sessions">
            <Button>Back to Sessions</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center z-50">
        {/* Fullscreen Header */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">{session.class_code}</h1>
            <span className="text-lg opacity-75">{session.class_name}</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm opacity-75">{sessionExpired ? 'Session ended' : 'Session ends in'}</p>
              <p className="text-xl font-bold">{formatTime(timeRemaining)}</p>
            </div>
            <Button
              onClick={toggleFullscreen}
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10"
            >
              <Minimize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Fullscreen QR Code */}
        <div className="flex flex-col items-center justify-center text-white flex-1">
          <div className="w-96 h-96 bg-white rounded-2xl p-4 mb-8 shadow-2xl flex items-center justify-center">
            {session?.qr_code ? (
              <img 
                src={session.qr_code} 
                alt="Attendance QR Code" 
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  console.error('QR code failed to load:', e);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                <QrCode className="w-64 h-64 text-gray-400" />
              </div>
            )}
          </div>
          
          <h2 className="text-3xl font-bold mb-2">{session.class_code}</h2>
          <p className="text-xl mb-4">{session.class_name}</p>
          <p className="text-lg mb-2">
            {new Date(session.date).toLocaleDateString()} • {session.start_time} - {session.end_time}
          </p>
          <p className="text-lg mb-8">{session.room_location}</p>
          
          <div className="flex items-center justify-center space-x-8 text-lg">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${
                session.status === 'active' 
                  ? 'bg-green-400 animate-pulse' 
                  : session.status === 'paused'
                  ? 'bg-yellow-400'
                  : 'bg-gray-400'
              }`}></div>
              <span className="capitalize">{session.status}</span>
            </div>
            <div>
              <span className="font-bold text-2xl">{session.attendance_count}</span>
              <span className="opacity-75">/{session.total_enrolled} Students Scanned</span>
            </div>
            <div>
              <span>Refreshes in: </span>
              <span className="font-bold">{qrRefreshCountdown}s</span>
            </div>
          </div>
        </div>

        {/* Fullscreen Footer */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
          <div className="flex items-center space-x-6">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-green-400" />
              <span>{session.present_count} Present</span>
            </div>
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-yellow-400" />
              <span>{session.late_count} Late</span>
            </div>
            <div className="flex items-center">
              <XCircle className="w-5 h-5 mr-2 text-red-400" />
              <span>{session.absent_count} Absent</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {session.status === 'active' ? (
              <Button
                onClick={handlePauseSession}
                disabled={isPausing}
                variant="ghost"
                className="text-white hover:bg-white/10 disabled:opacity-50"
              >
                {isPausing ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Pausing...
                  </>
                ) : (
                  <>
                    <Pause className="w-5 h-5 mr-2" />
                    Pause
                  </>
                )}
              </Button>
            ) : session.status === 'paused' ? (
              <Button
                onClick={handleResumeSession}
                disabled={isResuming}
                variant="ghost"
                className="text-white hover:bg-white/10 disabled:opacity-50"
              >
                {isResuming ? (
                  <>
                    <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Resuming...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5 mr-2" />
                    Resume
                  </>
                )}
              </Button>
            ) : null}
            <Button
              onClick={() => setIsStopDialogOpen(true)}
              variant="ghost"
              className="text-white hover:bg-red-500/20"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop Session
            </Button>
          </div>
        </div>
        
        {/* Fullscreen Stop Session Dialog */}
        <Dialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <DialogHeader>
              <DialogTitle className="text-gray-900 dark:text-white">Stop Session</DialogTitle>
              <DialogDescription className="text-gray-600 dark:text-gray-400">
                Are you sure you want to stop this session? This will mark the session as completed and save all attendance data. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsStopDialogOpen(false)}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStopSession}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Yes, Stop Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Audio element for scan notifications */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/scan-beep.mp3" type="audio/mpeg" />
      </audio>

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/professor/sessions">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sessions
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    {session.class_code} - {new Date(session.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })} - {sessionExpired ? 'Session Ended' : 'Active Session'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {session.class_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {sessionExpired ? 'Session ended' : 'Session ends in'}
                </p>
                <p className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatTime(timeRemaining)}
                </p>
              </div>
              {!sessionExpired && (
                <Dialog open={isStopDialogOpen} onOpenChange={setIsStopDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      disabled={isCompleting}
                      className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                    >
                      {isCompleting ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Stopping...
                        </>
                      ) : (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          Stop Session
                        </>
                      )}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <DialogHeader>
                    <DialogTitle className="text-gray-900 dark:text-white">Stop Session</DialogTitle>
                    <DialogDescription className="text-gray-600 dark:text-gray-400">
                      Are you sure you want to stop this session? This will mark the session as completed and save all attendance data. This action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsStopDialogOpen(false)}
                      className="mr-2"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleStopSession}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Yes, Stop Session
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Session Expired Message */}
        {sessionExpired && (
          <div className="mb-8 p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                    Session Time Expired
                  </h3>
                  <p className="text-red-600 dark:text-red-300">
                    This session has automatically ended after 1 hour. You can view the attendance records below.
                  </p>
                </div>
              </div>
              <Link href="/professor/sessions">
                <Button className="bg-red-600 hover:bg-red-700 text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Sessions
                </Button>
              </Link>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* QR Code Section */}
          <div className="lg:col-span-2">
            <Card className="p-8 text-center bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Attendance QR Code
                  </h2>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      variant="ghost"
                      size="sm"
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </Button>
                    <Button
                      onClick={refreshQRCode}
                      variant="ghost"
                      size="sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={toggleFullscreen}
                      variant="ghost"
                      size="sm"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* QR Code Display */}
                <div className="w-80 h-80 bg-white rounded-2xl p-8 mx-auto mb-6 shadow-lg border border-gray-200 dark:border-gray-600">
                  {session?.qr_code ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <img 
                        src={session.qr_code} 
                        alt="Attendance QR Code" 
                        className="w-full h-full object-contain rounded-lg"
                        onError={(e) => {
                          console.error('QR code failed to load:', e);
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                      <QrCode className="w-48 h-48 text-gray-400" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {session.attendance_count}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Students Scanned</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {getAttendanceRate()}%
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Attendance Rate</p>
                  </div>
                </div>

                <div className="flex items-center justify-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center">
                    <Timer className="w-4 h-4 mr-1" />
                    Refreshes in {qrRefreshCountdown}s
                  </div>
                  <span>•</span>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(session.date).toLocaleDateString()}
                  </div>
                  <span>•</span>
                  <div className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {session.room_location}
                  </div>
                </div>
              </div>

              {/* Session Info */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mr-1" />
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {session.present_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Present</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-1" />
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">
                      {session.late_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Late</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-1" />
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {session.absent_count}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Absent</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Live Attendance Panel */}
          <div>
            <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Live Attendance
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Real-time student check-ins
                  </p>
                </div>
                <Button
                  onClick={() => setShowStudentList(!showStudentList)}
                  variant="ghost"
                  size="sm"
                >
                  {showStudentList ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>

              {lastScanTime && (
                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <Activity className="w-4 h-4 inline mr-1" />
                    Last scan: {lastScanTime.toLocaleTimeString()}
                  </p>
                </div>
              )}

              {showStudentList && (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {attendanceRecords.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        No students have scanned yet
                      </p>
                    </div>
                  ) : (
                    attendanceRecords.map((record) => (
                      <div
                        key={record.id}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                              {record.student_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {record.student_name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(record.scanned_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'present'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : record.status === 'late'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {record.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-white">Export Attendance Data</DialogTitle>
                        <DialogDescription className="text-gray-600 dark:text-gray-400">
                          Choose the format for downloading attendance data
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-2 gap-4 py-4">
                        <Button
                          onClick={exportToCSV}
                          variant="outline"
                          className="h-20 flex flex-col items-center justify-center space-y-2"
                        >
                          <FileText className="w-6 h-6" />
                          <span>CSV</span>
                        </Button>
                        <Button
                          onClick={exportToXLSX}
                          variant="outline"
                          className="h-20 flex flex-col items-center justify-center space-y-2"
                        >
                          <Table className="w-6 h-6" />
                          <span>XLSX</span>
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={handleAnalytics}
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Analytics
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function ActiveSessionPage() {
  return (
    <ProtectedRoute requiredRole="professor">
      <ActiveSessionContent />
    </ProtectedRoute>
  );
}
