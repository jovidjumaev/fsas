'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, MessageCircle, FileText, Trash2, Send, Bot, User, BarChart3, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { io } from 'socket.io-client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { createLogger } from '../../lib/logger';
const logger = createLogger('ai-assistant');

interface Material {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  is_processed: boolean;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tokens_used?: number;
}

interface AIAssistantProps {
  classId: string;
  professorId: string;
}

interface QuizAttemptSummary {
  quizSessionId: string;
  materialId?: string | null;
  materialName: string;
  scorePercentage: number | null;
  correctAnswers: number | null;
  totalQuestions: number | null;
  startedAt: string | null;
  completedAt: string | null;
  isCompleted: boolean;
}

interface QuizInsightsTotals {
  totalStudents: number;
  studentsAttempted: number;
  studentsNotAttempted: number;
  averageScore: number | null;
  totalCompletedAttempts: number;
}

interface QuizInsightsStudent {
  studentId: string;
  studentNumber?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  hasAttempted: boolean;
  latestAttempt: QuizAttemptSummary | null;
  materialSnapshots: QuizAttemptSummary[];
  attemptHistory: QuizAttemptSummary[];
}

interface QuizInsightsMaterial {
  materialId: string;
  materialName: string;
  uploadedAt: string | null;
  totalAttempts: number;
  startedAttempts: number;
  completedAttempts: number;
  studentsAttempted: number;
  studentsNotAttempted: number;
  averageScore: number | null;
  maxScore: number | null;
  minScore: number | null;
  lastCompletedAt: string | null;
  averageQuestionAccuracy: number | null;
  questionSamples?: {
    totalQuestions: number;
    totalQuestionAttempts: number;
  };
  recentAttempts?: Array<{
    quizSessionId: string;
    studentId: string;
    startedAt: string | null;
    completedAt: string | null;
    isCompleted: boolean;
    scorePercentage: number | null;
    correctAnswers: number | null;
    totalQuestions: number | null;
  }>;
}

interface QuizInsights {
  totals: QuizInsightsTotals;
  students: QuizInsightsStudent[];
  materials: QuizInsightsMaterial[];
  generatedAt: string;
}

export function AIAssistant({ classId, professorId }: AIAssistantProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState<string | null>(null);
  const [quizInsights, setQuizInsights] = useState<QuizInsights | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'materials' | 'quiz' | 'chat'>('quiz');
  const [studentFilter, setStudentFilter] = useState<'all' | 'attempted' | 'notAttempted'>('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load materials and create session on component mount
  useEffect(() => {
    loadMaterials();
    createChatSession();
    
    // Connect to WebSocket for real-time updates
    const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001');
    
    // Listen for attendance status updates
    socket.on('attendance_status_updated', (data) => {
      logger.log('📊 AI Assistant received attendance status update:', data);
      
      // Show a toast notification about the update
      toast.success('Attendance data updated! Ask the AI for fresh information.');
    });
    
    return () => {
      socket.disconnect();
    };
  }, [classId]);

  useEffect(() => {
    loadQuizInsights();
  }, [classId, professorId]);

  useEffect(() => {
    if (!quizInsights) {
      setSelectedStudentId('all');
      setSelectedMaterialId('all');
      return;
    }

    if (
      selectedStudentId !== 'all' &&
      !quizInsights.students.some((student) => student.studentId === selectedStudentId)
    ) {
      setSelectedStudentId('all');
    }

    if (
      selectedMaterialId !== 'all' &&
      !quizInsights.materials.some((material) => material.materialId === selectedMaterialId)
    ) {
      setSelectedMaterialId('all');
    }
  }, [quizInsights, selectedStudentId, selectedMaterialId]);

  // Add global navigation tracking
  useEffect(() => {
    const handleNavigation = () => {
      logger.log('🚨 NAVIGATION DETECTED! Current URL:', window.location.href);
      logger.log('🚨 Navigation stack trace:', new Error().stack);
    };

    // Listen for navigation events
    window.addEventListener('beforeunload', handleNavigation);
    window.addEventListener('popstate', handleNavigation);
    
    // Also track any programmatic navigation
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    history.pushState = function(...args) {
      logger.log('🚨 pushState called:', args);
      logger.log('🚨 pushState stack trace:', new Error().stack);
      originalPushState.apply(history, args);
    };
    
    history.replaceState = function(...args) {
      logger.log('🚨 replaceState called:', args);
      logger.log('🚨 replaceState stack trace:', new Error().stack);
      originalReplaceState.apply(history, args);
    };

    // Track any location changes
    const originalLocation = window.location;
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      if (window.location.href !== lastUrl) {
        logger.log('🚨 URL CHANGED!');
        logger.log('🚨 From:', lastUrl);
        logger.log('🚨 To:', window.location.href);
        logger.log('🚨 URL change stack trace:', new Error().stack);
        lastUrl = window.location.href;
      }
    };
    
    // Check for URL changes every 100ms
    const urlCheckInterval = setInterval(checkUrlChange, 100);

    return () => {
      window.removeEventListener('beforeunload', handleNavigation);
      window.removeEventListener('popstate', handleNavigation);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
      clearInterval(urlCheckInterval);
    };
  }, []);

  const loadMaterials = async () => {
    try {
      logger.log('📋 Loading materials, URL before fetch:', window.location.href);
      const response = await fetch(
        `/api/classes/${classId}/materials?professorId=${professorId}`
      );
      logger.log('📋 Materials response received, URL:', window.location.href);
      const data = await response.json();
      logger.log('📋 Materials data parsed, URL:', window.location.href);
      
      if (data.success) {
        logger.log('📋 Setting materials, URL:', window.location.href);
        setMaterials(data.materials);
        logger.log('📋 Materials set successfully, URL:', window.location.href);
      } else {
        logger.log('📋 Failed to load materials, URL:', window.location.href);
        toast.error('Failed to load materials');
      }
    } catch (error: unknown) {
      logger.error('❌ Error loading materials:', error);
      logger.log('❌ URL after materials error:', window.location.href);
      toast.error('Error loading materials');
    }
  };

  const loadQuizInsights = async () => {
    if (!professorId || !classId) return;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';

    setIsQuizLoading(true);
    setQuizError(null);

    try {
      const response = await fetch(
        `${baseUrl}/api/professors/${professorId}/classes/${classId}/ai/quiz-insights`
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setQuizInsights({
          totals: data.data?.totals || {
            totalStudents: 0,
            studentsAttempted: 0,
            studentsNotAttempted: 0,
            averageScore: null,
            totalCompletedAttempts: 0,
          },
          students: data.data?.students || [],
          materials: data.data?.materials || [],
          generatedAt: data.data?.generatedAt || new Date().toISOString()
        });
      } else {
        throw new Error(data.error || 'Failed to load quiz insights');
      }
    } catch (error: unknown) {
      logger.error('❌ Error loading quiz insights:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to load quiz insights';
      setQuizError(message);
      toast.error(message);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const createChatSession = async () => {
    try {
      const response = await fetch(
        `/api/classes/${classId}/chat/session`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professorId,
            sessionName: `Chat Session - ${new Date().toLocaleDateString()}`
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setSessionId(data.session.id);
        loadChatHistory(data.session.id);
      } else {
        toast.error('Failed to create chat session');
      }
    } catch (error: unknown) {
      logger.error('Error creating chat session:', error);
      toast.error('Error creating chat session');
    }
  };

  const loadChatHistory = async (sessionId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/classes/${classId}/chat/session/${sessionId}/messages?professorId=${professorId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error: unknown) {
      logger.error('Error loading chat history:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    logger.log('📁 File upload started');
    logger.log('📁 Current URL before upload:', window.location.href);
    const file = event.target.files?.[0];
    if (!file) return;

    logger.log('📁 File selected:', file.name, file.type, file.size);

    // Validate file type
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, TXT, DOCX, PPT, and PPTX files are allowed');
      return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return;
    }

    setIsUploading(true);
    logger.log('📁 Starting upload process');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('professorId', professorId);

      logger.log('📡 Uploading to:', `/api/classes/${classId}/materials/upload`);
      logger.log('📡 File details:', file.name, file.type, file.size);

      const response = await fetch(
        `/api/classes/${classId}/materials/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      logger.log('📡 Upload response status:', response.status);
      logger.log('📡 URL immediately after response:', window.location.href);
      
      const data = await response.json();
      logger.log('📡 Upload response data:', data);
      logger.log('📡 URL after parsing response:', window.location.href);
      
      if (data.success) {
        logger.log('✅ Upload successful, URL after upload:', window.location.href);
        logger.log('✅ About to call loadMaterials()');
        toast.success('File uploaded successfully');
        logger.log('✅ About to reload materials, URL:', window.location.href);
        loadMaterials(); // Reload materials
        logger.log('✅ Materials reloaded, final URL:', window.location.href);
      } else {
        logger.log('❌ Upload failed, URL after failed upload:', window.location.href);
        toast.error(data.error || 'Failed to upload file');
      }
    } catch (error: unknown) {
      logger.error('❌ Error uploading file:', error);
      logger.log('❌ URL after upload error:', window.location.href);
      toast.error('Error uploading file');
    } finally {
      logger.log('🏁 Upload process finished, final URL:', window.location.href);
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    logger.log('💬 Send message button clicked');
    if (!inputMessage.trim() || !sessionId) {
      logger.log('❌ Cannot send message - no input or session');
      return;
    }

    const userMessage = inputMessage.trim();
    logger.log('💬 Sending message:', userMessage);
    setInputMessage('');
    setIsLoading(true);

    // Add user message to UI immediately
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      logger.log('📡 Sending to:', `/api/classes/${classId}/chat/message`);
      const response = await fetch(
        `/api/classes/${classId}/chat/message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            professorId,
            sessionId,
            message: userMessage
          })
        }
      );

      logger.log('📡 Chat response status:', response.status);
      const data = await response.json();
      logger.log('📡 Chat response data:', data);
      
      if (data.success) {
        // Add AI response to messages
        const aiMessage: ChatMessage = {
          id: data.message.id,
          role: 'assistant',
          content: data.response,
          timestamp: data.message.timestamp,
          tokens_used: data.tokens_used
        };
        setMessages(prev => [...prev, aiMessage]);
        
        // Update total token usage
        if (data.tokens_used) {
          setTotalTokensUsed(prev => prev + data.tokens_used);
        }
      } else {
        toast.error(data.error || 'Failed to send message');
        // Remove the user message if sending failed
        setMessages(prev => prev.slice(0, -1));
      }
    } catch (error: unknown) {
      logger.error('Error sending message:', error);
      toast.error('Error sending message');
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    logger.log('🔑 Key pressed:', event.key, 'Code:', event.code);
    logger.log('🔑 Shift key:', event.shiftKey, 'Ctrl key:', event.ctrlKey, 'Alt key:', event.altKey);
    
    if (event.key === 'Enter' && !event.shiftKey) {
      logger.log('✅ Enter key detected, sending message');
      event.preventDefault();
      event.stopPropagation();
      handleSendMessage();
    } else if (event.key === 'Enter' && event.shiftKey) {
      logger.log('📝 Shift+Enter detected, allowing new line');
      // Allow Shift+Enter for new lines
    } else {
      logger.log('🔑 Other key pressed:', event.key);
    }
  };

  const handleKeyUp = (event: React.KeyboardEvent) => {
    logger.log('🔑 Key released:', event.key, 'Code:', event.code);
    
    // Fallback for Enter key if onKeyDown didn't work
    if (event.key === 'Enter' && !event.shiftKey) {
      logger.log('✅ Enter key fallback detected, sending message');
      event.preventDefault();
      event.stopPropagation();
      handleSendMessage();
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    logger.log('🗑️ Delete button clicked for material:', materialId);
    logger.log('🗑️ Current URL before delete:', window.location.href);
    setMaterialToDelete(materialId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!materialToDelete) return;

    logger.log('🗑️ Attempting to delete material:', materialToDelete);
    logger.log('🗑️ Current URL before delete API call:', window.location.href);

    try {
      logger.log('📡 Delete URL:', `/api/classes/${classId}/materials/${materialToDelete}`);
      logger.log('📡 Environment:', process.env.NODE_ENV);
      logger.log('📡 API URL:', process.env.NEXT_PUBLIC_API_URL);

      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(`/api/classes/${classId}/materials/${materialToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ professorId }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      logger.log('📡 Delete response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`❌ Delete failed: ${response.status} ${errorText}`);
        toast.error(`Delete failed: ${response.status} ${response.statusText}`);
        return;
      }

      const data = await response.json();
      logger.log('📡 Delete response data:', data);

      if (data.success) {
        logger.log('✅ Delete successful, URL after delete:', window.location.href);
        toast.success('File deleted successfully');
        
        // Add small delay before reloading to prevent auth conflicts
        setTimeout(() => {
          logger.log('🔄 Reloading materials after delay...');
          loadMaterials();
        }, 500);
      } else {
        logger.log('❌ Delete failed, URL after failed delete:', window.location.href);
        toast.error(data.error || 'Failed to delete file');
      }
    } catch (error: unknown) {
      logger.error('❌ Error deleting material:', error);
      logger.log('❌ URL after error:', window.location.href);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.error('Delete request timed out. Please try again.');
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error';
        toast.error('Failed to delete file: ' + message);
      }
    } finally {
      logger.log('🏁 Delete process finished, final URL:', window.location.href);
      setShowDeleteConfirm(false);
      setMaterialToDelete(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    if (fileType.includes('text')) return '📃';
    if (fileType.includes('powerpoint') || fileType.includes('presentation')) return '📊';
    return '📁';
  };

  const formatScore = (score?: number | null) => {
    if (score === null || score === undefined) return '—';
    const rounded = Math.round(score);
    return `${rounded}%`;
  };

  const formatDate = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return '—';
    }
  };

  const getStudentInitials = (student: QuizInsightsStudent) => {
    const first = student.firstName?.[0] || '';
    const last = student.lastName?.[0] || '';
    const initials = `${first}${last}`.toUpperCase();
    return initials || 'S';
  };

  const getAttemptStatus = (attempt: QuizAttemptSummary) =>
    attempt.isCompleted ? 'Completed' : 'In progress';

  const studentOptions = useMemo(() => {
    if (!quizInsights) return [];
    return [...quizInsights.students].sort((a, b) => {
      const lastCompare = a.lastName.localeCompare(b.lastName);
      if (lastCompare !== 0) return lastCompare;
      return a.firstName.localeCompare(b.firstName);
    });
  }, [quizInsights]);

  const materialOptions = useMemo(() => {
    if (!quizInsights) return [];
    return [...quizInsights.materials].sort((a, b) =>
      a.materialName.localeCompare(b.materialName)
    );
  }, [quizInsights]);

  const filteredStudents = useMemo(() => {
    if (!quizInsights) return [];
    let list = [...quizInsights.students];

    if (studentFilter === 'attempted') {
      list = list.filter((student) => student.hasAttempted);
    } else if (studentFilter === 'notAttempted') {
      list = list.filter((student) => !student.hasAttempted);
    }

    // Material filter: show all students but prioritize those with attempts for the focused material
    if (selectedMaterialId !== 'all') {
      // Don't filter out students, just sort by their attempt status for this material
      list = list.sort((a, b) => {
        const aHasMaterial = a.materialSnapshots.some(s => s.materialId === selectedMaterialId);
        const bHasMaterial = b.materialSnapshots.some(s => s.materialId === selectedMaterialId);

        // Students with attempts for this material come first
        if (aHasMaterial && !bHasMaterial) return -1;
        if (!aHasMaterial && bHasMaterial) return 1;

        // Within each group, sort by completion status and score
        const aSnapshot = a.materialSnapshots.find(s => s.materialId === selectedMaterialId);
        const bSnapshot = b.materialSnapshots.find(s => s.materialId === selectedMaterialId);

        if (aSnapshot && bSnapshot) {
          // Both have attempts - sort completed first, then by score
          if (aSnapshot.isCompleted && !bSnapshot.isCompleted) return -1;
          if (!aSnapshot.isCompleted && bSnapshot.isCompleted) return 1;
          if (aSnapshot.isCompleted && bSnapshot.isCompleted) {
            return (bSnapshot.scorePercentage || 0) - (aSnapshot.scorePercentage || 0);
          }
        }

        return 0;
      });
    } else {
      // Default sort by latest attempt
      list = list.sort((a, b) => {
        const aLatest = a.latestAttempt?.completedAt || a.latestAttempt?.startedAt || '';
        const bLatest = b.latestAttempt?.completedAt || b.latestAttempt?.startedAt || '';
        return (bLatest || '').localeCompare(aLatest || '');
      });
    }

    return list;
  }, [quizInsights, studentFilter, selectedMaterialId]);

  const focusStudent = useMemo(() => {
    if (!quizInsights || selectedStudentId === 'all') return null;
    return (
      quizInsights.students.find((student) => student.studentId === selectedStudentId) ||
      null
    );
  }, [quizInsights, selectedStudentId]);

  const selectedMaterial = useMemo(() => {
    if (!quizInsights || selectedMaterialId === 'all') return null;
    return (
      quizInsights.materials.find((material) => material.materialId === selectedMaterialId) ||
      null
    );
  }, [quizInsights, selectedMaterialId]);

  return (
    <div className="space-y-6">
      <Tabs
        value={activeSubTab}
        onValueChange={(value) => setActiveSubTab(value as 'materials' | 'quiz' | 'chat')}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <TabsTrigger
            value="materials"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-200"
          >
            Materials
          </TabsTrigger>
          <TabsTrigger
            value="quiz"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-200"
          >
            Quiz Insights
          </TabsTrigger>
          <TabsTrigger
            value="chat"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 transition data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm dark:text-slate-300 dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-blue-200"
          >
            AI Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="materials" className="mt-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="dark:bg-gray-800 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <FileText className="h-5 w-5" />
                Class Materials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 dark:bg-gray-800">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {isUploading ? 'Uploading...' : 'Upload File'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.txt,.docx,.ppt,.pptx"
                    onChange={handleFileUpload}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  PDF, TXT, DOCX, PPT, PPTX up to 50MB
                </span>
              </div>

              {materials.length > 0 ? (
                <div className="space-y-2">
                  {materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between rounded-lg border p-3 dark:border-gray-700 dark:bg-gray-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getFileIcon(material.file_type)}</span>
                        <div>
                          <p className="text-sm font-medium dark:text-gray-200">{material.file_name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(material.file_size)} • {new Date(material.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={material.is_processed ? 'default' : 'secondary'}>
                          {material.is_processed ? 'Processed' : 'Processing'}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMaterial(material.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No materials uploaded yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quiz" className="mt-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-col gap-2 dark:bg-gray-800 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                  <BarChart3 className="h-5 w-5" />
                  Quiz Insights
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadQuizInsights}
                  disabled={isQuizLoading}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
                >
                  Refresh
                </Button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Snapshot generated{' '}
                {quizInsights?.generatedAt ? new Date(quizInsights.generatedAt).toLocaleString() : '—'}.
              </p>
            </CardHeader>
            <CardContent className="space-y-6 dark:bg-gray-800">
              {isQuizLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500 dark:text-gray-300">
                  <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Loading quiz insights…
                </div>
              ) : quizError ? (
                <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/70 p-4 text-red-700 dark:border-red-800 dark:bg-red-900/40 dark:text-red-200">
                  <AlertTriangle className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-medium">Unable to load quiz insights.</p>
                    <p className="text-xs">{quizError}</p>
                  </div>
                </div>
              ) : quizInsights ? (
                <div className="space-y-6">
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-blue-50 p-4 dark:border-gray-700 dark:bg-blue-900/30">
                      <p className="text-xs font-semibold uppercase text-blue-600 dark:text-blue-200">
                        Total Students
                      </p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-100">
                        {quizInsights.totals.totalStudents}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-emerald-50 p-4 dark:border-gray-700 dark:bg-emerald-900/30">
                      <p className="text-xs font-semibold uppercase text-emerald-600 dark:text-emerald-200">
                        Attempted
                      </p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-100">
                        {quizInsights.totals.studentsAttempted}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-amber-50 p-4 dark:border-gray-700 dark:bg-amber-900/30">
                      <p className="text-xs font-semibold uppercase text-amber-600 dark:text-amber-200">
                        Not Attempted
                      </p>
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-100">
                        {quizInsights.totals.studentsNotAttempted}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 dark:border-gray-700 dark:bg-slate-800">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Avg. Score
                      </p>
                      <p className="text-2xl font-bold text-slate-800 dark:text-white">
                        {formatScore(quizInsights.totals.averageScore)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {quizInsights.totals.totalCompletedAttempts} completed attempts
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Student Filter
                      </p>
                      <Select
                        value={studentFilter}
                        onValueChange={(value) => {
                          setStudentFilter(value as 'all' | 'attempted' | 'notAttempted');
                          setSelectedStudentId('all');
                        }}
                        disabled={!quizInsights.students.length}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All students</SelectItem>
                          <SelectItem value="attempted">Only attempted</SelectItem>
                          <SelectItem value="notAttempted">Not attempted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Focus Student
                      </p>
                      <Select
                        value={selectedStudentId}
                        onValueChange={(value) => setSelectedStudentId(value)}
                        disabled={!studentOptions.length}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All students" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All students</SelectItem>
                          {studentOptions.map((student) => (
                            <SelectItem key={student.studentId} value={student.studentId}>
                              {student.firstName} {student.lastName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                        Material Filter
                      </p>
                      <Select
                        value={selectedMaterialId}
                        onValueChange={(value) => setSelectedMaterialId(value)}
                        disabled={!materialOptions.length}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="All materials" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All materials</SelectItem>
                          {materialOptions.map((material) => (
                            <SelectItem key={material.materialId} value={material.materialId}>
                              {material.materialName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {selectedMaterial && (
                    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                      <span>
                        Focused material:{' '}
                        <span className="font-semibold">{selectedMaterial.materialName}</span>
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMaterialId('all')}>
                        Clear
                      </Button>
                    </div>
                  )}

                  <div className="grid gap-4 lg:grid-cols-[350px,1fr]">
                    <div className="space-y-2">
                      {filteredStudents.length > 0 ? (
                        filteredStudents.map((student) => {
                          const isActive = selectedStudentId === student.studentId;
                          const latest = student.latestAttempt;
                          const statusClasses = latest
                            ? latest.isCompleted
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
                          const scoreDisplay =
                            latest && latest.isCompleted ? formatScore(latest.scorePercentage) : '—';

                          return (
                            <div
                              key={student.studentId}
                              onClick={() =>
                                setSelectedStudentId((current) =>
                                  current === student.studentId ? 'all' : student.studentId
                                )
                              }
                              className={`cursor-pointer rounded-lg border p-3 transition ${
                                isActive
                                  ? 'border-blue-500 bg-blue-50/60 shadow-sm ring-2 ring-blue-200 dark:border-blue-500 dark:bg-blue-900/30 dark:ring-blue-400/50'
                                  : 'border-gray-200 bg-white hover:border-blue-200 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-400/50'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white dark:bg-blue-500">
                                    {getStudentInitials(student)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                      {student.firstName} {student.lastName}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                      {student.email}
                                      {student.studentNumber ? ` • ${student.studentNumber}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  {latest ? (
                                    <>
                                      <Badge variant="secondary" className={statusClasses}>
                                        {getAttemptStatus(latest)}
                                      </Badge>
                                      <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                        {scoreDisplay}
                                      </p>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {latest.materialName}
                                      </p>
                                    </>
                                  ) : (
                                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                                      Not attempted
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          No students match the current filters.
                        </p>
                      )}
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/60">
                      {focusStudent ? (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-semibold text-slate-800 dark:text-white">
                                {focusStudent.firstName} {focusStudent.lastName}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {focusStudent.email}
                                {focusStudent.studentNumber ? ` • ${focusStudent.studentNumber}` : ''}
                              </p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedStudentId('all')}>
                              Clear
                            </Button>
                          </div>
                          {(() => {
                            const snapshots = selectedMaterialId !== 'all'
                              ? focusStudent.materialSnapshots.filter(s => s.materialId === selectedMaterialId)
                              : focusStudent.materialSnapshots;
                            return snapshots.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                {snapshots.map((snapshot) => (
                                  <span
                                    key={`${snapshot.materialId}-${snapshot.quizSessionId}`}
                                    className={`rounded-md px-2 py-1 ${
                                      snapshot.isCompleted
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                                    }`}
                                  >
                                    {snapshot.materialName}:{' '}
                                    {snapshot.isCompleted
                                      ? formatScore(snapshot.scorePercentage)
                                      : 'In progress'}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-300">
                              Attempt History
                              {selectedMaterialId !== 'all' && selectedMaterial && (
                                <span className="ml-2 text-blue-600 dark:text-blue-300">
                                  ({selectedMaterial.materialName})
                                </span>
                              )}
                            </p>
                            {(() => {
                              const attempts = selectedMaterialId !== 'all'
                                ? focusStudent.attemptHistory.filter(a => a.materialId === selectedMaterialId)
                                : focusStudent.attemptHistory;
                              return attempts.length > 0 ? (
                                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                                  {attempts.map((attempt, index) => {
                                  const isLatest = index === 0;
                                  return (
                                    <div
                                      key={attempt.quizSessionId}
                                      className={`rounded-md border p-3 text-sm ${
                                        isLatest
                                          ? 'border-blue-200 bg-blue-50/70 dark:border-blue-800 dark:bg-blue-900/20'
                                          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-semibold text-slate-800 dark:text-white">
                                          {attempt.materialName}
                                        </p>
                                        <Badge
                                          variant="secondary"
                                          className={
                                            attempt.isCompleted
                                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                                          }
                                        >
                                          {getAttemptStatus(attempt)}
                                        </Badge>
                                      </div>
                                      <div className="mt-2 grid gap-2 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                                        <span>
                                          Score:{' '}
                                          {attempt.isCompleted
                                            ? formatScore(attempt.scorePercentage)
                                            : '—'}
                                        </span>
                                        <span>
                                          Correct:{' '}
                                          {attempt.isCompleted && attempt.correctAnswers !== null
                                            ? `${attempt.correctAnswers}/${attempt.totalQuestions ?? 0}`
                                            : `${attempt.totalQuestions ?? 0} questions`}
                                        </span>
                                        <span>Started: {formatDateTime(attempt.startedAt)}</span>
                                        <span>
                                          Completed:{' '}
                                          {attempt.isCompleted ? formatDateTime(attempt.completedAt) : '—'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                {selectedMaterialId !== 'all'
                                  ? `No quiz attempts for this material yet.`
                                  : `No quiz attempts recorded yet.`}
                              </p>
                            );
                          })()}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500 dark:text-slate-400">
                          <Bot className="h-10 w-10 opacity-40" />
                          <p>Select a student to view detailed quiz history.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500 dark:text-slate-300" />
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Material Performance
                      </h3>
                    </div>
                    {quizInsights.materials.length > 0 ? (
                      <div className="space-y-3">
                        {quizInsights.materials.map((material) => {
                          const isActive = selectedMaterialId === material.materialId;

                          return (
                            <div
                              key={material.materialId}
                              className={`rounded-lg border p-4 transition ${
                                isActive
                                  ? 'border-blue-500 bg-blue-50/60 shadow-sm dark:border-blue-500 dark:bg-blue-900/20'
                                  : 'border-gray-200 bg-white hover:border-blue-200 dark:border-gray-700 dark:bg-gray-800/60 dark:hover:border-blue-400/40'
                              }`}
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                    {material.materialName}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Uploaded {formatDate(material.uploadedAt)}
                                    {material.lastCompletedAt
                                      ? ` • Last completed ${formatDate(material.lastCompletedAt)}`
                                      : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200">
                                    Avg: {formatScore(material.averageScore)}
                                  </Badge>
                                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    Attempts: {material.completedAttempts}/{material.totalAttempts}
                                  </Badge>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSelectedMaterialId(isActive ? 'all' : material.materialId)
                                    }
                                    className="border-blue-200 text-blue-600 hover:bg-blue-100 dark:border-blue-500/40 dark:text-blue-200 dark:hover:bg-blue-900/30"
                                  >
                                    {isActive ? 'Clear focus' : 'Focus'}
                                  </Button>
                                </div>
                              </div>
                              <div className="mt-3 grid gap-3 text-xs text-slate-600 dark:text-slate-300 sm:grid-cols-3">
                                <div className="flex justify-between sm:block">
                                  <span className="block font-medium">Students Attempted</span>
                                  <span>{material.studentsAttempted}</span>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="block font-medium">Students Not Attempted</span>
                                  <span>{material.studentsNotAttempted}</span>
                                </div>
                                <div className="flex justify-between sm:block">
                                  <span className="block font-medium">Question Accuracy</span>
                                  <span>
                                    {material.averageQuestionAccuracy !== null
                                      ? `${Math.round(material.averageQuestionAccuracy)}%`
                                      : '—'}
                                  </span>
                                </div>
                              </div>
                              {material.averageScore !== null && material.averageScore < 60 && (
                                <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                                  <AlertTriangle className="h-4 w-4" />
                                  Students may be struggling with this material.
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        No quiz activity recorded yet.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Quiz insights will appear once students begin using the AI assistant quizzes.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="mt-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="dark:bg-gray-800 dark:border-gray-700">
              <CardTitle className="flex items-center gap-2 dark:text-gray-100">
                <MessageCircle className="h-5 w-5" />
                AI Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 dark:bg-gray-800">
              <div className="h-96 space-y-4 overflow-y-auto rounded-lg border p-4 dark:border-gray-600 dark:bg-gray-700">
                {messages.length > 0 ? (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`flex gap-2 max-w-[80%] ${
                          message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {message.role === 'user' ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </div>
                        <div
                          className={`rounded-lg p-3 ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-xs opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                            {message.tokens_used && (
                              <p className="text-xs opacity-50">{message.tokens_used} tokens</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                    <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Start a conversation with the AI assistant</p>
                    <p className="text-sm">
                      Ask anything about this course—student stats, attendance, materials, or upload files.
                    </p>
                  </div>
                )}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200">
                        <Bot className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="rounded-lg bg-gray-100 p-3">
                        <div className="flex gap-1">
                          <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400"></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div
                            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {totalTokensUsed > 0 && (
                <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                  Total tokens used this session: {totalTokensUsed}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    {...({
                      onKeyDown: handleKeyDown,
                      onKeyUp: handleKeyUp
                    } as any)}
                    placeholder="Ask a concise question about your materials..."
                    disabled={isLoading}
                    className="flex-1"
                    maxLength={200}
                  />
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading || inputMessage.length > 200}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-right text-xs text-gray-400 dark:text-gray-500">
                  {inputMessage.length}/200 characters
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setMaterialToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete File"
        message="Are you sure you want to delete this file? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
