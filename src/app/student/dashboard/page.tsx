'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { NotificationPanel } from '@/components/notifications/notification-panel';
import ProfileDropdown from '@/components/profile/profile-dropdown';
import ProfileEditModal from '@/components/profile/profile-edit-modal';
import PasswordChangeModal from '@/components/profile/password-change-modal';
import StudentNavigation from '@/components/student/student-navigation';
import { StatsCard } from '@/components/student/stats-card';
import { ClassCard } from '@/components/student/class-card';
import { supabase } from '@/lib/supabase';
import { StudentDashboardService } from '@/lib/student-dashboard-service';
import { useStudentDashboard } from '@/hooks/use-student-dashboard-cached';
import { createLogger } from '../../../lib/logger';
const logger = createLogger('page');
import { 
  GraduationCap,
  QrCode, 
  Calendar,
  TrendingUp,
  Clock,
  BookOpen,
  BarChart3,
  Moon,
  Sun,
  Home,
  RefreshCw
} from 'lucide-react';

interface StudentData {
  student_id: string;
  student_number: string;
  enrollment_year: number;
  major: string;
  graduation_year: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  is_active: boolean;
  account_created: string;
}

interface ClassSession {
  id: string;
  class_code: string;
  class_name: string;
  time: string;
  room: string;
  professor: string;
  status: 'upcoming' | 'ongoing' | 'completed';
}

interface AttendanceRecord {
  date: string;
  status: 'present' | 'absent' | 'late';
  class_name: string;
}

function StudentDashboardContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const { user, signOut } = useAuth();
  const router = useRouter();

  // Use custom hook for dashboard data
  const {
    studentData,
    todayClasses,
    stats,
    userProfile,
    isLoading,
    statsLoading,
    refreshData,
    setUserProfile
  } = useStudentDashboard(user);


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
      logger.log('🔍 Fetching user profile for user ID:', user.id);
      logger.log('🔍 User metadata:', user.user_metadata);
      
      const { data, error } = await supabase
        .from('users' as any)
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        logger.error('Error fetching user profile:', error);
        logger.log('🔍 Falling back to user metadata');
        
        // Create a basic profile from user metadata
        const fallbackProfile = {
          first_name: user.user_metadata?.first_name || 'Student',
          last_name: user.user_metadata?.last_name || '',
          email: user.email || '',
          role: user.user_metadata?.role || 'student',
          phone: user.user_metadata?.phone || '',
          office_location: user.user_metadata?.office_location || '',
          title: user.user_metadata?.title || ''
        };
        
        logger.log('🔍 Using fallback profile:', fallbackProfile);
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
      
      logger.log('✅ User profile fetched:', completeProfile);
      setUserProfile(completeProfile);
    } catch (error) {
      logger.error('Error fetching user profile:', error);
    }
  };

  const handleProfileSave = async (profileData: any) => {
    if (!user) return;
    
    try {
      // Check if names changed and handle name change tracking
      const namesChanged = profileData.first_name !== userProfile?.first_name || profileData.last_name !== userProfile?.last_name;
      
      if (namesChanged) {
        logger.log('Names changed, checking name change limits...');
        
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
        
        logger.log('Name change recorded successfully:', nameChangeResult);
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
        logger.error('Error updating users table:', usersError);
        throw new Error(`Failed to save profile: ${usersError.message}`);
      }
      
      // DISABLED: Auth update causes redirect to landing page
      // if (namesChanged) {
      //   const { error: authError } = await supabase.auth.updateUser({
      //     data: authMetadataData
      //   });
      //   
      //   if (authError) {
      //     logger.warn('Warning: Could not update auth metadata:', authError.message);
      //     // Don't throw error here, as the main update succeeded
      //   }
      // }
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, ...profileData }));
    } catch (error) {
      logger.error('Error saving profile:', error);
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

      const { data: studentData } = await supabase
        .from('students')
        .select('student_id')
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
          studentNumber: studentData?.student_id
        },
        signOut
      );

      if (!result.success) {
        throw new Error(result.error || 'Password change failed');
      }
    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user) {
      logger.error('No user found for avatar upload');
      throw new Error('User not authenticated');
    }
    
    try {
      logger.log('Starting avatar upload for user:', user.id);
      
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
      
      logger.log('Uploading file to path:', filePath);
      
      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (uploadError) {
        logger.error('Storage upload error:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }
      
      logger.log('File uploaded successfully:', uploadData);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      logger.log('Public URL generated:', publicUrl);
      
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
        logger.error('Database update error:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      logger.log('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      
      logger.log('Avatar upload completed successfully');
    } catch (error) {
      logger.error('Error uploading avatar:', error);
      throw error;
    }
  };

  const handleAvatarDelete = async () => {
    if (!user) {
      logger.error('No user found for avatar deletion');
      throw new Error('User not authenticated');
    }
    
    try {
      logger.log('Starting avatar deletion for user:', user.id);
      
      // Get current avatar URL to extract file path
      const currentAvatarUrl = userProfile?.avatar_url;
      if (!currentAvatarUrl) {
        throw new Error('No avatar to delete');
      }
      
      // Extract file path from URL
      const urlParts = currentAvatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `avatars/${fileName}`;
      
      logger.log('Deleting file from path:', filePath);
      
      // Delete file from Supabase Storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);
      
      if (deleteError) {
        logger.error('Storage deletion error:', deleteError);
        throw new Error(`Failed to delete file: ${deleteError.message}`);
      }
      
      logger.log('File deleted successfully from storage');
      
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
        logger.error('Database update error:', updateError);
        throw new Error(`Failed to update profile: ${updateError.message}`);
      }
      
      logger.log('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: null }));
      
      logger.log('Avatar deletion completed successfully');
    } catch (error) {
      logger.error('Error deleting avatar:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-700 dark:text-slate-300 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-safe">
      {/* Top Navigation - Clean & Minimal */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 safe-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
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
            <StudentNavigation />

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Time */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Notifications */}
              <NotificationPanel />

              {/* Theme Toggle */}
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

              {/* Profile Dropdown */}
              <ProfileDropdown
                user={user}
                userProfile={userProfile}
                onSignOut={signOut}
                onEditProfile={() => setShowProfileEdit(true)}
                onChangePassword={() => setShowPasswordChange(true)}
                onUploadAvatar={handleAvatarUpload}
                onDeleteAvatar={handleAvatarDelete}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}{userProfile?.first_name ? `, ${userProfile.first_name}` : ''}! 👋
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'long', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </p>
            </div>
            <Button
              onClick={refreshData}
              variant="outline"
              size="sm"
              className="hover:bg-slate-100 dark:hover:bg-slate-700"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <StatsCard
            title="Overall Attendance"
            value={`${stats.overallAttendance}%`}
            subtitle="This semester"
            icon={TrendingUp}
            iconColor="text-emerald-600 dark:text-emerald-400"
            iconBg="bg-emerald-100 dark:bg-emerald-900"
            isLoading={statsLoading}
          />
          <StatsCard
            title="Total Classes"
            value={stats.totalClasses}
            subtitle="Enrolled this semester"
            icon={BookOpen}
            iconColor="text-blue-600 dark:text-blue-400"
            iconBg="bg-blue-100 dark:bg-blue-900"
            isLoading={statsLoading}
          />
          <StatsCard
            title="Classes Today"
            value={stats.classesToday}
            subtitle="Scheduled sessions"
            icon={Calendar}
            iconColor="text-amber-600 dark:text-amber-400"
            iconBg="bg-amber-100 dark:bg-amber-900"
            isLoading={statsLoading}
          />
          <StatsCard
            title="Attendance Streak"
            value={stats.attendanceStreak}
            subtitle="Days in a row"
            icon={Clock}
            iconColor="text-purple-600 dark:text-purple-400"
            iconBg="bg-purple-100 dark:bg-purple-900"
            isLoading={statsLoading}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Today's Classes */}
          <div>
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Today's Classes</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {todayClasses.length} classes scheduled for today
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  // Loading skeleton for classes
                  Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                      <div className="animate-pulse">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="h-6 bg-slate-200 dark:bg-slate-600 rounded w-24 mb-2"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded w-48 mb-3"></div>
                            <div className="space-y-2">
                              <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-32"></div>
                              <div className="h-3 bg-slate-200 dark:bg-slate-600 rounded w-24"></div>
                            </div>
                          </div>
                          <div className="h-10 bg-slate-200 dark:bg-slate-600 rounded w-20"></div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : todayClasses.length > 0 ? (
                  todayClasses.map((classSession) => (
                    <ClassCard
                      key={classSession.id}
                      classData={{
                        ...classSession,
                        schedule: classSession.time, // Map time to schedule
                        attendance_rate: 0, // Default value since it's not available in ClassSession
                      } as any}
                      showAttendanceStatus={true}
                      compact={true}
                    />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">No classes scheduled for today</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500">Check back tomorrow or view your full schedule</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div>
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Quick Actions</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Access your most used features
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <Link href="/student/scan">
                  <Button className="w-full justify-start bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-lg shadow-lg h-12">
                    <QrCode className="w-5 h-5 mr-3" />
                    Scan QR Code
                  </Button>
                </Link>
                <Link href="/student/attendance">
                  <Button variant="outline" className="w-full justify-start hover:bg-blue-50 dark:hover:bg-blue-900 border-slate-300 dark:border-slate-600 rounded-lg h-12">
                    <BarChart3 className="w-5 h-5 mr-3" />
                    View Attendance
                  </Button>
                </Link>
                <Link href="/student/classes">
                  <Button variant="outline" className="w-full justify-start hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 rounded-lg h-12">
                    <BookOpen className="w-5 h-5 mr-3" />
                    My Classes
                  </Button>
                </Link>
              </div>
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

export default function StudentDashboard() {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentDashboardContent />
    </ProtectedRoute>
  );
}
