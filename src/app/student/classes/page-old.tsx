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
import { ClassCard } from '@/components/student/class-card';
import { useStudentClasses } from '@/hooks/use-student-classes';
import { supabase } from '@/lib/supabase';
import { createLogger } from '../../../lib/logger';
const logger = createLogger('page');
import { 
  GraduationCap,
  Calendar,
  TrendingUp,
  Clock,
  BookOpen,
  BarChart3,
  Home,
  Moon,
  Sun,
  Search,
  RefreshCw,
  AlertCircle,
  QrCode
} from 'lucide-react';

function StudentClassesContent() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [academicPeriodFilter, setAcademicPeriodFilter] = useState<string>('all');
  const { user, signOut } = useAuth();
  const router = useRouter();

  const {
    classes,
    stats,
    isLoading,
    error,
    refreshData
  } = useStudentClasses(user);

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
      logger.error('Error fetching user profile:', error);
    }
  };

      const handleProfileSave = async (profileData: any) => {
    if (!user) return;
    
    try {
      logger.log('Attempting to save profile data:', profileData);
      logger.log('User ID:', user.id);
      
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
        logger.error('Error updating users table:', usersError);
        throw new Error(`Failed to save profile: ${usersError.message}`);
      }
      
      
      // Update auth metadata for additional fields
      // DISABLED: Auth update causes redirect to landing page
      // const { error: authError } = await supabase.auth.updateUser({
      //   data: authMetadataData
      // });
      // 
      // if (authError) {
      //   logger.warn('Warning: Could not update auth metadata:', authError.message);
      //   // Don't throw error here, as the main update succeeded
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      
      if (error) throw error;
    } catch (error) {
      logger.error('Error changing password:', error);
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
      logger.error('Error uploading avatar:', error);
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
            logger.warn('Error deleting avatar from storage:', deleteError);
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
      logger.error('Error deleting avatar:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, [user]);

  // Get unique academic periods for filter options
  const academicPeriods = Array.from(new Set(classes.map(cls => cls.academic_period))).sort();

  // Filter classes based on search term and academic period
  const filteredClasses = classes.filter(cls => {
    // Safety check - ensure class object exists
    if (!cls || !cls.class_code || !cls.class_name) {
      return false;
    }
    
    const matchesSearch = cls.class_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cls.class_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (cls.professor || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAcademicPeriod = academicPeriodFilter === 'all' || cls.academic_period === academicPeriodFilter;
    
    return matchesSearch && matchesAcademicPeriod;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-800 border-t-emerald-600 dark:border-t-emerald-400 mx-auto mb-4"></div>
          <p className="text-slate-700 dark:text-slate-300 font-medium">Loading your classes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
            Error Loading Classes
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <Button onClick={refreshData} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

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
                <Button variant="ghost" size="sm" className="hover:bg-slate-100 dark:hover:bg-slate-700">
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
                <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-800">
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-2">
                My Classes
              </h1>
              <p className="text-xl text-slate-600 dark:text-slate-400">
                View and manage your enrolled classes
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 h-32">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Total Classes
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stats.totalClasses}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Enrolled this semester
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-xl flex items-center justify-center ml-4">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 h-32">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Avg Attendance
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stats.averageAttendance}%
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Across all classes
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-xl flex items-center justify-center ml-4">
                <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 h-32">
            <div className="flex items-center justify-between h-full">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                  Active Classes
                </p>
                <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
                  {stats.upcomingClasses}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Currently enrolled
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-xl flex items-center justify-center ml-4">
                <Calendar className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-8">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search classes, professors, or course codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            
            {/* Academic Period Filter */}
            {academicPeriods.length > 0 && (
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Academic Period:</span>
                <select
                  value={academicPeriodFilter}
                  onChange={(e) => setAcademicPeriodFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="all">All Periods</option>
                  {academicPeriods.map((period) => (
                    <option key={period} value={period}>
                      {period}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Card>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((classData) => (
            <ClassCard key={classData.id} classData={classData} />
          ))}
        </div>

        {filteredClasses.length === 0 && !isLoading && (
          <Card className="p-12 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <BookOpen className="w-16 h-16 text-slate-400 dark:text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                {searchTerm || academicPeriodFilter !== 'all' ? 'No classes found' : 'No classes enrolled'}
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {searchTerm || academicPeriodFilter !== 'all'
                  ? 'Try adjusting your search criteria or academic period filter' 
                  : 'You are not currently enrolled in any classes. Contact your professor to be added to a class.'
                }
              </p>
            </div>
          </Card>
        )}
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

export default function StudentClasses() {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentClassesContent />
    </ProtectedRoute>
  );
}
