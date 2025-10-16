'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import ProfileDropdown from '@/components/profile/profile-dropdown';
import ProfileEditModal from '@/components/profile/profile-edit-modal';
import PasswordChangeModal from '@/components/profile/password-change-modal';
import { supabase } from '@/lib/supabase';
import { 
  GraduationCap,
  QrCode, 
  Camera,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  MapPin,
  User,
  BookOpen,
  Calendar,
  BarChart3,
  Home,
  Moon,
  Sun,
  Loader2,
  Flashlight,
  FlashlightOff
} from 'lucide-react';

interface ScanResult {
  success: boolean;
  message: string;
  classData?: {
    id: string;
    class_code: string;
    class_name: string;
    professor: string;
    room: string;
    time: string;
  };
}

function StudentScanContent() {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [scanHistory, setScanHistory] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({
    scansToday: 0,
    present: 0,
    late: 0,
    absent: 0,
    excused: 0
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Dark mode setup
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode') === 'true';
    setIsDarkMode(savedMode);
    if (savedMode) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        const fallbackProfile = {
          first_name: user.user_metadata?.first_name || 'Student',
          last_name: user.user_metadata?.last_name || '',
          email: user.email || '',
          role: user.user_metadata?.role || 'student'
        };
        setUserProfile(fallbackProfile);
        return;
      }
      
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

      const handleProfileSave = async (profileData: any) => {
    if (!user) return;
    
    try {
      console.log('Attempting to save profile data:', profileData);
      console.log('User ID:', user.id);
      
      // Separate data for users table (only basic fields that exist)
      const usersTableData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        updated_at: new Date().toISOString()
      };
      
      // Additional data for auth metadata (fields not in users table)
      const authMetadataData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        phone: profileData.phone,
        office_location: profileData.office_location,
        title: profileData.title
      };
      
      // Update the users table with only existing columns
      const { error: usersError } = await supabase
        .from('users')
        .update(usersTableData)
        .eq('id', user.id);
      
      if (usersError) {
        console.error('Error updating users table:', usersError);
        throw new Error(`Failed to save profile: ${usersError.message}`);
      }
      
      
      // Update auth metadata for additional fields
      // DISABLED: Auth update causes redirect to landing page
      // const { error: authError } = await supabase.auth.updateUser({
      //   data: authMetadataData
      // });
      // 
      // if (authError) {
      //   console.warn('Warning: Could not update auth metadata:', authError.message);
      //   // Don't throw error here, as the main update succeeded
      // }
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, ...profileData }));
    } catch (error) {
      console.error('Error saving profile:', error);
      throw error;
    }
  };

  const handlePasswordChange = async (currentPassword: string, newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl } as any)
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setUserProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    
    try {
      // Remove avatar from storage if it exists
      if (userProfile?.avatar_url) {
        const fileName = userProfile.avatar_url.split('/').pop();
        if (fileName) {
          const { error: deleteError } = await supabase.storage
            .from('avatars')
            .remove([`avatars/${fileName}`]);
          
          if (deleteError) {
            console.warn('Error deleting avatar from storage:', deleteError);
          }
        }
      }
      
      // Update user profile to remove avatar_url
      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: null } as any)
        .eq('id', user.id);
      
      if (updateError) throw updateError;
      
      setUserProfile((prev: any) => ({ ...prev, avatar_url: null }));
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchUserProfile();
    fetchScanHistory();
    fetchTodayStats();
    
    // Check if QR code data is in URL parameters (from scanning)
    const qrDataParam = searchParams.get('data');
    if (qrDataParam) {
      if (user) {
        // User is authenticated, process the QR code
        try {
          const qrData = JSON.parse(decodeURIComponent(qrDataParam));
          console.log('QR code data from URL:', qrData);
          processQRCode(JSON.stringify(qrData));
        } catch (error) {
          console.error('Error parsing QR code data from URL:', error);
          setScanResult({
            success: false,
            message: 'Invalid QR code data'
          });
        }
      } else {
        // User is not authenticated, redirect to login with QR data preserved
        const loginUrl = `/student/login?redirect=${encodeURIComponent(window.location.href)}`;
        router.push(loginUrl);
      }
    }
  }, [user, searchParams]);

  const fetchTodayStats = async () => {
    if (!user) return;
    
    try {
      setStatsLoading(true);
      
      // Get student ID
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('user_id', user.id)
        .single();

      if (studentError || !studentData) {
        console.error('Student profile not found');
        setStatsLoading(false);
        return;
      }

      // Fetch today's stats from API
      const response = await fetch(`/api/attendance/student/${studentData.student_id}/today-stats`);
      const result = await response.json();

      if (result.success) {
        setTodayStats(result.stats);
      } else {
        console.error('Error fetching today\'s stats:', result.error);
        // Keep default values (0s)
      }
      
      setStatsLoading(false);
    } catch (error) {
      console.error('Error fetching today\'s stats:', error);
      setStatsLoading(false);
    }
  };

  const fetchScanHistory = async () => {
    if (!user) return;
    
    try {
      // Get student ID
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('user_id', user.id)
        .single();

      if (studentError || !studentData) {
        console.error('Student profile not found');
        return;
      }

      // Fetch real attendance history with class details
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          *,
          class_sessions!inner(
            id,
            date,
            start_time,
            end_time,
            room_location,
            class_instance_id,
            class_instances!inner(
              courses(code, name),
              professor_id,
              users!professors_users_fkey(first_name, last_name)
            )
          )
        `)
        .eq('student_id', studentData.student_id)
        .order('scanned_at', { ascending: false })
        .limit(20);

      if (attendanceError) {
        console.error('Error fetching attendance history:', attendanceError);
        return;
      }

      // Transform data for display with real class information
      const history = attendanceData?.map(record => {
        const session = record.class_sessions;
        const classInstance = session?.class_instances;
        const course = classInstance?.courses;
        const professor = classInstance?.users;
        
        return {
          id: record.id,
          class_code: course?.code || 'N/A',
          class_name: course?.name || 'Unknown Class',
          professor: professor ? `${professor.first_name} ${professor.last_name}` : 'Unknown Professor',
          room: session?.room_location || 'TBD',
          time: session?.start_time && session?.end_time 
            ? `${session.start_time}-${session.end_time}` 
            : 'TBD',
          status: record.status,
          scanned_at: record.scanned_at || record.created_at
        };
      }) || [];

      setScanHistory(history);
    } catch (error) {
      console.error('Error fetching scan history:', error);
    }
  };

  const startScanning = async () => {
    try {
      setIsScanning(true);
      setScanResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setScanResult({
        success: false,
        message: 'Unable to access camera. Please check permissions.'
      });
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const processQRCode = async (qrData: string) => {
    try {
      // Parse the QR code data
      const qrDataObj = JSON.parse(qrData);
      
      // Validate QR code structure
      if (!qrDataObj.sessionId || !qrDataObj.timestamp || !qrDataObj.signature) {
        throw new Error('Invalid QR code format');
      }

      // Get student ID from user
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Get student ID from the students table
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('student_id')
        .eq('user_id', user.id)
        .single();

      if (studentError || !studentData) {
        throw new Error('Student profile not found');
      }

      // Submit attendance scan
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/attendance/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qrData: qrDataObj,
          studentId: studentData.student_id
        }),
      });

      const result = await response.json();

      if (result.success) {
        setScanResult({
          success: true,
          message: result.message || 'Attendance marked successfully!',
          classData: result.classData
        });
        
        // Refresh scan history and today's stats with real data
        await Promise.all([fetchScanHistory(), fetchTodayStats()]);
      } else {
        setScanResult({
          success: false,
          message: result.error || 'Failed to mark attendance'
        });
      }
      
      stopScanning();
    } catch (error) {
      console.error('Error processing QR code:', error);
      setScanResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to process QR code'
      });
      stopScanning();
    }
  };


  const toggleFlashlight = () => {
    setFlashlightOn(!flashlightOn);
    // In a real implementation, you would control the device flashlight here
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present':
        return 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900';
      case 'late':
        return 'text-amber-600 bg-amber-100 dark:bg-amber-900';
      case 'absent':
        return 'text-red-600 bg-red-100 dark:bg-red-900';
      default:
        return 'text-slate-600 bg-slate-100 dark:bg-slate-900';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="w-4 h-4" />;
      case 'late':
        return <Clock className="w-4 h-4" />;
      case 'absent':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Top Navigation */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/student/dashboard" className="flex items-center space-x-3 group">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white">FSAS</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Student Portal</p>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              <Link href="/student/dashboard">
                <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/student/scan">
                <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-800">
                  <QrCode className="w-4 h-4 mr-2" />
                  Scan QR
                </Button>
              </Link>
              <Link href="/student/attendance">
                <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-700">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Attendance
                </Button>
              </Link>
              <Link href="/student/classes">
                <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-700">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Classes
                </Button>
              </Link>
            </nav>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Time */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <NotificationPanel />
              <button
                onClick={toggleDarkMode}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-amber-500" />
                ) : (
                  <Moon className="w-5 h-5 text-slate-600" />
                )}
              </button>
              <ProfileDropdown
                user={user}
                userProfile={userProfile}
                onSignOut={signOut}
                onEditProfile={() => setShowProfileEdit(true)}
                onChangePassword={() => setShowPasswordChange(true)}
                onUploadAvatar={handleAvatarUpload}
                onDeleteAvatar={handleDeleteAvatar}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
            QR Code Scanner
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-400">
            Scan QR codes to mark your attendance
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scanner Section */}
          <div className="lg:col-span-2">
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <QrCode className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Camera Scanner</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Position QR code within the frame
                  </p>
                </div>
              </div>

              {/* Scanner Area */}
              <div className="relative bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden mb-6">
                {isScanning ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-64 object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-48 h-48 border-2 border-emerald-500 rounded-lg relative">
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button
                        onClick={toggleFlashlight}
                        className="p-2 bg-black/50 text-white rounded-lg hover:bg-black/70 transition-colors"
                      >
                        {flashlightOn ? <FlashlightOff className="w-5 h-5" /> : <Flashlight className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <Camera className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
                      <p className="text-slate-600 dark:text-slate-400">Camera not active</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Scanner Controls */}
              <div className="flex space-x-4">
                {!isScanning ? (
                  <Button
                    onClick={startScanning}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Start Scanning
                  </Button>
                ) : (
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Stop Scanning
                  </Button>
                )}
              </div>

              {/* Scan Result */}
              {scanResult && (
                <div className={`mt-6 p-4 rounded-xl border ${
                  scanResult.success 
                    ? 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-800' 
                    : 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-800'
                }`}>
                  <div className="flex items-center space-x-3">
                    {scanResult.success ? (
                      <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                    )}
                    <div>
                      <p className={`font-semibold ${
                        scanResult.success 
                          ? 'text-emerald-800 dark:text-emerald-200' 
                          : 'text-red-800 dark:text-red-200'
                      }`}>
                        {scanResult.message}
                      </p>
                      {scanResult.classData && (
                        <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          <p><strong>Class:</strong> {scanResult.classData.class_code} - {scanResult.classData.class_name}</p>
                          <p><strong>Professor:</strong> {scanResult.classData.professor}</p>
                          <p><strong>Room:</strong> {scanResult.classData.room}</p>
                          <p><strong>Time:</strong> {scanResult.classData.time}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Scan History */}
          <div className="space-y-6">
            <Card className="p-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Scans</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Recent scans</p>
                </div>
              </div>

              <div className="space-y-3">
                {scanHistory.slice(0, 10).map((scan) => (
                  <div
                    key={scan.id}
                    className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {scan.class_code}
                      </h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(scan.status)}`}>
                        {scan.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                      {scan.class_name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">
                      {new Date(scan.scanned_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-5 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Today's Stats</h3>
              {statsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Scans Today</span>
                    <span className="text-lg font-bold text-slate-900 dark:text-white">{todayStats.scansToday}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Present</span>
                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{todayStats.present}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Late</span>
                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{todayStats.late}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Absent</span>
                    <span className="text-lg font-bold text-red-600 dark:text-red-400">{todayStats.absent}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600 dark:text-slate-400">Excused</span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{todayStats.excused}</span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      {/* Profile Edit Modal */}
      <ProfileEditModal
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        user={user}
        userProfile={userProfile}
        onSave={handleProfileSave}
      />

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={showPasswordChange}
        onClose={() => setShowPasswordChange(false)}
        onChangePassword={handlePasswordChange}
      />
    </div>
  );
}

export default function StudentScan() {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentScanContent />
    </ProtectedRoute>
  );
}
