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
  TrendingUp
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

  console.log('🎓 StudentAIAssistant component rendered for class:', classId, 'student:', studentId);

  // Load materials on component mount
  useEffect(() => {
    loadMaterials();
    createChatSession();
  }, [classId, studentId]);

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
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
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
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Study Flashcards</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Generate flashcards from your class materials</p>
              </div>
            </div>
            <Button 
              disabled={!selectedMaterial || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Generate Flashcards
            </Button>
          </div>
          
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              Flashcards Coming Soon
            </h4>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              Select a material and click "Generate Flashcards" to create study cards!
            </p>
            {materials.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-600">
                No materials available. Ask your professor to upload study materials first.
              </p>
            )}
          </div>
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
            <Button 
              disabled={!selectedMaterial || isLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Generate Quiz
            </Button>
          </div>
          
          <div className="text-center py-12">
            <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              Quiz Generator Coming Soon
            </h4>
            <p className="text-gray-500 dark:text-gray-500 mb-4">
              Select a material and click "Generate Quiz" to create practice questions!
            </p>
            {materials.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-600">
                No materials available. Ask your professor to upload study materials first.
              </p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}