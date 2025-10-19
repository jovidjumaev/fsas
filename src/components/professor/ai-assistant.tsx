'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, MessageCircle, FileText, Trash2, Send, Bot, User } from 'lucide-react';
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

interface AIAssistantProps {
  classId: string;
  professorId: string;
}

export function AIAssistant({ classId, professorId }: AIAssistantProps) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load materials and create session on component mount
  useEffect(() => {
    loadMaterials();
    createChatSession();
  }, [classId]);

  const loadMaterials = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/classes/${classId}/materials?professorId=${professorId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setMaterials(data.materials);
      } else {
        toast.error('Failed to load materials');
      }
    } catch (error) {
      console.error('Error loading materials:', error);
      toast.error('Error loading materials');
    }
  };

  const createChatSession = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/classes/${classId}/chat/session`,
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
    } catch (error) {
      console.error('Error creating chat session:', error);
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
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('professorId', professorId);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/classes/${classId}/materials/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const data = await response.json();
      
      if (data.success) {
        toast.success('File uploaded successfully');
        loadMaterials(); // Reload materials
      } else {
        toast.error(data.error || 'Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Error uploading file');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !sessionId) return;

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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/classes/${classId}/chat/message`,
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
      toast.error('Error sending message');
      // Remove the user message if sending failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/classes/${classId}/materials/${materialId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ professorId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('File deleted successfully');
        loadMaterials(); // Reload materials list
      } else {
        toast.error(data.error || 'Failed to delete file');
      }
    } catch (error) {
      console.error('Error deleting material:', error);
      toast.error('Failed to delete file');
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

  return (
    <div className="space-y-6">
      {/* Materials Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Class Materials
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
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

          {/* Materials List */}
          {materials.length > 0 ? (
            <div className="space-y-2">
              {materials.map((material) => (
                <div
                  key={material.id}
                  className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 dark:bg-gray-800/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getFileIcon(material.file_type)}</span>
                    <div>
                      <p className="font-medium text-sm dark:text-gray-200">{material.file_name}</p>
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
            <p className="text-gray-500 dark:text-gray-400 text-sm">No materials uploaded yet.</p>
          )}
        </CardContent>
      </Card>

      {/* Chat Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            AI Assistant
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto border rounded-lg p-4 space-y-4">
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
                      className={`w-8 h-8 rounded-full flex items-center justify-center ${
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
                      className={`p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                        {message.tokens_used && (
                          <p className="text-xs opacity-50">
                            {message.tokens_used} tokens
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation with the AI assistant</p>
                <p className="text-sm">Ask questions about your uploaded materials</p>
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-gray-600" />
                  </div>
                  <div className="bg-gray-100 p-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Token Usage Display */}
          {totalTokensUsed > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Total tokens used this session: {totalTokensUsed}
            </div>
          )}

          {/* Message Input */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask a concise question about your materials..."
                disabled={isLoading}
                className="flex-1"
                maxLength={200} // Limit input length
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || inputMessage.length > 200}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 text-right">
              {inputMessage.length}/200 characters
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
