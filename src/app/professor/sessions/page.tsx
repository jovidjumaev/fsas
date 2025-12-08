'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { 
  Calendar, Clock, Users, QrCode, Play, Pause, Square, 
  MoreHorizontal, Filter, Search, Download, Eye, 
  CheckCircle, XCircle, AlertCircle, Plus, BarChart3,
  MapPin, BookOpen, TrendingUp, Activity, ChevronDown, X,
  Clock as Today, CalendarDays, History, Zap
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useProfessorSessions } from "@/hooks/use-professor-sessions-cached";import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProfessorHeader from '@/components/professor/professor-header';
import ProfileEditModal from '@/components/profile/profile-edit-modal';
import PasswordChangeModal from '@/components/profile/password-change-modal';
import { supabase } from '@/lib/supabase';
import { createLogger } from '../../../lib/logger';
import { now, parseDate, combineDateAndTime, diff, formatDate, getTodayString } from '@/lib/timezone-utils';
const logger = createLogger('page');


interface ClassOption {
  id: string;
  courses: {
    code: string;
    name: string;
  };
}

type TabType = 'today' | 'active' | 'upcoming' | 'completed' | 'all';

function SessionsPageContent() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();

  // Use the cached hook for sessions data
  const {
    sessions,
    classes,
    isLoading,
    error,
    refreshData
  } = useProfessorSessions(user);

  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [searchTerm, setSearchTerm] = useState('');
  const socketRef = useRef<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);


  // Fetch user profile
  const fetchUserProfile = async () => {
    if (!user) return;
    
    try {
      // logger.debug('🔍 Fetching user profile for user ID:', user.id);
      
      const { data, error } = await supabase
        .from('users' as any)
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        logger.error('Error fetching user profile:', error);
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
      
      // logger.debug('✅ User profile fetched:', completeProfile);
      setUserProfile(completeProfile);
    } catch (error) {
      logger.error('Error fetching user profile:', error);
    }
  };

  // Handle profile save
  const handleProfileSave = async (profileData: any) => {
    if (!user) return;
    
    try {
      // Check if names changed and handle name change tracking
      const namesChanged = profileData.first_name !== userProfile?.first_name || profileData.last_name !== userProfile?.last_name;
      
      if (namesChanged) {
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
      }
      
      // Separate data for users table (only basic fields that exist)
      const usersTableData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        updated_at: new Date().toISOString()
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
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, ...profileData }));
    } catch (error) {
      logger.error('Error saving profile:', error);
      throw error;
    }
  };

  // Handle password change
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

  // Handle avatar upload
  const handleAvatarUpload = async (file: File) => {
    if (!user) {
      logger.error('No user found for avatar upload');
      throw new Error('User not authenticated');
    }
    
    try {
      // logger.debug('Starting avatar upload for user:', user.id);
      
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
      
      // logger.debug('Uploading file to path:', filePath);
      
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
      
      // logger.debug('File uploaded successfully:', uploadData);
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      // logger.debug('Public URL generated:', publicUrl);
      
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
      
      // logger.debug('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: publicUrl }));
      
      // logger.debug('Avatar upload completed successfully');
    } catch (error) {
      logger.error('Error uploading avatar:', error);
      throw error;
    }
  };

  // Handle avatar delete
  const handleAvatarDelete = async () => {
    if (!user) {
      logger.error('No user found for avatar deletion');
      throw new Error('User not authenticated');
    }
    
    try {
      // logger.debug('Starting avatar deletion for user:', user.id);
      
      // Get current avatar URL to extract file path
      const currentAvatarUrl = userProfile?.avatar_url;
      if (!currentAvatarUrl) {
        throw new Error('No avatar to delete');
      }
      
      // Extract file path from URL
      const urlParts = currentAvatarUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `avatars/${fileName}`;
      
      // logger.debug('Deleting file from path:', filePath);
      
      // Delete file from Supabase Storage
      const { error: deleteError } = await supabase.storage
        .from('avatars')
        .remove([filePath]);
      
      if (deleteError) {
        logger.error('Storage deletion error:', deleteError);
        throw new Error(`Failed to delete file: ${deleteError.message}`);
      }
      
      // logger.debug('File deleted successfully from storage');
      
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
      
      // logger.debug('Profile updated successfully:', updateData);
      
      // Update local state
      setUserProfile((prev: any) => ({ ...prev, avatar_url: null }));
      
      // logger.debug('Avatar deletion completed successfully');
    } catch (error) {
      logger.error('Error deleting avatar:', error);
      throw error;
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  // Session management functions
  const activateSession = useCallback(async (sessionId: string, notes?: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      
      if (!response.ok) throw new Error('Failed to activate session');
      await refreshData();
    } catch (error) {
      logger.error('Error activating session:', error);
      alert('Failed to activate session. Please try again.');
    }
  }, [refreshData]);

  const completeSession = useCallback(async (sessionId: string) => {
    try {
      // Get session details to check timing
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Check if session is being completed early
      const currentTime = now();
      const sessionEndTime = combineDateAndTime(session.date, session.end_time);
      const minutesRemaining = Math.round(diff(sessionEndTime, currentTime, 'minute'));

      // Show confirmation dialog if completing early
      if (minutesRemaining > 0) {
        const confirmMessage = `Are you sure you want to end this session?\n\n` +
          `Session: ${session.class_name}\n` +
          `Scheduled End Time: ${session.end_time}\n` +
          `Time Remaining: ${minutesRemaining} minutes\n\n` +
          `This will mark all students who haven't scanned as absent.`;

        if (!confirm(confirmMessage)) {
          return; // User cancelled
        }
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/complete`, { method: 'POST' });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete session');
      }
      
      await refreshData();
      
      // Automatically switch to completed tab to show the completed session
      setActiveTab('completed');
      // logger.debug('✅ Session completed, switched to completed tab');
    } catch (error) {
      logger.error('Error completing session:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to complete session: ${errorMessage}`);
    }
  }, [refreshData, sessions]);

  // Load data on mount
  useEffect(() => {
    fetchUserProfile();
  }, [refreshData]);

  // Handle URL parameters for tab switching
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['today', 'active', 'upcoming', 'completed', 'all'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
      // logger.debug('🔄 Switched to tab from URL:', tabParam);
    }
  }, [searchParams]);

  // SWR caching handles stale data automatically, no need for visibility/focus refetch

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!user) return;

    // Connect to WebSocket
    socketRef.current = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      // logger.debug('🔌 Connected to WebSocket for sessions updates');
    });

    // Listen for session status updates
    socketRef.current.on('session_status_update', (data: { sessionId: string; status: string }) => {
      // logger.debug('📡 Received session status update:', data);

      // Refresh data from server instead of updating local state
      refreshData();

      // If session was completed and we're on active tab, switch to completed
      if (data.status === 'completed' && activeTab === 'active') {
        setActiveTab('completed');
        // logger.debug('🔄 Session completed, switched to completed tab');
      }
    });

    // Listen for session activation updates
    socketRef.current.on('session_activated', (data: { sessionId: string }) => {
      // logger.debug('📡 Session activated:', data.sessionId);
      refreshData(); // Refresh all sessions data
    });

    // Listen for session completion updates
    socketRef.current.on('session_completed', (data: { sessionId: string }) => {
      // logger.debug('📡 Session completed:', data.sessionId);
      refreshData(); // Refresh all sessions data
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        // logger.debug('🔌 Disconnected from WebSocket');
      }
    };
  }, [user, refreshData, activeTab]);

  // Memoized filtered sessions by tab
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(session =>
        session.class_code.toLowerCase().includes(searchLower) ||
        session.class_name.toLowerCase().includes(searchLower) ||
        session.room_location.toLowerCase().includes(searchLower)
      );
    }

    // Apply tab filter
    const today = getTodayString();

    switch (activeTab) {
      case 'today':
        // Only sessions for today (regardless of status)
        filtered = filtered.filter(session => session.date === today);
        break;
      case 'active':
        filtered = filtered.filter(session => session.status === 'active');
        break;
      case 'upcoming':
        // Future sessions only (excluding today)
        filtered = filtered.filter(session =>
          session.status === 'scheduled' && session.date > today
        );
        break;
      case 'completed':
        // Completed sessions from any date
        filtered = filtered.filter(session => session.status === 'completed');
        break;
      case 'all':
        // No additional filtering
        break;
    }

    // Sort based on tab type
    return filtered.sort((a, b) => {
      if (activeTab === 'completed') {
        // For completed sessions, sort by completion date (most recent first)
        // Use updated_at as completion time, fallback to date if not available
        const aCompletedTime = parseDate(a.updated_at || combineDateAndTime(a.date, a.end_time));
        const bCompletedTime = parseDate(b.updated_at || combineDateAndTime(b.date, b.end_time));
        return diff(aCompletedTime, bCompletedTime, 'millisecond'); // Descending order (b - a)
      } else {
        // For all other tabs, sort by session date and time (ascending order)
        const aDateTime = combineDateAndTime(a.date, a.start_time);
        const bDateTime = combineDateAndTime(b.date, b.start_time);
        return diff(bDateTime, aDateTime, 'millisecond'); // Ascending order (a - b)
      }
    });
  }, [sessions, activeTab, searchTerm]);

  // Get session status info
  const getSessionStatus = useCallback((session: any) => {
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

  // Tab configuration
  const tabs = useMemo(() => {
    const today = getTodayString();
    return [
      { id: 'today' as TabType, label: 'Today', icon: Today, count: sessions.filter(s => s.date === today).length },
      { id: 'active' as TabType, label: 'Active', icon: Activity, count: sessions.filter(s => s.status === 'active').length },
      { id: 'upcoming' as TabType, label: 'Upcoming', icon: CalendarDays, count: sessions.filter(s => s.status === 'scheduled' && s.date > today).length },
      { id: 'completed' as TabType, label: 'Completed', icon: History, count: sessions.filter(s => s.status === 'completed').length },
      { id: 'all' as TabType, label: 'All Sessions', icon: BarChart3, count: sessions.length }
    ];
  }, [sessions]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-safe">
      {/* Header */}
      <ProfessorHeader
        currentPage="sessions"
        userProfile={userProfile}
        onSignOut={handleSignOut}
        onEditProfile={() => setShowProfileEdit(true)}
        onChangePassword={() => setShowPasswordChange(true)}
        onUploadAvatar={handleAvatarUpload}
        onDeleteAvatar={handleAvatarDelete}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-20 sm:pb-8">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-2">
                Class Sessions
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-400">
                Manage your attendance sessions
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                onClick={() => refreshData()}
                variant="outline"
                size="sm"
                className="hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <Zap className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Refresh</span>
                <span className="sm:hidden">Refresh</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Active Sessions Alert */}
        {sessions.filter(s => s.status === 'active').length > 0 && (
          <Card className="mb-6 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-slate-800/60 dark:to-slate-700/60 border-emerald-200 dark:border-slate-600">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse flex-shrink-0"></div>
                  <div>
                    <h3 className="font-semibold text-emerald-900 dark:text-white text-sm sm:text-base">
                      {sessions.filter(s => s.status === 'active').length} Active Session{sessions.filter(s => s.status === 'active').length > 1 ? 's' : ''}
                    </h3>
                    <p className="text-xs sm:text-sm text-emerald-700 dark:text-slate-300">
                      Students can scan QR codes to mark attendance
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto"
                  onClick={() => setActiveTab('active')}
                >
                  View Active
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Search Bar */}
        <Card className="p-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 mb-6">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
            <Input
              placeholder="Search sessions by course code, name, or room..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600"
            />
          </div>
        </Card>

        {/* Tabs */}
        <div className="mb-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg min-w-max sm:min-w-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center justify-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2.5 sm:py-3 rounded-md transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">{tab.label}</span>
                    {tab.count > 0 && (
                      <span className={`px-1.5 sm:px-2 py-0.5 text-xs rounded-full flex-shrink-0 ${
                        activeTab === tab.id
                          ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300'
                          : 'bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-400'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sessions List */}
        {filteredSessions.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-6 h-6 sm:w-8 sm:h-8 text-slate-400" />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white mb-2">
              {sessions.length === 0 ? 'No Sessions Yet' : 'No Sessions Found'}
            </h3>
            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
              {sessions.length === 0
                ? 'Create your first class to start generating session templates.'
                : 'Try adjusting your search or selecting a different tab.'
              }
            </p>
            {sessions.length === 0 && (
              <Link href="/professor/classes">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Class
                </Button>
              </Link>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredSessions.map((session) => {
              const status = getSessionStatus(session);
              const StatusIcon = status.icon;
              const today = new Date().toISOString().split('T')[0];
              const isToday = session.date === today;
              const canStart = session.status === 'scheduled';
              
              return (
                <Card
                  key={session.id}
                  className={`group bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all duration-200 ${
                    session.status === 'active' ? 'ring-2 ring-emerald-500/20 shadow-emerald-500/10' : ''
                  }`}
                >
                  {/* Status Indicator */}
                  <div className={`h-1 bg-gradient-to-r ${
                    session.status === 'active' 
                      ? 'from-emerald-500 to-emerald-600' 
                      : session.status === 'completed'
                      ? 'from-indigo-500 to-indigo-600'
                      : session.status === 'scheduled'
                      ? 'from-amber-500 to-amber-600'
                      : 'from-slate-400 to-slate-500'
                  } rounded-t-xl`}></div>

                  <div className="p-4 sm:p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                        <div className={`w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-br ${
                          session.status === 'active'
                            ? 'from-emerald-500 to-emerald-600'
                            : session.status === 'completed'
                            ? 'from-indigo-500 to-indigo-600'
                            : session.status === 'scheduled'
                            ? 'from-amber-500 to-amber-600'
                            : 'from-slate-400 to-slate-500'
                        } rounded-xl flex items-center justify-center shadow-sm flex-shrink-0`}>
                          <StatusIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-slate-900 dark:text-white text-base sm:text-lg truncate">
                            {session.class_code}
                          </h3>
                          <span className={`inline-flex items-center px-2 py-0.5 sm:py-1 rounded-full text-xs font-medium ${status.color}`}>
                            {session.status === 'active' && <div className="w-1.5 h-1.5 bg-current rounded-full mr-1 animate-pulse"></div>}
                            {status.text}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Course Name */}
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-3 sm:mb-4 line-clamp-2">
                      {session.class_name}
                    </p>

                    {/* Session Details */}
                    <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                      <div className="flex items-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">
                          {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                      <div className="flex items-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{session.start_time} - {session.end_time}</span>
                      </div>
                      <div className="flex items-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{session.room_location}</span>
                      </div>
                      <div className="flex items-center text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                        <span>{session.attendance_count}/{session.enrolled_students} students</span>
                      </div>
                    </div>

                    {/* Attendance Progress */}
                    {session.enrolled_students > 0 && (
                      <div className="mb-3 sm:mb-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Attendance</span>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {Math.round((session.attendance_count / session.enrolled_students) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 sm:h-2">
                          <div
                            className="h-1.5 sm:h-2 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-500"
                            style={{ width: `${(session.attendance_count / session.enrolled_students) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      {session.status === 'active' ? (
                        <>
                          <Link href={`/professor/sessions/active/${session.id}`} className="flex-1">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm">
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                              View Live
                            </Button>
                          </Link>
                          <Button
                            onClick={() => completeSession(session.id)}
                            className="bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm px-3 sm:px-4"
                          >
                            <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="sm:hidden ml-1.5">End</span>
                          </Button>
                        </>
                      ) : canStart ? (
                        <Button
                          onClick={() => activateSession(session.id)}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm"
                        >
                          <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                          Start Session
                        </Button>
                      ) : (
                        <Link href={`/professor/sessions/${session.id}`} className="flex-1">
                          <Button variant="outline" className="w-full text-xs sm:text-sm">
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5" />
                            View Details
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
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

export default function SessionsPage() {
  return (
    <ProtectedRoute requiredRole="professor">
      <SessionsPageContent />
    </ProtectedRoute>
  );
}