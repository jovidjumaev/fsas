'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createLogger } from '../../lib/logger';
const logger = createLogger('ai-assistant-simple');
import { 
  MessageCircle, 
  BookOpen, 
  HelpCircle, 
  Send, 
  Upload, 
  RefreshCw,
  Brain,
  FileText
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

  logger.log('🎓 StudentAIAssistant component rendered for class:', classId, 'student:', studentId);

  // Load materials on component mount
  useEffect(() => {
    loadMaterials();
  }, [classId, studentId]);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      logger.log('📚 Loading materials for class:', classId);
      
      const response = await fetch(`/api/students/${studentId}/classes/${classId}/materials`);
      const data = await response.json();
      
      logger.log('📚 Materials response:', data);
      
      if (data.success) {
        setMaterials(data.materials);
        if (data.materials.length > 0) {
          setSelectedMaterial(data.materials[0].id);
        }
      } else {
        logger.error('❌ Failed to load materials:', data.error);
      }
    } catch (error) {
      logger.error('❌ Error loading materials:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    // Add user message to UI immediately
    const newUserMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newUserMessage]);

    // Add a simple AI response for testing
    setTimeout(() => {
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I received your message: "${userMessage}". This is a test response from the AI Assistant!`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-medium">Study Material:</span>
            <select 
              value={selectedMaterial} 
              onChange={(e) => setSelectedMaterial(e.target.value)}
              className="px-3 py-1 border rounded-md"
            >
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.file_name}
                </option>
              ))}
            </select>
          </div>
          <Badge variant="outline" className="text-xs">
            {materials.length} materials available
          </Badge>
        </div>
      </Card>

      {/* Simple Chat Interface */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Brain className="w-5 h-5 text-blue-600" />
            <span>AI Study Assistant</span>
          </h3>
          <Button onClick={loadMaterials} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Chat Messages */}
        <div className="h-64 overflow-y-auto border rounded-lg p-4 mb-4 bg-gray-50 dark:bg-gray-800">
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

      {/* Simple Flashcards Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <BookOpen className="w-5 h-5 text-green-600" />
            <span>Study Flashcards</span>
          </h3>
          <Button 
            disabled={!selectedMaterial || isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Generate Flashcards
          </Button>
        </div>
        
        <div className="text-center py-8">
          <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
            Flashcards Coming Soon
          </h4>
          <p className="text-gray-500 dark:text-gray-500">
            Select a material and click "Generate Flashcards" to create study cards!
          </p>
        </div>
      </Card>

      {/* Simple Quiz Section */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-purple-600" />
            <span>Quiz Generator</span>
          </h3>
          <Button 
            disabled={!selectedMaterial || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Generate Quiz
          </Button>
        </div>
        
        <div className="text-center py-8">
          <HelpCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h4 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
            Quiz Generator Coming Soon
          </h4>
          <p className="text-gray-500 dark:text-gray-500">
            Select a material and click "Generate Quiz" to create practice questions!
          </p>
        </div>
      </Card>
    </div>
  );
}
