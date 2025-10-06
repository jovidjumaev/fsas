'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { 
  BookOpen, Users, QrCode, BarChart3, Clock, Bell, Settings, LogOut, 
  Plus, Play, Eye, Home, GraduationCap, Moon, Sun, MapPin, 
  CheckCircle, XCircle, AlertCircle, Calendar, Activity, TrendingUp
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProfessorHeader from '@/components/professor/professor-header';
import ProfileEditModal from '@/components/profile/profile-edit-modal';
import PasswordChangeModal from '@/components/profile/password-change-modal';
import { supabase } from '@/lib/supabase';
import { io } from 'socket.io-client';

interface ProfessorStats {
  totalClasses: number;
  totalStudents: number;
  activeSessions: number;
  averageAttendance: number;
}

interface ClassData {
  id: string;
  code: string;
  name: string;
  room_location: string;
  schedule_info: string;
  enrolled_students: number;
  max_students: number;
  attendance_rate: number;
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
  next_session?: {
    date: string;
    start_time: string;
    end_time: string;
  };
  status: 'active' | 'upcoming' | 'completed';
  isToday?: boolean;
  today_session_id?: string | null;
  active_session_id?: string | null;
}

interface ActiveSession {
  id: string;
  class_code: string;
  class_name: string;
  present_count: number;
  total_students: number;
  qr_code_expires_at: string;
}

function ProfessorDashboardContent() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState<ProfessorStats>({
    totalClasses: 0,
    totalStudents: 0,
    activeSessions: 0,
    averageAttendance: 0
  });
  const [myClasses, setMyClasses] = useState<ClassData[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      
      // Connect to WebSocket for real-time updates
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      
      // Join professor dashboard room
      socket.emit('join-professor-dashboard', user.id);
      
      // Listen for attendance updates
      socket.on('dashboard-attendance-update', (data) => {
        console.log('📊 Received attendance update:', data);
        
        // Update the classes state with new attendance data
        setMyClasses((prevClasses: ClassData[]) => 
          prevClasses.map((cls: ClassData) => {
            // Find if this class has an active session matching the updated session
            const hasActiveSession = activeSessions.some(session => 
              session.id === data.sessionId && 
              session.class_code === cls.code
            );
            
            if (hasActiveSession) {
              // Update attendance rate for this class
              return {
                ...cls,
                attendance_rate: data.attendanceRate
              };
            }
            return cls;
          })
        );
        
        // Update active sessions if needed
        setActiveSessions(prevSessions =>
          prevSessions.map(session => {
            if (session.id === data.sessionId) {
              return {
                ...session,
                present_count: data.attendanceCount,
                attendance_rate: data.attendanceRate
              };
            }
            return session;
          })
        );
      });
      
      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  // Refresh data when page becomes visible (e.g., when returning from other pages)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) {
        fetchDashboardData();
      }
    };

    const handleFocus = () => {
      if (user) {
        fetchDashboardData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      console.log('🔍 Fetching user profile for user ID:', user.id);
      console.log('🔍 User metadata:', user.user_metadata);
      
      const { data, error } = await supabase
        .from('users' as any)
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        console.log('🔍 Falling back to user metadata');
        
        // Create a basic profile from user metadata
        const fallbackProfile = {
          first_name: user.user_metadata?.first_name || 'User',
          last_name: user.user_metadata?.last_name || '',
          email: user.email || '',
          role: user.user_metadata?.role || 'professor',
          phone: user.user_metadata?.phone || '',
          office_location: user.user_metadata?.office_location || '',
          title: user.user_metadata?.title || ''
        };
        
        console.log('🔍 Using fallback profile:', fallbackProfile);
        setUserProfile(fallbackProfile);
        return;
      }
      
      // Combine database data with auth metadata for complete profile
      const completeProfile = {
        ...(data as any || {}),
        phone: user.user_metadata?.phone || '',
        office_location: user.user_metadata?.office_location || '',
        title: user.user_metadata?.title || ''
      };
      
      console.log('✅ User profile fetched:', completeProfile);
      setUserProfile(completeProfile);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleProfileSave = async (profileData: any) => {
    if (!user) return;
    
    try {
      console.log('Attempting to save profile data:', profileData);
      console.log('User ID:', user.id);
      
      // Check if names changed and handle name change tracking
      const namesChanged = profileData.first_name !== userProfile?.first_name || profileData.last_name !== userProfile?.last_name;
      
      if (namesChanged) {
        console.log('Names changed, checking name change limits...');
        
        // Import and use the name change service
        const { NameChangeService } = await import('@/lib/name-change-service');
        
        // Check if user can change their name
        const nameChangeInfo = await NameChangeService.getNameChangeInfo(user.id);
        
        if (!nameChangeInfo.canChange) {
          throw new Error('Name change limit reached for this month. Please try again next month.');
        }
        
        // Record the name change
        const nameChangeResult = await NameChangeService.changeName(
          user.id,
          userProfile?.first_name || '',
          userProfile?.last_name || '',
          profileData.first_name,
          profileData.last_name,
          profileData.nameChangeReason || 'Name change via profile edit'
        );
        
        if (!nameChangeResult.success) {
          throw new Error(nameChangeResult.message);
        }
        
        console.log('Name change recorded successfully:', nameChangeResult);
      }
      
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
        .from('users' as any)
        .update(usersTableData)
        .eq('id', user.id);
      
      if (usersError) {
        console.error('Error updating users table:', usersError);
        throw new Error(`Failed to save profile: ${usersError.message}`);
      }
      
      
      // Update auth metadata for additional fields (only if names changed)
      // DISABLED: Auth update causes redirect to landing page
      // if (namesChanged) {
      //   const { error: authError } = await supabase.auth.updateUser({
      //     data: authMetadataData
      //   });
      //   
      //   if (authError) {
      //     console.warn('Warning: Could not update auth metadata:', authError.message);
      //     // Don't throw error here, as the main update succeeded
      //   }
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
      if (!user) {
        throw new Error('User not found');
      }

      // Get user profile information for validation
      const { data: profileData } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', user.id)
        .single();

      const { data: professorData } = await supabase
        .from('professors')
        .select('employee_id')
        .eq('user_id', user.id)
        .single();

      // Import and use the password change service
      const { PasswordChangeService } = await import('@/lib/password-change-service');
      
      const result = await PasswordChangeService.changePassword(
        user.id,
        user.email || '',
        currentPassword,
        newPassword,
        {
          firstName: profileData?.first_name || user.user_metadata?.first_name,
          lastName: profileData?.last_name || user.user_metadata?.last_name,
          employeeId: professorData?.employee_id
        }
      );

      if (!result.success) {
        throw new Error(result.error || 'Password change failed');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) {
      console.error('No user found for avatar upload');
      throw new Error('User not authenticated');
    }
    
    try {
      console.log('Starting avatar upload for user:', user.id);
      
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      }
      
      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        throw new Error('File size too large. Please upload an image smaller than 5MB.');
      }
      
      // Create a unique filename
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      console.log('Uploading file to path:', filePath);
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
      
      console.log('File uploaded successfully:', uploadData);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      console.log('Public URL generated:', publicUrl);
      
      // Update user profile with avatar URL
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ 
          avatar_url: publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();
      
      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      console.log('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      
      console.log('Avatar upload completed successfully');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  };

  const handleAvatarDelete = async () => {
    if (!user) {
      console.error('No user found for avatar deletion');
      throw new Error('User not authenticated');
    }
    
    try {
      console.log('Starting avatar deletion for user:', user.id);
      
      // Get current avatar URL to extract file path
      const currentAvatarUrl = userProfile?.avatar_url;
      if (!currentAvatarUrl) {
        throw new Error('No avatar to delete');
      }
      
      // Extract file path from URL
      const urlParts = currentAvatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `avatars/${fileName}`;
      
      console.log('Deleting file from path:', filePath);
      
      // Delete file from Supabase Storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);
      
      if (deleteError) {
        console.error('Storage deletion error:', deleteError);
        throw new Error(`Failed to delete file: ${deleteError.message}`);
      }
      
      console.log('File deleted successfully from storage');
      
      // Update user profile to remove avatar URL
      const { data: updateData, error: updateError } = await supabase
        .from('users')
        .update({ 
          avatar_url: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select();
      
      if (updateError) {
        console.error('Database update error:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      console.log('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: null }));
      
      console.log('Avatar deletion completed successfully');
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  };

  const startSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sessions/${sessionId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) throw new Error('Failed to start session');
      
      // Refresh dashboard data to update status
      await fetchDashboardData();
      
      // Navigate to active session page
      window.location.href = `/professor/sessions/active/${sessionId}`;
    } catch (error) {
      console.error('Error starting session:', error);
      alert('Failed to start session. Please try again.');
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch user profile
      await fetchUserProfile();
      
      if (!user?.id) {
        console.error('No user ID available');
        return;
      }

      // Fetch real dashboard data from API
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/professors/${user.id}/dashboard`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }
      
      const result = await response.json();
      
      if (result.success) {
        const { stats, classes, activeSessions, todayClasses } = result.data;
        
        setStats(stats);
        setMyClasses(classes);
        setActiveSessions(activeSessions);
        setTodayClasses(todayClasses);
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data');
      }
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback to empty data on error
      setStats({
        totalClasses: 0,
        totalStudents: 0,
        activeSessions: 0,
        averageAttendance: 0
      });
      setMyClasses([]);
      setActiveSessions([]);
      setTodayClasses([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500 text-white';
      case 'upcoming':
        return 'bg-blue-500 text-white';
      case 'completed':
        return 'bg-gray-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (rate >= 80) return 'text-blue-600 dark:text-blue-400';
    if (rate >= 70) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <ProfessorHeader
        currentPage="dashboard"
                userProfile={userProfile}
                onSignOut={handleSignOut}
                onEditProfile={() => setShowProfileEdit(true)}
                onChangePassword={() => setShowPasswordChange(true)}
                onUploadAvatar={handleAvatarUpload}
                onDeleteAvatar={handleAvatarDelete}
              />

      {/* Main Content - Simplified */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                Welcome back{userProfile?.first_name ? `, ${userProfile.first_name}` : ''}! 👋
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                {currentTime.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric'
                })}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/professor/sessions">
                <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200">
                  <QrCode className="w-5 h-5 mr-2" />
                  View Sessions
                </Button>
              </Link>
              <Link href="/professor/classes?create=true">
                <Button variant="outline" className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 px-6 py-3 rounded-lg">
                  <Plus className="w-5 h-5 mr-2" />
                  New Class
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Key Metrics - Simplified */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Classes */}
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Total Classes
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalClasses}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          {/* Total Students */}
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Total Students
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">
                  {stats.totalStudents}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>

          {/* Active Sessions */}
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Active Sessions
                </p>
                <div className="flex items-center space-x-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {stats.activeSessions}
                  </p>
                  {stats.activeSessions > 0 && (
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  )}
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>

          {/* Average Attendance */}
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Avg Attendance
                </p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">
                    {stats.averageAttendance}%
                  </p>
                  </div>
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content - Simplified */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Today's Classes */}
          <div>
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Today's Classes</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {todayClasses.length} classes scheduled
                    </p>
                  </div>
                </div>
              </div>

              {todayClasses.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Calendar className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No classes today
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Enjoy your day off! 🌟
                  </p>
                  <Link href="/professor/classes?create=true">
                    <Button variant="outline" className="border-slate-300 dark:border-slate-600">
                      <Plus className="w-4 h-4 mr-2" />
                      Create New Class
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayClasses.map((classData) => (
                    <div
                      key={classData.id}
                      className="p-4 rounded-xl border-2 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-900/20 dark:to-indigo-900/10 border-blue-100 dark:border-blue-800/50 hover:shadow-lg hover:border-blue-200 dark:hover:border-blue-700 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between gap-4">
                        {/* Left Side - Class Info */}
                        <div className="flex-1 space-y-2">
                          {/* Class Code and Status Badge */}
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              classData.status === 'active' ? 'bg-emerald-500 animate-pulse shadow-lg shadow-emerald-500/50' :
                              classData.status === 'upcoming' ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-slate-400'
                            }`}></div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                              {classData.code}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              classData.status === 'active' 
                                ? 'bg-emerald-500 text-white' 
                                : classData.status === 'upcoming'
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-500 text-white'
                            }`}>
                              {classData.status}
                            </span>
                          </div>

                          {/* Class Name */}
                          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            {classData.name}
                          </h4>

                          {/* Schedule and Students Info */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span className="font-medium">
                                {classData.days_of_week?.join(', ') || 'No schedule'}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">•</span>
                              <span className="font-semibold">
                                {classData.start_time} - {classData.end_time}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                              <span className="font-semibold">
                                {classData.enrolled_students}/{classData.max_students}
                              </span>
                              <span className="font-medium">students</span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Side - Attendance and Action Button Stacked */}
                        <div className="flex flex-col gap-2">
                          {/* Attendance Badge */}
                          <div className="flex items-center gap-2 px-3 py-2 min-w-[140px] bg-white dark:bg-slate-700/50 rounded-lg border-2 border-slate-200 dark:border-slate-600 shadow-sm">
                            <BarChart3 className={`w-5 h-5 ${getAttendanceColor(classData.attendance_rate)}`} />
                            <div className="flex-1 text-center">
                              <p className={`text-xl font-bold leading-none ${getAttendanceColor(classData.attendance_rate)}`}>
                                {classData.attendance_rate}%
                              </p>
                              <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">Attendance</p>
                            </div>
                          </div>

                          {/* Action Button */}
                          {classData.status === 'upcoming' && classData.today_session_id && (
                            <Button 
                              onClick={() => startSession(classData.today_session_id!)}
                              className="w-full px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                            >
                              <Play className="w-4 h-4 fill-white" />
                              <span className="font-semibold text-sm">Start</span>
                            </Button>
                          )}
                          {classData.status === 'active' && classData.active_session_id && (
                            <Link href={`/professor/sessions/active/${classData.active_session_id}`}>
                              <Button className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2">
                                <Eye className="w-4 h-4" />
                                <span className="font-semibold text-sm">View</span>
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Active Sessions */}
          <div>
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Active Sessions</h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {activeSessions.length} sessions running
                    </p>
                </div>
              </div>
                </div>

              {activeSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <QrCode className="w-8 h-8 text-slate-400" />
                      </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                    No active sessions
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">
                    Start a session to begin tracking attendance
                  </p>
                  <Link href="/professor/sessions">
                    <Button className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white">
                      <QrCode className="w-4 h-4 mr-2" />
                      View Sessions
                  </Button>
                </Link>
              </div>
              ) : (
              <div className="space-y-3">
                  {activeSessions.map((session) => (
                  <div
                    key={session.id}
                      className="p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 rounded-lg border border-emerald-200 dark:border-emerald-700"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {session.class_code}
                            </h3>
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              {session.class_name}
                            </p>
                    </div>
                      </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {session.present_count}/{session.total_students}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Present</p>
                    </div>
                  </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          QR expires: {new Date(session.qr_code_expires_at).toLocaleTimeString()}
                        </span>
                        <Link href={`/professor/sessions/active/${session.id}`}>
                          <Button className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white px-4 py-2 rounded-lg">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                  </Button>
                </Link>
              </div>
                    </div>
                  ))}
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

export default function ProfessorDashboard() {
  return (
    <ProtectedRoute requiredRole="professor">
      <ProfessorDashboardContent />
    </ProtectedRoute>
  );
}