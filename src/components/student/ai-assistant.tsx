'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  BookOpen,
  HelpCircle,
  Send,
  Upload,
  RefreshCw,
  Brain,
  FileText,
  Clock,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Check,
  X,
  Download,
  History,
  BarChart3,
  Eye
} from 'lucide-react';

interface StudentAIAssistantProps {
  classId: string;
  studentId: string;
}

export function StudentAIAssistant({ classId, studentId }: StudentAIAssistantProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'flashcards' | 'quiz'>('chat');
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Flashcards state
  const [flashcards, setFlashcards] = useState<any[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardStudyStatus, setFlashcardStudyStatus] = useState<{ [key: string]: 'known' | 'unknown' | null }>({});
  
  // Quiz state
  const [quizSession, setQuizSession] = useState<any>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({});
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [isSubmittingQuiz, setIsSubmittingQuiz] = useState(false);

  // Quiz history and mastery state
  const [quizHistory, setQuizHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [masteryData, setMasteryData] = useState<{ [materialId: string]: any[] }>({});

  console.log('🎓 StudentAIAssistant component rendered for class:', classId, 'student:', studentId);

  // Load materials on component mount
  useEffect(() => {
    loadMaterials();
    createChatSession();
  }, [classId, studentId]);

  // Load flashcards when flashcards tab is active
  useEffect(() => {
    if (activeSubTab === 'flashcards') {
      loadFlashcards();
    }
  }, [activeSubTab]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      console.log('📚 Loading materials for class:', classId);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/materials`);
      const data = await response.json();
      
      console.log('📚 Materials response:', data);
      
      if (data.success) {
        setMaterials(data.materials);
        if (data.materials.length > 0) {
          setSelectedMaterial(data.materials[0].id);
        }
      } else {
        console.error('❌ Failed to load materials:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading materials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createChatSession = async () => {
    try {
      console.log('💬 Creating chat session for class:', classId);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionName: `Study Session - ${new Date().toLocaleDateString()}`
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChatSessionId(data.session.id);
        console.log('💬 Chat session created:', data.session.id);
      } else {
        console.error('❌ Failed to create chat session:', data.error);
      }
    } catch (error) {
      console.error('❌ Error creating chat session:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !chatSessionId || isSendingMessage) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setIsSendingMessage(true);
    
    // Add user message to UI immediately
    const newUserMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    try {
      console.log('💬 Sending message to AI:', userMessage);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: chatSessionId,
          message: userMessage
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const aiMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);
        console.log('🤖 AI Response received, tokens used:', data.tokens_used);
      } else {
        console.error('❌ Failed to get AI response:', data.error);
        const errorMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  const getSelectedMaterialName = () => {
    const material = materials.find(m => m.id === selectedMaterial);
    return material ? material.file_name : 'Select Material';
  };

  const getSelectedMaterial = () => {
    return materials.find(m => m.id === selectedMaterial);
  };

  const handleDownloadMaterial = () => {
    const material = getSelectedMaterial();
    if (material && material.file_url) {
      // Create a temporary link element and click it to trigger download
      const link = document.createElement('a');
      link.href = material.file_url;
      link.download = material.file_name;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log('📥 Downloading material:', material.file_name);
    } else {
      console.error('❌ Material or file URL not available');
    }
  };

  // Flashcards functions
  const generateFlashcards = async () => {
    if (!selectedMaterial || isGeneratingFlashcards) return;

    try {
      setIsGeneratingFlashcards(true);
      setFlashcardStudyStatus({}); // Clear previous study status
      console.log('🃏 Generating flashcards for material:', selectedMaterial);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/flashcards/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          count: 10 // Generate 10 flashcards
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFlashcards(data.flashcards);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        console.log('✅ Flashcards generated:', data.flashcards.length);
      } else {
        console.error('❌ Failed to generate flashcards:', data.error);
      }
    } catch (error) {
      console.error('❌ Error generating flashcards:', error);
    } finally {
      setIsGeneratingFlashcards(false);
    }
  };

  const loadFlashcards = async () => {
    try {
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/flashcards`);
      const data = await response.json();
      
      if (data.success) {
        setFlashcards(data.flashcards || []);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        console.log('📚 Loaded flashcards:', data.flashcards.length);
      }
    } catch (error) {
      console.error('❌ Error loading flashcards:', error);
    }
  };

  const handleFlipCard = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setIsFlipped(false);
    }
  };

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setIsFlipped(false);
    }
  };

  const handleMarkAsKnown = () => {
    if (flashcards.length > 0 && currentCardIndex >= 0) {
      const cardId = flashcards[currentCardIndex].id;
      setFlashcardStudyStatus(prev => ({
        ...prev,
        [cardId]: 'known'
      }));
    }
  };

  const handleMarkAsUnknown = () => {
    if (flashcards.length > 0 && currentCardIndex >= 0) {
      const cardId = flashcards[currentCardIndex].id;
      setFlashcardStudyStatus(prev => ({
        ...prev,
        [cardId]: 'unknown'
      }));
    }
  };

  // Quiz functions
  const generateQuiz = async () => {
    if (!selectedMaterial || isGeneratingQuiz) return;

    try {
      setIsGeneratingQuiz(true);
      setQuizResults(null); // Clear previous results immediately
      console.log('📝 Generating quiz for material:', selectedMaterial);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          count: 5 // Generate 5 quiz questions
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setQuizSession(data.quiz_session);
        setQuizQuestions(data.questions);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        console.log('✅ Quiz generated:', data.questions.length);
      } else {
        console.error('❌ Failed to generate quiz:', data.error);
      }
    } catch (error) {
      console.error('❌ Error generating quiz:', error);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const submitQuiz = async () => {
    if (!quizSession || isSubmittingQuiz) return;

    try {
      setIsSubmittingQuiz(true);
      console.log('📝 Submitting quiz answers');
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizSessionId: quizSession.id,
          answers: selectedAnswers
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setQuizResults(data);
        console.log('✅ Quiz submitted. Score:', data.score, '/', data.total);
      } else {
        console.error('❌ Failed to submit quiz:', data.error);
      }
    } catch (error) {
      console.error('❌ Error submitting quiz:', error);
    } finally {
      setIsSubmittingQuiz(false);
    }
  };

  const getCurrentQuestion = () => {
    if (quizQuestions.length === 0 || currentQuestionIndex < 0 || currentQuestionIndex >= quizQuestions.length) {
      return null;
    }
    return quizQuestions[currentQuestionIndex];
  };

  const getAnswerStatus = (questionId: string) => {
    if (!quizResults || !quizResults.results) return null;
    const result = quizResults.results.find((r: any) => r.question_id === questionId);
    return result;
  };

  const isAllQuestionsAnswered = () => {
    return quizQuestions.length > 0 && quizQuestions.every(q => selectedAnswers[q.id] !== undefined);
  };

  // Load quiz history for selected material
  const loadQuizHistory = async () => {
    if (!selectedMaterial) return;

    try {
      setIsLoadingHistory(true);
      console.log('📊 Loading quiz history for material:', selectedMaterial);
      const response = await fetch(
        `/api/students/${studentId}/classes/${classId}/ai/quiz/history?materialId=${selectedMaterial}`
      );
      const data = await response.json();
      console.log('📊 Quiz history response:', data);

      if (data.success) {
        setQuizHistory(data.history || []);
        console.log('📊 Quiz history loaded:', data.history?.length || 0, 'attempts');
        calculateMasteryProgress(data.history || []);
      } else {
        console.error('❌ Failed to load quiz history:', data.error);
      }
    } catch (error) {
      console.error('❌ Error loading quiz history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Calculate mastery progress from quiz history
  const calculateMasteryProgress = (history: any[]) => {
    if (!selectedMaterial || history.length === 0) {
      console.log('📊 No history to calculate mastery for material:', selectedMaterial);
      return;
    }

    const materialHistory = history
      .filter((h) => h.material_id === selectedMaterial)
      .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
      .map((h, index) => ({
        date: new Date(h.completed_at),
        score: h.score_percentage,
        attempt: index + 1
      }));

    console.log('📊 Mastery data calculated:', materialHistory.length, 'attempts for material', selectedMaterial);
    setMasteryData((prev) => ({
      ...prev,
      [selectedMaterial]: materialHistory
    }));
  };

  // Load history when quiz tab is active or material changes
  useEffect(() => {
    if (activeSubTab === 'quiz' && selectedMaterial) {
      loadQuizHistory();
    }
  }, [activeSubTab, selectedMaterial]);

  return (
    <div className="space-y-6">
      {/* Material Selection Card */}
      <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Study Material</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {materials.length > 0 ? getSelectedMaterialName() : 'No materials available'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {materials.length > 0 && (
              <select 
                value={selectedMaterial} 
                onChange={(e) => setSelectedMaterial(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.file_name}
                  </option>
                ))}
              </select>
            )}
            {materials.length > 0 && getSelectedMaterial()?.file_url && (
              <Button
                onClick={handleDownloadMaterial}
                variant="outline"
                size="sm"
                className="border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 dark:border-green-600 dark:text-green-400 dark:hover:bg-green-900/30"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
            <Badge variant="outline" className="text-xs">
              {materials.length} materials available
            </Badge>
          </div>
        </div>
      </Card>

      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSubTab('chat')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeSubTab === 'chat'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>AI Chat</span>
          </button>
          <button
            onClick={() => setActiveSubTab('flashcards')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeSubTab === 'flashcards'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Flashcards</span>
          </button>
          <button
            onClick={() => setActiveSubTab('quiz')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
              activeSubTab === 'quiz'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Quiz Generator</span>
          </button>
        </nav>
      </div>

      {/* Chat Tab */}
      {activeSubTab === 'chat' && (
        <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Study Assistant</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ask questions about your class materials and attendance</p>
              </div>
            </div>
            <Button onClick={loadMaterials} variant="outline" size="sm" disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-12">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Start a conversation with your AI study assistant!
                </h4>
                <p className="text-gray-500 dark:text-gray-500 mb-4">
                  Ask about class materials, attendance, or study topics.
                </p>
                
                {/* Example Questions */}
                <div className="text-left max-w-md mx-auto">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Try asking:</p>
                  <div className="space-y-2 text-sm">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-700 dark:text-gray-300">"What's my attendance percentage?"</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-700 dark:text-gray-300">"When is the next class session?"</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-700 dark:text-gray-300">"How many sessions have I missed?"</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-600">
                      <p className="text-gray-700 dark:text-gray-300">"Explain the main concepts from the uploaded materials"</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="flex space-x-2">
            <Input
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about your class materials, attendance, or study topics..."
              {...({
                onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }
              } as any)}
              disabled={isSendingMessage || !chatSessionId}
              maxLength={200}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!inputMessage.trim() || isSendingMessage || !chatSessionId}
              className="px-6"
            >
              {isSendingMessage ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {inputMessage.length}/200 characters
          </p>
        </Card>
      )}

      {/* Flashcards Tab */}
      {activeSubTab === 'flashcards' && (
        <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Study Flashcards</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Generate flashcards from your class materials</p>
              </div>
            </div>
            <Button 
              onClick={generateFlashcards}
              disabled={!selectedMaterial || isGeneratingFlashcards || materials.length === 0}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {isGeneratingFlashcards ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
              <Upload className="w-4 h-4 mr-2" />
              Generate Flashcards
                </>
              )}
            </Button>
          </div>
          
          {flashcards.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                {materials.length === 0 ? 'No Flashcards Available' : 'Ready to Study?'}
            </h4>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
                {materials.length === 0 
                  ? 'No materials available. Ask your professor to upload study materials first.'
                  : 'Select a material and click "Generate Flashcards" to create study cards!'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Card Counter */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Card {currentCardIndex + 1} of {flashcards.length}
                  </p>
                  {flashcards[currentCardIndex] && flashcardStudyStatus[flashcards[currentCardIndex].id] && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        flashcardStudyStatus[flashcards[currentCardIndex].id] === 'known' 
                          ? 'border-green-500 text-green-700 bg-green-50 dark:border-green-400 dark:text-green-300 dark:bg-green-900/30'
                          : 'border-orange-500 text-orange-700 bg-orange-50 dark:border-orange-400 dark:text-orange-300 dark:bg-orange-900/30'
                      }`}
                    >
                      {flashcardStudyStatus[flashcards[currentCardIndex].id] === 'known' ? '✓ Known' : '? Needs Review'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Click card to flip</p>
              </div>

              {/* Flashcard Display */}
              <div 
                onClick={handleFlipCard}
                className="relative min-h-[320px] bg-white dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-lg cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.01] transform"
              >
                <div className="flex flex-col items-center justify-center p-10 h-full">
                  {isFlipped ? (
                    <div className="text-center max-w-2xl w-full">
                      <div className="inline-flex items-center space-x-2 mb-6">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">Answer</h4>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                        {flashcards[currentCardIndex]?.back_text}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center max-w-2xl w-full">
                      <div className="inline-flex items-center space-x-2 mb-6">
                        <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                          <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">Question</h4>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 text-lg leading-relaxed">
                        {flashcards[currentCardIndex]?.front_text}
                      </p>
                    </div>
            )}
          </div>
                <div className="absolute bottom-6 right-6 flex items-center space-x-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                  <RotateCcw className="w-5 h-5" />
                  <span className="text-xs font-medium">Click to flip</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col space-y-4">
                {/* Navigation and Study Status */}
                <div className="flex items-center justify-between space-x-3">
                  <Button
                    onClick={handlePreviousCard}
                    disabled={currentCardIndex === 0}
                    variant="outline"
                    size="lg"
                    className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-5 h-5 mr-2" />
                    Previous
                  </Button>

                  <div className="flex space-x-2">
                    <Button
                      onClick={handleMarkAsKnown}
                      disabled={flashcards.length === 0}
                      variant="outline"
                      size="lg"
                      className="border-green-300 text-green-700 bg-green-50 hover:bg-green-100 hover:border-green-400 dark:border-green-600 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                    >
                      <Check className="w-5 h-5 mr-2" />
                      Known
                    </Button>
                    <Button
                      onClick={handleMarkAsUnknown}
                      disabled={flashcards.length === 0}
                      variant="outline"
                      size="lg"
                      className="border-orange-300 text-orange-700 bg-orange-50 hover:bg-orange-100 hover:border-orange-400 dark:border-orange-600 dark:text-orange-400 dark:bg-orange-900/20 dark:hover:bg-orange-900/40"
                    >
                      <X className="w-5 h-5 mr-2" />
                      Unknown
                    </Button>
                  </div>

                  <Button
                    onClick={handleNextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    variant="outline"
                    size="lg"
                    className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>

                {/* Progress Indicator */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Study Progress</span>
                    <span>{Math.round(((currentCardIndex + 1) / flashcards.length) * 100)}%</span>
                  </div>
                  <div className="flex space-x-1.5 justify-center">
                    {flashcards.map((_, index) => (
                      <div
                        key={index}
                        className={`h-2.5 flex-1 max-w-12 rounded-full transition-all ${
                          index === currentCardIndex
                            ? 'bg-blue-600 dark:bg-blue-500'
                            : index < currentCardIndex
                            ? 'bg-blue-400 dark:bg-blue-700'
                            : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate New Flashcards Button */}
              <div className="text-center pt-4">
                <Button
                  onClick={generateFlashcards}
                  disabled={isGeneratingFlashcards || materials.length === 0}
                  variant="outline"
                  size="lg"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 hover:border-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/30"
                >
                  {isGeneratingFlashcards ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Generating New Flashcards...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Generate New Flashcards
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Quiz Tab */}
      {activeSubTab === 'quiz' && (
        <Card className="p-6 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <HelpCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Quiz Generator</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create practice questions to test your knowledge</p>
              </div>
            </div>
            {quizQuestions.length === 0 && (
            <Button 
                onClick={generateQuiz}
                disabled={!selectedMaterial || isGeneratingQuiz || materials.length === 0}
                className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
              >
                {isGeneratingQuiz ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
              <Upload className="w-4 h-4 mr-2" />
              Generate Quiz
                  </>
                )}
            </Button>
            )}
          </div>

          {/* History Sidebar and Mastery Chart */}
          {quizQuestions.length === 0 && !quizResults && (
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 mb-6">
              {/* Quiz History Sidebar */}
              <Card className="p-4 bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                    <History className="w-4 h-4 mr-2" />
                    Quiz History
                  </h4>
                  <Badge variant="secondary">{quizHistory.length}</Badge>
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {quizHistory.length > 0 ? (
                    quizHistory.map((attempt: any, index: number) => (
                      <div
                        key={attempt.id}
                        className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                            Attempt #{quizHistory.length - index}
                          </span>
                          <Badge
                            className={
                              attempt.score_percentage >= 80
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : attempt.score_percentage >= 60
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }
                          >
                            {attempt.score_percentage}%
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          {attempt.correct_answers}/{attempt.total_questions} correct
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(attempt.completed_at).toLocaleDateString()} at{' '}
                          {new Date(attempt.completed_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                      No quiz attempts yet. Complete a quiz to track your progress!
                    </div>
                  )}
                </div>
              </Card>

              {/* Mastery Progress Chart */}
              <Card className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Mastery Progress
                  </h4>
                  {masteryData[selectedMaterial]?.length > 1 && (
                    <Badge variant="secondary">
                      {masteryData[selectedMaterial][masteryData[selectedMaterial].length - 1].score -
                        masteryData[selectedMaterial][0].score >= 0
                        ? '↑'
                        : '↓'}{' '}
                      {Math.abs(
                        masteryData[selectedMaterial][masteryData[selectedMaterial].length - 1].score -
                          masteryData[selectedMaterial][0].score
                      ).toFixed(0)}
                      %
                    </Badge>
                  )}
                </div>

                {masteryData[selectedMaterial]?.length > 0 ? (
                  <div className="relative h-48">
                    {/* Chart */}
                    <div className="absolute inset-0 flex items-end justify-around px-2">
                      {masteryData[selectedMaterial].map((data: any, index: number) => {
                        const height = data.score;
                        const color =
                          height >= 80
                            ? 'bg-green-500'
                            : height >= 60
                            ? 'bg-yellow-500'
                            : 'bg-red-500';

                        return (
                          <div key={index} className="flex-1 flex flex-col items-center group px-1">
                            <div
                              className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap"
                            >
                              {height.toFixed(0)}%
                            </div>

                            <div
                              className="w-full relative"
                              style={{ height: '150px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
                            >
                              <div
                                className={`${color} rounded-t transition-all duration-300 hover:opacity-80 w-full`}
                                style={{ height: `${height}%` }}
                              />
                            </div>

                            <div className="mt-2 text-center">
                              <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                #{data.attempt}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                    Complete quizzes to see your progress
                  </div>
                )}
              </Card>
            </div>
          )}

          {quizQuestions.length === 0 ? (
          <div className="text-center py-12">
            <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                {materials.length === 0 ? 'No Quiz Available' : 'Ready to Test Your Knowledge?'}
            </h4>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
                {materials.length === 0 
                  ? 'No materials available. Ask your professor to upload study materials first.'
                  : 'Select a material and click "Generate Quiz" to create practice questions!'}
              </p>
            </div>
          ) : quizResults ? (
            <div className="space-y-6">
              {/* Results Display */}
              <div className="text-center py-8 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900 dark:to-blue-900 rounded-xl border-2 border-purple-200 dark:border-purple-700">
                <div className="mb-4">
                  <div className={`text-6xl font-bold ${
                    quizResults.percentage >= 80 
                      ? 'text-green-600 dark:text-green-400' 
                      : quizResults.percentage >= 60
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {quizResults.percentage}%
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mt-2">
                    {quizResults.score} out of {quizResults.total} correct
                  </p>
                </div>
              </div>

              {/* Question Review */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Review Your Answers</h4>
                {quizQuestions.map((question: any, index: number) => {
                  const result = getAnswerStatus(question.id);
                  const isCorrect = result?.is_correct;
                  const userAnswer = selectedAnswers[question.id];
                  
                  return (
                    <Card key={question.id} className={`p-5 ${isCorrect ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'} border-2`}>
                      <div className="flex items-start space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${isCorrect ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                          {isCorrect ? <Check className="w-5 h-5 text-green-600 dark:text-green-400" /> : <X className="w-5 h-5 text-red-600 dark:text-red-400" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 dark:text-white mb-3">
                            Question {index + 1}: {question.question}
                          </p>
                          <div className="space-y-2">
                            {question.options.map((option: string, optIndex: number) => (
                              <div
                                key={optIndex}
                                className={`p-3 rounded-lg border-2 ${
                                  optIndex === result?.correct_answer
                                    ? 'bg-green-100 dark:bg-green-900 border-green-400 dark:border-green-600 text-green-900 dark:text-green-100'
                                    : optIndex === userAnswer && !isCorrect
                                    ? 'bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-600 text-red-900 dark:text-red-100'
                                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                {optIndex === result?.correct_answer && '✓ '}
                                {optIndex === userAnswer && !isCorrect && '✗ '}
                                <strong>{String.fromCharCode(65 + optIndex)}. </strong>{option}
                              </div>
                            ))}
                          </div>
                          {question.explanation && (
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                              <strong>Explanation:</strong> {question.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Generate New Quiz Button */}
              <div className="text-center">
                <Button
                  onClick={generateQuiz}
                  disabled={isGeneratingQuiz || materials.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                  size="lg"
                >
                  {isGeneratingQuiz ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Generating New Quiz...
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5 mr-2" />
                      Generate New Quiz
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Question Counter */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Question {currentQuestionIndex + 1} of {quizQuestions.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {Object.keys(selectedAnswers).length} of {quizQuestions.length} answered
                </p>
              </div>

              {/* Current Question */}
              {(() => {
                const currentQuestion = getCurrentQuestion();
                if (!currentQuestion) return null;

                return (
                  <Card className="p-6 border-2 border-purple-200 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20">
                    <div className="mb-4">
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                        {currentQuestion.question}
                      </h4>
                      <div className="space-y-3">
                        {currentQuestion.options.map((option: string, index: number) => (
                          <button
                            key={index}
                            onClick={() => handleAnswerSelect(currentQuestion.id, index)}
                            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                              selectedAnswers[currentQuestion.id] === index
                                ? 'border-purple-500 bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-purple-300 dark:hover:border-purple-600'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                selectedAnswers[currentQuestion.id] === index
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-400 dark:border-gray-500'
                              }`}>
                                {selectedAnswers[currentQuestion.id] === index && (
                                  <div className="w-3 h-3 rounded-full bg-white"></div>
            )}
          </div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {String.fromCharCode(65 + index)}. {option}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })()}

              {/* Navigation and Submit */}
              <div className="flex items-center justify-between space-x-3">
                <Button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestionIndex === 0}
                  variant="outline"
                  size="lg"
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ChevronLeft className="w-5 h-5 mr-2" />
                  Previous
                </Button>

                {isAllQuestionsAnswered() && (
                  <Button
                    onClick={submitQuiz}
                    disabled={isSubmittingQuiz}
                    className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600"
                    size="lg"
                  >
                    {isSubmittingQuiz ? (
                      <>
                        <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Quiz
                        <Send className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={handleNextQuestion}
                  disabled={currentQuestionIndex === quizQuestions.length - 1}
                  variant="outline"
                  size="lg"
                  className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Next
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Quiz Progress</span>
                  <span>{Math.round(((currentQuestionIndex + 1) / quizQuestions.length) * 100)}%</span>
                </div>
                <div className="flex space-x-1.5 justify-center">
                  {quizQuestions.map((_, index) => (
                    <div
                      key={index}
                      className={`h-2.5 flex-1 max-w-12 rounded-full transition-all ${
                        index === currentQuestionIndex
                          ? 'bg-purple-600 dark:bg-purple-500'
                          : index < currentQuestionIndex
                          ? 'bg-purple-400 dark:bg-purple-700'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}