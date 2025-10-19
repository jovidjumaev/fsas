'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  MessageCircle, 
  BookOpen, 
  HelpCircle, 
  Send, 
  Upload, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Brain,
  FileText,
  Users,
  Calendar,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';

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

interface Flashcard {
  id: string;
  front_text: string;
  back_text: string;
  difficulty_level: number;
  times_studied: number;
  correct_answers: number;
  last_studied?: string;
  class_materials: {
    file_name: string;
  };
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
  quiz_session_id: string;
  question_order: number;
}

interface QuizSession {
  id: string;
  total_questions: number;
  correct_answers: number;
  score_percentage: number;
  is_completed: boolean;
  created_at: string;
  class_materials: {
    file_name: string;
  };
  student_quiz_questions: QuizQuestion[];
}

interface StudentAIAssistantProps {
  classId: string;
  studentId: string;
}

export function StudentAIAssistant({ classId, studentId }: StudentAIAssistantProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Chat state
  const [chatSessionId, setChatSessionId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  
  // Flashcards state
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isGeneratingCards, setIsGeneratingCards] = useState(false);
  
  // Quiz state
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [currentQuiz, setCurrentQuiz] = useState<QuizSession | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [quizResults, setQuizResults] = useState<any>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Load materials on component mount
  useEffect(() => {
    loadMaterials();
  }, [classId, studentId]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/materials`);
      const data = await response.json();
      
      if (data.success) {
        setMaterials(data.materials);
        if (data.materials.length > 0) {
          setSelectedMaterial(data.materials[0].id);
        }
      } else {
        toast.error(data.error || 'Failed to load materials');
      }
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Failed to load materials');
    } finally {
      setIsLoading(false);
    }
  };

  const createChatSession = async () => {
    try {
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/chat/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionName: 'Study Session'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setChatSessionId(data.session.id);
        setMessages([]);
        setTotalTokensUsed(0);
        toast.success('New chat session created');
      } else {
        toast.error(data.error || 'Failed to create chat session');
      }
    } catch (error) {
      console.error('Error creating chat session:', error);
      toast.error('Failed to create chat session');
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !chatSessionId) {
      if (!chatSessionId) {
        await createChatSession();
        return;
      }
      return;
    }

    const userMessage = inputMessage.trim();
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
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const generateFlashcards = async () => {
    if (!selectedMaterial) {
      toast.error('Please select a material first');
      return;
    }

    setIsGeneratingCards(true);
    try {
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/flashcards/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          count: 5
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setFlashcards(data.flashcards);
        setCurrentCardIndex(0);
        setShowAnswer(false);
        toast.success(`Generated ${data.flashcards.length} flashcards!`);
      } else {
        toast.error(data.error || 'Failed to generate flashcards');
      }
    } catch (error) {
      console.error('Error generating flashcards:', error);
      toast.error('Failed to generate flashcards');
    } finally {
      setIsGeneratingCards(false);
    }
  };

  const generateQuiz = async () => {
    if (!selectedMaterial) {
      toast.error('Please select a material first');
      return;
    }

    setIsGeneratingQuiz(true);
    try {
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/quiz/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          materialId: selectedMaterial,
          count: 5
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentQuiz(data.quiz_session);
        setCurrentQuestionIndex(0);
        setSelectedAnswers({});
        setQuizResults(null);
        toast.success(`Generated ${data.questions.length} quiz questions!`);
      } else {
        toast.error(data.error || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error('Failed to generate quiz');
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const submitQuiz = async () => {
    if (!currentQuiz) return;

    try {
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/ai/quiz/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quizSessionId: currentQuiz.id,
          answers: selectedAnswers
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setQuizResults(data);
        toast.success(`Quiz completed! Score: ${data.percentage}%`);
      } else {
        toast.error(data.error || 'Failed to submit quiz');
      }
    } catch (error) {
      console.error('Error submitting quiz:', error);
      toast.error('Failed to submit quiz');
    }
  };

  const nextCard = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1);
      setShowAnswer(false);
    }
  };

  const prevCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1);
      setShowAnswer(false);
    }
  };

  const nextQuestion = () => {
    if (currentQuiz && currentQuestionIndex < currentQuiz.student_quiz_questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const prevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const getSelectedMaterialName = () => {
    const material = materials.find(m => m.id === selectedMaterial);
    return material ? material.file_name : 'Select Material';
  };

  return (
    <div className="space-y-6">
      {/* Material Selection */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Study Material:</span>
            <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select Material" />
              </SelectTrigger>
              <SelectContent>
                {materials.map((material) => (
                  <SelectItem key={material.id} value={material.id}>
                    {material.file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Badge variant="outline" className="text-xs">
            {materials.length} materials available
          </Badge>
        </div>
      </Card>

      {/* AI Assistant Tabs */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" className="flex items-center space-x-2">
            <MessageCircle className="w-4 h-4" />
            <span>AI Chat</span>
          </TabsTrigger>
          <TabsTrigger value="flashcards" className="flex items-center space-x-2">
            <BookOpen className="w-4 h-4" />
            <span>Flashcards</span>
          </TabsTrigger>
          <TabsTrigger value="quiz" className="flex items-center space-x-2">
            <HelpCircle className="w-4 h-4" />
            <span>Quiz</span>
          </TabsTrigger>
        </TabsList>

        {/* AI Chat Tab */}
        <TabsContent value="chat" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <Brain className="w-5 h-5 text-blue-600" />
                <span>AI Study Assistant</span>
              </h3>
              <div className="flex items-center space-x-2">
                {totalTokensUsed > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {totalTokensUsed} tokens used
                  </Badge>
                )}
                <Button onClick={createChatSession} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Session
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="h-96 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-800">
              {messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                  <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Start a conversation with your AI study assistant!</p>
                  <p className="text-sm mt-2">Ask about class materials, attendance, or study topics.</p>
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
                            : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                          <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                          {message.tokens_used && (
                            <span>{message.tokens_used} tokens</span>
                          )}
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
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                disabled={isLoading}
                maxLength={200}
              />
              <Button 
                onClick={handleSendMessage} 
                disabled={!inputMessage.trim() || isLoading}
                className="px-6"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {inputMessage.length}/200 characters
            </p>
          </Card>
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                <span>Study Flashcards</span>
              </h3>
              <Button 
                onClick={generateFlashcards} 
                disabled={!selectedMaterial || isGeneratingCards}
                className="bg-green-600 hover:bg-green-700"
              >
                {isGeneratingCards ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Generate Flashcards
              </Button>
            </div>

            {flashcards.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  No flashcards yet
                </h4>
                <p className="text-gray-500 dark:text-gray-500 mb-4">
                  Generate flashcards from your class materials to start studying!
                </p>
                <p className="text-sm text-gray-400">
                  Selected material: <span className="font-medium">{getSelectedMaterialName()}</span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Flashcard Display */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 min-h-[300px] flex flex-col justify-center">
                  <div className="text-center">
                    <div className="mb-4">
                      <Badge variant="outline" className="text-xs">
                        Card {currentCardIndex + 1} of {flashcards.length}
                      </Badge>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
                      <h4 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">
                        {showAnswer ? 'Answer' : 'Question'}
                      </h4>
                      <p className="text-lg leading-relaxed">
                        {showAnswer ? flashcards[currentCardIndex].back_text : flashcards[currentCardIndex].front_text}
                      </p>
                    </div>
                    
                    <div className="mt-6 space-x-2">
                      <Button
                        onClick={() => setShowAnswer(!showAnswer)}
                        variant="outline"
                        className="bg-white dark:bg-gray-800"
                      >
                        {showAnswer ? 'Show Question' : 'Show Answer'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                  <Button
                    onClick={prevCard}
                    disabled={currentCardIndex === 0}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setCurrentCardIndex(0)}
                      disabled={currentCardIndex === 0}
                      variant="outline"
                      size="sm"
                    >
                      First
                    </Button>
                    <Button
                      onClick={() => setCurrentCardIndex(flashcards.length - 1)}
                      disabled={currentCardIndex === flashcards.length - 1}
                      variant="outline"
                      size="sm"
                    >
                      Last
                    </Button>
                  </div>
                  
                  <Button
                    onClick={nextCard}
                    disabled={currentCardIndex === flashcards.length - 1}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Quiz Tab */}
        <TabsContent value="quiz" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-purple-600" />
                <span>Quiz Generator</span>
              </h3>
              <Button 
                onClick={generateQuiz} 
                disabled={!selectedMaterial || isGeneratingQuiz}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isGeneratingQuiz ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Generate Quiz
              </Button>
            </div>

            {!currentQuiz ? (
              <div className="text-center py-12">
                <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                  No quiz available
                </h4>
                <p className="text-gray-500 dark:text-gray-500 mb-4">
                  Generate a quiz from your class materials to test your knowledge!
                </p>
                <p className="text-sm text-gray-400">
                  Selected material: <span className="font-medium">{getSelectedMaterialName()}</span>
                </p>
              </div>
            ) : quizResults ? (
              <div className="text-center py-8">
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-600" />
                  <h4 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">
                    Quiz Completed!
                  </h4>
                  <p className="text-lg text-green-600 dark:text-green-300 mb-4">
                    Score: {quizResults.score}/{quizResults.total} ({quizResults.percentage}%)
                  </p>
                  <Button 
                    onClick={() => {
                      setQuizResults(null);
                      setCurrentQuiz(null);
                      setCurrentQuestionIndex(0);
                      setSelectedAnswers({});
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Take Another Quiz
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quiz Question */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-6">
                  <div className="mb-4">
                    <Badge variant="outline" className="text-xs">
                      Question {currentQuestionIndex + 1} of {currentQuiz.student_quiz_questions.length}
                    </Badge>
                  </div>
                  
                  <h4 className="text-lg font-medium mb-4 text-gray-700 dark:text-gray-300">
                    {currentQuiz.student_quiz_questions[currentQuestionIndex].question}
                  </h4>
                  
                  <div className="space-y-2">
                    {currentQuiz.student_quiz_questions[currentQuestionIndex].options.map((option, index) => (
                      <label
                        key={index}
                        className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                          selectedAnswers[currentQuiz.student_quiz_questions[currentQuestionIndex].id] === index
                            ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${currentQuiz.student_quiz_questions[currentQuestionIndex].id}`}
                          value={index}
                          checked={selectedAnswers[currentQuiz.student_quiz_questions[currentQuestionIndex].id] === index}
                          onChange={() => {
                            setSelectedAnswers(prev => ({
                              ...prev,
                              [currentQuiz.student_quiz_questions[currentQuestionIndex].id]: index
                            }));
                          }}
                          className="mr-3"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{option}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex justify-between items-center">
                  <Button
                    onClick={prevQuestion}
                    disabled={currentQuestionIndex === 0}
                    variant="outline"
                  >
                    Previous
                  </Button>
                  
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => setCurrentQuestionIndex(0)}
                      disabled={currentQuestionIndex === 0}
                      variant="outline"
                      size="sm"
                    >
                      First
                    </Button>
                    <Button
                      onClick={() => setCurrentQuestionIndex(currentQuiz.student_quiz_questions.length - 1)}
                      disabled={currentQuestionIndex === currentQuiz.student_quiz_questions.length - 1}
                      variant="outline"
                      size="sm"
                    >
                      Last
                    </Button>
                  </div>
                  
                  <Button
                    onClick={nextQuestion}
                    disabled={currentQuestionIndex === currentQuiz.student_quiz_questions.length - 1}
                    variant="outline"
                  >
                    Next
                  </Button>
                </div>

                {/* Submit Button */}
                <div className="text-center pt-4">
                  <Button 
                    onClick={submitQuiz}
                    className="bg-purple-600 hover:bg-purple-700 px-8"
                    disabled={Object.keys(selectedAnswers).length !== currentQuiz.student_quiz_questions.length}
                  >
                    Submit Quiz
                  </Button>
                  <p className="text-sm text-gray-500 mt-2">
                    {Object.keys(selectedAnswers).length} / {currentQuiz.student_quiz_questions.length} questions answered
                  </p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
