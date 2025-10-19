# 🤖 AI Assistant Integration

This document describes the minimal AI Assistant integration for the FSAS (Furman Student Attendance System).

## 🎯 What This Adds

### For Professors:
- **File Upload**: Upload PDF, TXT, and DOCX files for each class
- **AI Chat**: Ask questions about uploaded materials
- **Context-Aware Responses**: AI understands your class materials

### Features:
- ✅ Secure file upload to Supabase Storage
- ✅ Text extraction from PDF, DOCX, and TXT files
- ✅ OpenAI GPT-4 integration with context
- ✅ Chat history persistence
- ✅ File management interface

## 🚀 Quick Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Migration**:
   - Run the SQL in `database/ai-assistant-schema.sql` in your Supabase dashboard

3. **Storage Setup**:
   - Create a storage bucket named `class-materials` in Supabase
   - Set it to public for file access

4. **Environment Variables**:
   Add to your `.env.local`:
   ```bash
   OPENAI_API_KEY=sk-your-openai-api-key-here
   OPENAI_RATE_LIMIT_PER_HOUR=50
   OPENAI_RATE_LIMIT_PER_DAY=1000
   ```

5. **Start Development**:
   ```bash
   npm run dev
   ```

## 📁 File Structure

```
backend/
  └── ai-assistant-api.js          # AI endpoints and file processing

src/
  ├── components/professor/
  │   └── ai-assistant.tsx         # Main AI Assistant component
  └── components/ui/
      └── badge.tsx                # Badge component for file status

database/
  └── ai-assistant-schema.sql     # Database tables for AI features
```

## 🔧 API Endpoints

- `POST /api/classes/:classId/materials/upload` - Upload files
- `GET /api/classes/:classId/materials` - Get uploaded files
- `POST /api/classes/:classId/chat/session` - Create chat session
- `POST /api/classes/:classId/chat/message` - Send message to AI
- `GET /api/classes/:classId/chat/session/:sessionId/messages` - Get chat history

## 🛡️ Security Features

- **API Key Protection**: OpenAI API key never exposed to frontend
- **Access Control**: Only professors can access their class materials
- **File Validation**: Only PDF, TXT, DOCX files allowed
- **Size Limits**: 50MB maximum file size
- **Rate Limiting**: Configurable OpenAI API rate limits

## 📊 Database Tables

### `class_materials`
- Stores uploaded file metadata
- Extracted text content
- Processing status

### `professor_chat_sessions`
- Chat session management
- Links to specific classes

### `professor_chat_messages`
- Individual chat messages
- Token usage tracking

## 🎨 UI Components

The AI Assistant appears as a new tab in the professor's class management page:

1. **Materials Section**: File upload and management
2. **Chat Section**: AI conversation interface

## 🔄 How It Works

1. **File Upload**: Professor uploads files → Text extraction → Storage in database
2. **Chat**: Professor asks questions → AI gets context from materials → Response with context
3. **History**: All conversations are saved and can be retrieved

## 🚧 Future Enhancements

This is the minimal implementation. Future versions could include:
- Student access to materials and AI chat
- Flashcard generation
- Quiz creation
- Progress tracking
- Advanced analytics

## 🐛 Troubleshooting

### Common Issues:

1. **File Upload Fails**:
   - Check Supabase Storage bucket exists
   - Verify file type is PDF/TXT/DOCX
   - Check file size < 50MB

2. **AI Responses Fail**:
   - Verify OpenAI API key is correct
   - Check rate limits
   - Ensure materials are processed

3. **Database Errors**:
   - Run the migration SQL
   - Check RLS policies are enabled

## 📝 Notes

- This is a minimal implementation focused on professor use
- All AI processing happens server-side for security
- Files are stored in Supabase Storage with public URLs
- Chat history is persistent per session
