'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import ProtectedRoute from '@/components/protected-route';
import { io } from 'socket.io-client';
import { 
  ArrowLeft, Settings, Users, Calendar, BarChart3, 
  Clock, MapPin, GraduationCap, Pin, PinOff, MoreHorizontal,
  BookOpen, UserPlus, UserMinus, QrCode, Eye, Edit, Trash2,
  Search, Check, X, Plus, Minus, Play, Square, Bot
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import ProfessorHeader from '@/components/professor/professor-header';
import ProfileEditModal from '@/components/profile/profile-edit-modal';
import PasswordChangeModal from '@/components/profile/password-change-modal';
import { AIAssistant } from '@/components/professor/ai-assistant';
import { supabase } from '@/lib/supabase';

interface ClassData {
  id: string;
  course_id: string;
  professor_id: string;
  academic_period_id: string;
  section_number: number;
  class_code: string;
  days_of_week: string[];
  start_time: string;
  end_time: string;
  first_class_date: string;
  last_class_date: string;
  room_location: string;
  max_students: number;
  current_enrollment: number;
  capacity_percentage: number;
  is_active: boolean;
  status: 'active' | 'inactive' | 'completed';
  is_pinned: boolean;
  enrollment_deadline: string;
  created_at: string;
  updated_at: string;
  courses: {
    code: string;
    name: string;
    description: string;
    credits: number;
    departments: {
      code: string;
      name: string;
    };
  };
  academic_periods: {
    name: string;
    year: number;
    semester: string;
  };
}

interface Student {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  student_id: string;
  enrollment_date: string;
  status: string;
}

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
}

function ClassManagementPageContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const classId = params.classId as string;

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  
  // Analytics states
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'sessions' | 'analytics' | 'ai-assistant'>('overview');
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  
  // Student search and selection states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const studentsPerPage = 20;
  
  // Sessions filtering state
  const [sessionFilters, setSessionFilters] = useState({
    status: 'all' as 'all' | 'scheduled' | 'active' | 'completed' | 'cancelled',
    dateFrom: '',
    dateTo: '',
    searchTerm: ''
  });

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
    details?: string;
  } | null>(null);

  // Confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    type: 'danger' | 'warning' | 'info';
  } | null>(null);

  useEffect(() => {
    if (classId) {
      fetchClassData();
      fetchStudents();
      
      // Connect to WebSocket for real-time updates
      const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
      
      // Listen for attendance status updates
      socket.on('attendance_status_updated', (data) => {
        console.log('📊 Received attendance status update:', data);
        
        // Refresh sessions data to get updated attendance counts
        fetchSessions();
        
        // Refresh analytics to get updated stats
        fetchAnalytics();
      });
      
      return () => {
        socket.disconnect();
      };
    }
  }, [classId]);

  // Fetch sessions when sessions tab is active
  useEffect(() => {
    if (activeTab === 'sessions' && classId) {
      fetchSessions();
    }
  }, [activeTab, classId]);

  // Fetch analytics when analytics tab is active
  useEffect(() => {
    if (activeTab === 'analytics' && classId) {
      fetchAnalytics();
    }
  }, [activeTab, classId]);

  // Load all students when add student modal opens
  useEffect(() => {
    if (showAddStudent && allStudents.length === 0) {
      fetchAllStudents(1);
    }
  }, [showAddStudent]);

  const fetchClassData = async () => {
    try {
      if (!user?.id) return;
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/professors/${user.id}/class-instances`);
      if (!response.ok) throw new Error('Failed to fetch classes');
      
      const data = await response.json();
      const classInstance = data.data.find((c: ClassData) => c.id === classId);
      
      if (classInstance) {
        setClassData(classInstance);
      } else {
        console.error('Class not found');
        router.push('/professor/classes');
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
      router.push('/professor/classes');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/students`);
      if (response.ok) {
      const data = await response.json();
        setStudents(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/sessions`);
      if (response.ok) {
        const data = await response.json();
        setSessions(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setSessions([]);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/classes/${classId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsData(null);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  const togglePin = async () => {
    if (!classData || !user?.id) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classData.id}/pin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professor_id: user.id
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setClassData(prev => prev ? { ...prev, is_pinned: result.is_pinned } : null);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  const addStudent = async () => {
    if (!newStudentEmail.trim()) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_email: newStudentEmail,
          professor_id: user?.id
        }),
      });

      if (response.ok) {
        const result = await response.json();
        showNotification('success', `Successfully enrolled ${result.student?.first_name} ${result.student?.last_name}!`);
        setNewStudentEmail('');
        setShowAddStudent(false);
        fetchStudents();
        fetchClassData(); // Refresh class data to update enrollment count
      } else {
        const errorData = await response.json();
        showNotification('error', errorData.error);
      }
    } catch (error) {
      console.error('Error adding student:', error);
      showNotification('error', 'Error adding student');
    }
  };

  const removeStudent = async (studentId: string) => {
    // Find the student details for the confirmation message
    const student = students.find(s => s.user_id === studentId);
    const studentName = student ? `${student.first_name} ${student.last_name}` : 'this student';
    
    showConfirmationModal(
      'Remove Student',
      `Are you sure you want to remove ${studentName} from this class? This action cannot be undone.`,
      async () => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/unenroll`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              student_id: studentId,
              professor_id: user?.id
            }),
          });
          
          if (response.ok) {
            showNotification('success', 'Student removed successfully');
            fetchStudents();
            fetchClassData(); // Refresh class data to update enrollment count
          } else {
            const errorData = await response.json();
            showNotification('error', `Error removing student: ${errorData.error}`);
          }
        } catch (error) {
          console.error('Error removing student:', error);
          showNotification('error', 'Error removing student');
        }
      },
      'danger',
      'Remove Student',
      'Cancel'
    );
  };

  // Profile management functions
  const handleSignOut = () => {
    // This will be handled by the auth context
    window.location.href = '/';
  };

  const handleEditProfile = () => {
    setShowProfileEdit(true);
  };

  const handleChangePassword = () => {
    setShowPasswordChange(true);
  };

  const handleUploadAvatar = async (file: File) => {
    // Avatar upload functionality
    console.log('Upload avatar:', file);
  };

  const handleDeleteAvatar = async () => {
    // Avatar delete functionality
    console.log('Delete avatar');
  };

  const handleStatusChange = async (newStatus: 'active' | 'inactive' | 'completed') => {
    if (!user?.id || !classData) return;
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classData.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professor_id: user.id,
          status: newStatus
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update class status');
      }

      // Update local state
      setClassData(prev => prev ? {
        ...prev,
        status: newStatus,
        is_active: newStatus === 'active'
      } : null);

      // Show success notification
      showNotification('success', `Class status updated to ${newStatus}`, 'The class status has been successfully updated.');
      
      // Dispatch event to refresh classes page
      window.dispatchEvent(new CustomEvent('classStatusChanged'));
      
    } catch (error) {
      console.error('Error updating class status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('error', 'Failed to update class status', errorMessage);
    }
  };

  // Fetch all students
  const fetchAllStudents = async (page: number = 1) => {
    setIsLoadingStudents(true);
    try {
      const offset = (page - 1) * studentsPerPage;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/all?limit=${studentsPerPage}&offset=${offset}`);
      if (response.ok) {
        const data = await response.json();
        setAllStudents(data.data || []);
        setTotalStudents(data.count || 0);
        setCurrentPage(page);
      }
    } catch (error) {
      console.error('Error fetching all students:', error);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  // Student search functionality
  const searchStudents = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/students/search?q=${encodeURIComponent(query)}&limit=20`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data || []);
        setShowSearchResults(true);
      }
    } catch (error) {
      console.error('Error searching students:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      // Show all students when search is cleared
      if (allStudents.length === 0) {
        fetchAllStudents(1);
      }
    } else {
      searchStudents(query);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    const currentStudents = showSearchResults ? searchResults : allStudents;
    const allStudentIds = currentStudents.map(student => student.user_id);
    setSelectedStudents(allStudentIds);
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  const showNotification = (type: 'success' | 'error' | 'info', message: string, details?: string) => {
    setNotification({ type, message, details });
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setNotification(null);
    }, 5000);
  };

  const showConfirmationModal = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'danger' | 'warning' | 'info' = 'warning',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmationModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      type
    });
  };

  const closeConfirmationModal = () => {
    setConfirmationModal(null);
  };

  const bulkEnrollStudents = async () => {
    if (selectedStudents.length === 0) return;

    try {
      if (!user?.id) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/bulk-enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          student_ids: selectedStudents,
          professor_id: user.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error === 'Class not found or access denied') {
          throw new Error('You do not have permission to enroll students in this class. Only the professor who created this class can enroll students.');
        }
        throw new Error(errorData.error || 'Failed to enroll students');
      }

      const result = await response.json();
      
      if (result.success) {
        // Show success message with details
        let message = result.message;
        let details = '';
        if (result.already_enrolled && result.already_enrolled.length > 0) {
          details = `Already enrolled students: ${result.already_enrolled.length}`;
        }
        showNotification('success', message, details);
        
        // Reset search and selection
        setSearchQuery('');
        setSearchResults([]);
        setSelectedStudents([]);
        setShowSearchResults(false);
        setShowAddStudent(false);
        
        // Refresh data
        fetchClassData();
        fetchStudents();
        
        // Notify the classes page to refresh
        window.dispatchEvent(new CustomEvent('classStatusChanged'));
      } else {
        // Show error message
        showNotification('error', result.error);
      }
    } catch (error) {
      console.error('Error enrolling students:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showNotification('error', `Error enrolling students: ${errorMessage}`);
    }
  };

  // Session management functions
  const startSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professor_id: user?.id
        }),
      });

      if (response.ok) {
        showNotification('success', 'Session started successfully');
        fetchSessions();
      } else {
        const errorData = await response.json();
        showNotification('error', errorData.error || 'Failed to start session');
      }
    } catch (error) {
      console.error('Error starting session:', error);
      showNotification('error', 'Error starting session');
    }
  };

  const stopSession = async (sessionId: string) => {
    try {
      // Get session details to check timing
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Check if session is being completed early
      const now = new Date();
      const sessionEndTime = new Date(`${session.date}T${session.end_time}`);
      const minutesRemaining = Math.round((sessionEndTime.getTime() - now.getTime()) / (1000 * 60));

      // Show confirmation dialog if completing early
      if (minutesRemaining > 0) {
        const confirmMessage = `Are you sure you want to end this session?\n\n` +
          `Session: Session ${session.session_number}\n` +
          `Scheduled End Time: ${session.end_time}\n` +
          `Time Remaining: ${minutesRemaining} minutes\n\n` +
          `This will mark all students who haven't scanned as absent.`;
        
        if (!confirm(confirmMessage)) {
          return; // User cancelled
        }
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        showNotification('success', 'Session completed successfully');
        fetchSessions();
      } else {
        const errorData = await response.json();
        showNotification('error', errorData.error || 'Failed to complete session');
      }
    } catch (error) {
      console.error('Error completing session:', error);
      showNotification('error', `Failed to complete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const createNewSession = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/class-instances/${classId}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professor_id: user?.id,
          date: new Date().toISOString().split('T')[0],
          start_time: classData?.start_time || '09:00',
          end_time: classData?.end_time || '10:00',
          room_location: classData?.room_location || 'TBD'
        }),
      });

      if (response.ok) {
        showNotification('success', 'New session created successfully');
        fetchSessions();
      } else {
        const errorData = await response.json();
        showNotification('error', errorData.error || 'Failed to create session');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      showNotification('error', 'Error creating session');
    }
  };

  // Filter sessions based on current filters
  const filteredSessions = sessions.filter(session => {
    // Status filter
    if (sessionFilters.status !== 'all' && session.status !== sessionFilters.status) {
      return false;
    }

    // Date range filter
    if (sessionFilters.dateFrom && session.date < sessionFilters.dateFrom) {
      return false;
    }
    if (sessionFilters.dateTo && session.date > sessionFilters.dateTo) {
      return false;
    }

    // Search term filter
    if (sessionFilters.searchTerm) {
      const searchLower = sessionFilters.searchTerm.toLowerCase();
      const searchableText = `${session.session_number} ${session.date} ${session.start_time} ${session.end_time} ${session.room_location} ${session.notes || ''}`.toLowerCase();
      if (!searchableText.includes(searchLower)) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    // Sort by date (oldest first), then by session number
    if (a.date !== b.date) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return a.session_number - b.session_number;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!classData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">Class Not Found</h1>
          <Button onClick={() => router.push('/professor/classes')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <ProfessorHeader
        currentPage="classes"
        userProfile={userProfile}
        onSignOut={handleSignOut}
        onEditProfile={handleEditProfile}
        onChangePassword={handleChangePassword}
        onUploadAvatar={handleUploadAvatar}
        onDeleteAvatar={handleDeleteAvatar}
      />
      
      {/* Notification */}
      {notification && (
        <div className="fixed top-20 right-4 z-50 max-w-md">
          <div className={`p-4 rounded-lg shadow-lg border-l-4 ${
            notification.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200'
              : notification.type === 'error'
              ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-800 dark:text-blue-200'
          }`}>
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {notification.type === 'success' && <Check className="w-5 h-5" />}
                {notification.type === 'error' && <X className="w-5 h-5" />}
                {notification.type === 'info' && <BookOpen className="w-5 h-5" />}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium">{notification.message}</p>
                {notification.details && (
                  <p className="mt-1 text-sm opacity-90">{notification.details}</p>
                )}
              </div>
              <div className="ml-4 flex-shrink-0">
                <button
                  onClick={() => setNotification(null)}
                  className="inline-flex text-current opacity-70 hover:opacity-100 focus:outline-none"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {confirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmationModal.type === 'danger'
                    ? 'bg-red-100 dark:bg-red-900/20'
                    : confirmationModal.type === 'warning'
                    ? 'bg-yellow-100 dark:bg-yellow-900/20'
                    : 'bg-blue-100 dark:bg-blue-900/20'
                }`}>
                  {confirmationModal.type === 'danger' && <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />}
                  {confirmationModal.type === 'warning' && <BookOpen className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />}
                  {confirmationModal.type === 'info' && <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                    {confirmationModal.title}
                  </h3>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {confirmationModal.message}
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={closeConfirmationModal}
                  className="px-4 py-2"
                >
                  {confirmationModal.cancelText}
                </Button>
                <Button
                  onClick={() => {
                    confirmationModal.onConfirm();
                    closeConfirmationModal();
                  }}
                  className={`px-4 py-2 ${
                    confirmationModal.type === 'danger'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : confirmationModal.type === 'warning'
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {confirmationModal.confirmText}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
                size="sm"
            onClick={() => router.push('/professor/classes')}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Classes
          </Button>
        </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={togglePin}
                className="flex items-center"
              >
                {classData.is_pinned ? (
                  <>
                    <PinOff className="w-4 h-4 mr-2" />
                    Unpin
                  </>
                ) : (
                  <>
                    <Pin className="w-4 h-4 mr-2" />
                    Pin
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Class Info Card */}
          <Card className="p-6 mb-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                      {classData.courses?.code}
                    </h1>
                    {classData.is_pinned && (
                      <Pin className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                    )}
                  </div>
                  <h2 className="text-xl text-slate-600 dark:text-slate-300 mb-2">
                    {classData.courses?.name}
                  </h2>
                  <div className="flex items-center space-x-4 text-sm text-slate-500 dark:text-slate-400">
                    <span>Section {classData.section_number}</span>
                    <span className="text-slate-300 dark:text-slate-500">•</span>
                    <span>{classData.academic_periods?.name}</span>
                    <span className="text-slate-300 dark:text-slate-500">•</span>
                    <span>Class Code: {classData.class_code}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex space-x-1 mb-6">
            {[
              { id: 'overview', label: 'Overview', icon: Settings },
              { id: 'students', label: 'Students', icon: Users },
              { id: 'sessions', label: 'Sessions', icon: Calendar },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'ai-assistant', label: 'AI Assistant', icon: Bot }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-blue-200 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            ))}
            </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class Details */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Class Details</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Clock className="w-4 h-4 mr-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Schedule:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">
                    {classData.days_of_week?.map(day => {
                      switch(day) {
                        case 'Monday': return 'M';
                        case 'Tuesday': return 'T';
                        case 'Wednesday': return 'W';
                        case 'Thursday': return 'Th';
                        case 'Friday': return 'F';
                        case 'Saturday': return 'S';
                        case 'Sunday': return 'Su';
                        default: return day.substring(0, 2);
                      }
                    }).join('')} {classData.start_time}-{classData.end_time}
                  </span>
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="w-4 h-4 mr-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Room:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">{classData.room_location}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Users className="w-4 h-4 mr-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Enrollment:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">{classData.current_enrollment}/{classData.max_students}</span>
                </div>
                <div className="flex items-center text-sm">
                  <GraduationCap className="w-4 h-4 mr-3 text-slate-500 dark:text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-300">Credits:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-white">{classData.courses?.credits}</span>
                </div>
              </div>
            </Card>

            {/* Quick Stats */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Quick Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {classData.current_enrollment}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Students</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {classData.capacity_percentage}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Capacity</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {sessions.filter(s => s.status === 'completed' && s.attendance_count > 0).length}
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Completed Sessions</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {(() => {
                      const professorInitiatedSessions = sessions.filter(s => s.status === 'completed' && s.attendance_count > 0);
                      return professorInitiatedSessions.length > 0 
                        ? Math.round(professorInitiatedSessions.reduce((acc, session) => 
                            acc + (session.total_enrolled > 0 ? (session.attendance_count / session.total_enrolled) * 100 : 0), 0) / professorInitiatedSessions.length)
                        : 0;
                    })()}%
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">Avg Attendance</div>
                </div>
              </div>
            </Card>

            {/* Class Status Management */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Class Status</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                    classData.status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                      : classData.status === 'completed'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                  }`}>
                    {classData.status === 'active' ? 'Active' : 
                     classData.status === 'completed' ? 'Completed' : 'Inactive'}
                  </div>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Current status
                  </span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => handleStatusChange('active')}
                    disabled={classData.status === 'active'}
                    variant={classData.status === 'active' ? "primary" : "outline"}
                    size="sm"
                    className={`${
                      classData.status === 'active'
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/20'
                    }`}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Active
                  </Button>
                  <Button
                    onClick={() => handleStatusChange('inactive')}
                    disabled={classData.status === 'inactive'}
                    variant={classData.status === 'inactive' ? "primary" : "outline"}
                    size="sm"
                    className={`${
                      classData.status === 'inactive'
                        ? 'bg-gray-600 hover:bg-gray-700 text-white' 
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-900/20'
                    }`}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Inactive
                  </Button>
                  <Button
                    onClick={() => handleStatusChange('completed')}
                    disabled={classData.status === 'completed'}
                    variant={classData.status === 'completed' ? "primary" : "outline"}
                    size="sm"
                    className={`${
                      classData.status === 'completed'
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-600 dark:text-blue-400 dark:hover:bg-blue-900/20'
                    }`}
                  >
                    <GraduationCap className="w-4 h-4 mr-1" />
                    Complete
                  </Button>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Change the class status to manage its availability and visibility.
              </p>
            </Card>
          </div>
        )}

        {activeTab === 'students' && (
          <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Students ({students.length})</h3>
              <Button 
                onClick={() => setShowAddStudent(true)}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Students
              </Button>
            </div>

            {showAddStudent && (
              <div className="mb-6 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-600 shadow-lg dark:shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-medium text-slate-900 dark:text-white">Add Students to Class</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setShowAddStudent(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setSelectedStudents([]);
                      setShowSearchResults(false);
                    }}
                    className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </div>

                {/* Search Input */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                    <Input
                      placeholder="Search by name, email, or student ID..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="pl-10 pr-4 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 dark:focus:border-blue-400"
                    />
                    {isSearching && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <LoadingSpinner className="w-4 h-4" />
                      </div>
                    )}
                </div>

                {/* Students List */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {showSearchResults ? `Search Results (${searchResults.length})` : `All Students (${totalStudents})`}
                    </h5>
                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={selectAllStudents}
                        className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Select All
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearSelection}
                        className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    </div>
                  </div>

                  {isLoadingStudents ? (
                  <div className="text-center py-8">
                      <LoadingSpinner className="mx-auto mb-2" />
                      <p className="text-slate-500 dark:text-slate-400">Loading students...</p>
                    </div>
                  ) : (
                    <>
                      {(showSearchResults ? searchResults : allStudents).length === 0 ? (
                        <div className="text-center py-4 text-slate-500 dark:text-slate-400">
                          {showSearchResults ? 'No students found matching your search.' : 'No students available.'}
                  </div>
                ) : (
                        <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-600 rounded-lg p-2 bg-slate-50 dark:bg-slate-900/50">
                          {(showSearchResults ? searchResults : allStudents).map((student) => (
                            <div
                              key={student.user_id}
                              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-colors ${
                                selectedStudents.includes(student.user_id)
                                  ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent'
                              }`}
                              onClick={() => toggleStudentSelection(student.user_id)}
                            >
                              <div className="flex-shrink-0">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  selectedStudents.includes(student.user_id)
                                    ? 'bg-blue-600 border-blue-600'
                                    : 'border-slate-300 dark:border-slate-500'
                                }`}>
                                  {selectedStudents.includes(student.user_id) && (
                                    <Check className="w-3 h-3 text-white" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-slate-900 dark:text-white">
                                  {student.first_name} {student.last_name}
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                  {student.email} • ID: {student.student_id}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                )}

                      {/* Pagination for all students */}
                      {!showSearchResults && totalStudents > studentsPerPage && (
                        <div className="flex items-center justify-between mt-4 px-2">
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            Showing {((currentPage - 1) * studentsPerPage) + 1} to {Math.min(currentPage * studentsPerPage, totalStudents)} of {totalStudents} students
                </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchAllStudents(currentPage - 1)}
                              disabled={currentPage === 1 || isLoadingStudents}
                              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Previous
                            </Button>
                            <span className="px-3 py-1 text-sm text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-md">
                              Page {currentPage} of {Math.ceil(totalStudents / studentsPerPage)}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => fetchAllStudents(currentPage + 1)}
                              disabled={currentPage >= Math.ceil(totalStudents / studentsPerPage) || isLoadingStudents}
                              className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Next
                            </Button>
                          </div>
            </div>
                      )}
                    </>
                  )}
              </div>

                {/* Selected Students Summary */}
                {selectedStudents.length > 0 && (
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={clearSelection}
                        className="border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowAddStudent(false);
                      setSearchQuery('');
                      setSearchResults([]);
                      setSelectedStudents([]);
                      setShowSearchResults(false);
                    }}
                    className="border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={bulkEnrollStudents}
                    disabled={selectedStudents.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Enroll {selectedStudents.length} Student{selectedStudents.length !== 1 ? 's' : ''}
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {students.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  No students enrolled yet
                </div>
              ) : (
                students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-700 rounded-full flex items-center justify-center shadow-sm">
                        <span className="text-sm font-medium text-white">
                          {student.first_name.charAt(0)}{student.last_name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-white">
                          {student.first_name} {student.last_name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {student.email} • {student.student_id}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeStudent(student.user_id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                    >
                      <UserMinus className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Sessions Header */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Class Sessions</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Manage attendance sessions for {classData?.courses?.code} - Section {classData?.section_number}
                  </p>
                </div>
                <Button 
                  onClick={createNewSession}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-200 border-0"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {/* Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Status
                  </label>
                  <select
                    value={sessionFilters.status}
                    onChange={(e) => setSessionFilters(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Sessions</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                {/* Date From Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    From Date
                  </label>
                  <Input
                    type="date"
                    value={sessionFilters.dateFrom}
                    onChange={(e) => setSessionFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="w-full"
                  />
                </div>

                {/* Date To Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    To Date
                  </label>
                  <Input
                    type="date"
                    value={sessionFilters.dateTo}
                    onChange={(e) => setSessionFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="w-full"
                  />
                </div>

                {/* Search Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-slate-500 w-4 h-4" />
                    <Input
                      placeholder="Search sessions..."
                      value={sessionFilters.searchTerm}
                      onChange={(e) => setSessionFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Filters */}
              {(sessionFilters.status !== 'all' || sessionFilters.dateFrom || sessionFilters.dateTo || sessionFilters.searchTerm) && (
                <div className="flex justify-end mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSessionFilters({
                      status: 'all',
                      dateFrom: '',
                      dateTo: '',
                      searchTerm: ''
                    })}
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </Card>

            {/* Sessions List */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              {isLoadingSessions ? (
                <div className="text-center py-12">
                  <LoadingSpinner className="mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">Loading sessions...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400 dark:text-slate-500" />
                  <p className="text-lg font-medium mb-2">
                    {sessions.length === 0 ? 'No sessions found' : 'No sessions match your filters'}
                  </p>
                  <p className="text-sm">
                    {sessions.length === 0 
                      ? 'Create your first session to start tracking attendance.' 
                      : 'Try adjusting your filters to see more sessions.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`p-4 rounded-lg border transition-all duration-200 ${
                        session.status === 'active'
                          ? 'bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700'
                          : session.status === 'completed'
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700'
                          : session.status === 'cancelled'
                          ? 'bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-700'
                          : 'bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-700/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            session.status === 'active'
                              ? 'bg-emerald-500 text-white'
                              : session.status === 'completed'
                              ? 'bg-blue-500 text-white'
                              : session.status === 'cancelled'
                              ? 'bg-red-500 text-white'
                              : 'bg-slate-500 text-white'
                          }`}>
                            <span className="text-xs font-bold text-center leading-tight">
                              {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { 
                                month: 'numeric', 
                                day: 'numeric' 
                              })}
                            </span>
                          </div>
                            <div>
                              <div className="flex items-center space-x-2 mb-1">
                                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">
                                  {new Date(session.date + 'T00:00:00').toLocaleDateString('en-US', { 
                                    month: 'short', 
                                    day: 'numeric', 
                                    year: 'numeric' 
                                  })}
                                </h4>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                session.status === 'active'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
                                  : session.status === 'completed'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                  : session.status === 'cancelled'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                  : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                              }`}>
                                {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                              </span>
                              {session.is_active && (
                                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                              )}
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-slate-600 dark:text-slate-400">
                              <div className="flex items-center">
                                <Calendar className="w-4 h-4 mr-1" />
                                {new Date(session.date + 'T00:00:00').toLocaleDateString()}
                              </div>
                              <div className="flex items-center">
                                <Clock className="w-4 h-4 mr-1" />
                                {session.start_time} - {session.end_time}
                              </div>
                              <div className="flex items-center">
                                <MapPin className="w-4 h-4 mr-1" />
                                {session.room_location}
                              </div>
                            </div>
                            {session.notes && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {session.notes}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          {/* Attendance Stats */}
                          <div className="text-right">
                            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                              {session.attendance_count}/{session.total_enrolled}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              Present ({session.total_enrolled > 0 ? Math.round((session.attendance_count / session.total_enrolled) * 100) : 0}%)
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2">
                            {session.status === 'scheduled' && (
                              <Button
                                onClick={() => startSession(session.id)}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <Play className="w-4 h-4 mr-1" />
                                Start
                              </Button>
                            )}
                            {session.status === 'active' && (
                              <Button
                                onClick={() => stopSession(session.id)}
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                <Square className="w-4 h-4 mr-1" />
                                Stop
                              </Button>
                            )}
                            {session.status === 'completed' && (
                              <Button
                                onClick={() => router.push(`/professor/sessions/${session.id}?manage=true`)}
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Manage
                              </Button>
                            )}
                            <Button
                              onClick={() => router.push(`/professor/sessions/${session.id}`)}
                              variant="outline"
                              size="sm"
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Analytics Header */}
            <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Class Analytics</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Attendance trends and student performance</p>
                </div>
                <Button
                  onClick={fetchAnalytics}
                  disabled={isLoadingAnalytics}
                  variant="outline"
                  size="sm"
                >
                  {isLoadingAnalytics ? (
                    <LoadingSpinner className="w-4 h-4 mr-2" />
                  ) : (
                    <BarChart3 className="w-4 h-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {isLoadingAnalytics ? (
                <div className="text-center py-12">
                  <LoadingSpinner className="mx-auto mb-4" />
                  <p className="text-slate-500 dark:text-slate-400">Loading analytics...</p>
                </div>
              ) : analyticsData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {analyticsData.total_sessions}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">Completed Sessions</p>
                  </div>
                  <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {analyticsData.total_students}
                    </p>
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">Total Students</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {analyticsData.average_attendance_rate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-purple-700 dark:text-purple-300">Avg Attendance</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-400 dark:text-slate-500" />
                  <p className="text-lg font-medium mb-2">No Analytics Data</p>
                  <p className="text-sm">Complete some sessions to see analytics</p>
                </div>
              )}
            </Card>

            {analyticsData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Student List - Left Side */}
                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Student Attendance</h4>
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        placeholder="Search students..."
                        value={analyticsSearchQuery}
                        onChange={(e) => setAnalyticsSearchQuery(e.target.value)}
                        className="pl-10 w-64"
                      />
                    </div>
                  </div>
                  
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {analyticsData.student_analytics
                      .filter((student: any) => 
                        `${student.first_name} ${student.last_name}`.toLowerCase().includes(analyticsSearchQuery.toLowerCase()) ||
                        student.student_id.toLowerCase().includes(analyticsSearchQuery.toLowerCase())
                      )
                      .map((student: any) => (
                        <div
                          key={student.student_id}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white">
                              {student.first_name} {student.last_name}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              ID: {student.student_id}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full transition-all duration-300 ${
                                    student.attendance_percentage >= 80
                                      ? 'bg-emerald-500'
                                      : student.attendance_percentage >= 60
                                      ? 'bg-yellow-500'
                                      : 'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(student.attendance_percentage, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white min-w-[3rem]">
                                {student.attendance_percentage.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {student.attended_sessions}/{student.total_sessions} sessions
                            </p>
                          </div>
                        </div>
                      ))}
                  </div>
                </Card>

                {/* Charts - Right Side */}
                <div className="space-y-6">
                  {/* Attendance Trend Timeline Chart */}
                  <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Attendance Trend Timeline</h4>
                    <div className="h-64 relative">
                      {/* Chart Container */}
                      <div className="absolute inset-0 p-4">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-xs text-slate-500 dark:text-slate-400">
                          <span>100%</span>
                          <span>75%</span>
                          <span>50%</span>
                          <span>25%</span>
                          <span>0%</span>
                        </div>
                        
                        {/* Chart Area */}
                        <div className="ml-8 mr-4 h-full relative">
                          {/* Grid lines */}
                          <div className="absolute inset-0">
                            {[0, 25, 50, 75, 100].map((line) => (
                              <div
                                key={line}
                                className="absolute w-full border-t border-slate-200 dark:border-slate-600"
                                style={{ bottom: `${line}%` }}
                              ></div>
                            ))}
                          </div>
                          
                          {/* Data points and line */}
                          {analyticsData.attendance_trends.length > 0 && (
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                              {/* Line path */}
                              <polyline
                                fill="none"
                                stroke="rgb(59, 130, 246)"
                                strokeWidth="0.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={analyticsData.attendance_trends.map((trend: any, index: number) => {
                                  const x = (index / (analyticsData.attendance_trends.length - 1)) * 100;
                                  const y = 100 - trend.attendance_rate;
                                  return `${x},${y}`;
                                }).join(' ')}
                              />
                              
                              {/* Data points */}
                              {analyticsData.attendance_trends.map((trend: any, index: number) => {
                                const x = (index / (analyticsData.attendance_trends.length - 1)) * 100;
                                const y = 100 - trend.attendance_rate;
                                return (
                                  <circle
                                    key={trend.session_id}
                                    cx={x}
                                    cy={y}
                                    r="1.5"
                                    fill="rgb(59, 130, 246)"
                                    className="hover:r-2 transition-all duration-200"
                                  />
                                );
                              })}
                            </svg>
                          )}
                        </div>
                        
                        {/* X-axis labels */}
                        <div className="absolute bottom-0 left-8 right-4 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                          {analyticsData.attendance_trends.map((trend: any, index: number) => (
                            <div key={trend.session_id} className="text-center">
                              <div className="font-medium">S{trend.session_number}</div>
                              <div className="text-xs">
                                {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      {/* Legend */}
                      <div className="absolute top-2 right-2 bg-white dark:bg-slate-700 rounded-lg px-3 py-2 shadow-sm">
                        <div className="flex items-center space-x-2 text-xs">
                          <div className="w-3 h-0.5 bg-blue-500"></div>
                          <span className="text-slate-600 dark:text-slate-300">Attendance Rate</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Trend Summary */}
                    <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-600">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Highest:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">
                            {Math.max(...analyticsData.attendance_trends.map((t: any) => t.attendance_rate)).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Lowest:</span>
                          <span className="ml-2 font-medium text-slate-900 dark:text-white">
                            {Math.min(...analyticsData.attendance_trends.map((t: any) => t.attendance_rate)).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Attendance Distribution */}
                  <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg dark:shadow-2xl">
                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Attendance Distribution</h4>
                    <div className="space-y-3">
                      {[
                        { label: 'Excellent (80%+)', min: 80, color: 'emerald', count: analyticsData.student_analytics.filter((s: any) => s.attendance_percentage >= 80).length },
                        { label: 'Good (60-79%)', min: 60, max: 79, color: 'yellow', count: analyticsData.student_analytics.filter((s: any) => s.attendance_percentage >= 60 && s.attendance_percentage < 80).length },
                        { label: 'Needs Improvement (<60%)', min: 0, max: 59, color: 'red', count: analyticsData.student_analytics.filter((s: any) => s.attendance_percentage < 60).length }
                      ].map((category) => {
                        const percentage = analyticsData.total_students > 0 ? (category.count / analyticsData.total_students) * 100 : 0;
                        
                        return (
                          <div key={category.label} className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full bg-${category.color}-500`}></div>
                              <span className="text-sm text-slate-700 dark:text-slate-300">{category.label}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <div className="w-20 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full bg-${category.color}-500 transition-all duration-300`}
                                  style={{ width: `${percentage}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium text-slate-900 dark:text-white min-w-[2rem]">
                                {category.count}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai-assistant' && (
          <div className="space-y-6">
            <AIAssistant 
              classId={classId} 
              professorId={classData?.professor_id || ''} 
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default function ClassManagementPage() {
  return (
    <ProtectedRoute requiredRole="professor">
      <ClassManagementPageContent />
    </ProtectedRoute>
  );
}