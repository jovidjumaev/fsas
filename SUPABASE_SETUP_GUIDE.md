# 🎓 Student AI Assistant - Supabase Setup Guide

## 🚀 **Quick Setup Steps**

### **1. Open Supabase Dashboard**
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **"New Query"**

### **2. Run the Database Migration**
Copy and paste the following SQL into the SQL Editor and run it:

```sql
-- =====================================================
-- STUDENT AI ASSISTANT SCHEMA
-- =====================================================
-- Extended schema for student AI features (chat, flashcards, quiz)

-- Student AI chat sessions
CREATE TABLE IF NOT EXISTS student_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    
    -- Session details
    session_name VARCHAR(200) DEFAULT 'Study Session',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Student AI chat messages
CREATE TABLE IF NOT EXISTS student_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES student_chat_sessions(id) ON DELETE CASCADE,
    
    -- Message details
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- AI metadata
    tokens_used INTEGER DEFAULT 0,
    model_used VARCHAR(50) DEFAULT 'gpt-4'
);

-- Flashcards storage
CREATE TABLE IF NOT EXISTS student_flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES class_materials(id) ON DELETE CASCADE,
    
    -- Flashcard content
    front_text TEXT NOT NULL,
    back_text TEXT NOT NULL,
    difficulty_level INTEGER DEFAULT 1, -- 1-5 scale
    
    -- Study tracking
    times_studied INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    last_studied TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Multiple choice questions storage
CREATE TABLE IF NOT EXISTS student_quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES class_materials(id) ON DELETE CASCADE,
    
    -- Question content
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of options
    correct_answer INTEGER NOT NULL, -- Index of correct option (0-based)
    explanation TEXT,
    
    -- Quiz session tracking
    quiz_session_id UUID, -- For grouping questions
    question_order INTEGER DEFAULT 0,
    
    -- Performance tracking
    times_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0,
    last_answered TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz sessions for tracking complete quizzes
CREATE TABLE IF NOT EXISTS student_quiz_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES class_materials(id) ON DELETE CASCADE,
    
    -- Session details
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER DEFAULT 0,
    score_percentage DECIMAL(5,2) DEFAULT 0.00,
    time_taken_seconds INTEGER DEFAULT 0,
    
    -- Metadata
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT false
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_student_chat_sessions_student ON student_chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_chat_sessions_class ON student_chat_sessions(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_student_chat_messages_session ON student_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_student_flashcards_student ON student_flashcards(student_id);
CREATE INDEX IF NOT EXISTS idx_student_flashcards_class ON student_flashcards(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_student_flashcards_material ON student_flashcards(material_id);
CREATE INDEX IF NOT EXISTS idx_student_quiz_questions_student ON student_quiz_questions(student_id);
CREATE INDEX IF NOT EXISTS idx_student_quiz_questions_class ON student_quiz_questions(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_student_quiz_questions_material ON student_quiz_questions(material_id);
CREATE INDEX IF NOT EXISTS idx_student_quiz_sessions_student ON student_quiz_sessions(student_id);

-- RLS Policies for security
ALTER TABLE student_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_quiz_sessions ENABLE ROW LEVEL SECURITY;

-- Students can only access their own AI data
CREATE POLICY "Students can manage their own chat sessions" ON student_chat_sessions
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Students can manage their own chat messages" ON student_chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT id FROM student_chat_sessions 
            WHERE student_id = auth.uid()
        )
    );

CREATE POLICY "Students can manage their own flashcards" ON student_flashcards
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Students can manage their own quiz questions" ON student_quiz_questions
    FOR ALL USING (student_id = auth.uid());

CREATE POLICY "Students can manage their own quiz sessions" ON student_quiz_sessions
    FOR ALL USING (student_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON student_chat_sessions TO authenticated;
GRANT ALL ON student_chat_messages TO authenticated;
GRANT ALL ON student_flashcards TO authenticated;
GRANT ALL ON student_quiz_questions TO authenticated;
GRANT ALL ON student_quiz_sessions TO authenticated;
```

### **3. Install Missing Dependencies**
Run this command in your terminal:

```bash
npm install @radix-ui/react-select
```

### **4. Restart Your Development Server**
```bash
npm run dev
```

### **5. Test the AI Assistant**
1. Navigate to a student class detail page
2. You should now see the **"AI Assistant"** tab with a brain icon
3. Click on it to access the three study tools

## ✅ **What This Creates**

- **5 new tables** for student AI features
- **Row Level Security** policies for data protection
- **Performance indexes** for optimal queries
- **Student-specific data isolation**

## 🔐 **Security Features**

- Students can only access materials from their enrolled classes
- Students can only see their own AI data
- Enrollment verification on every API call
- No cross-student data access

## 🎯 **Expected Result**

After running the SQL migration, you should see:
- **AI Assistant tab** appears in the student class detail page
- **Three sub-tabs**: Chat, Flashcards, Quiz
- **Material selection** dropdown
- **Interactive study tools**

## 🐛 **If You Still Don't See the Tab**

1. **Check browser console** for any JavaScript errors
2. **Verify the component import** in the page file
3. **Make sure dependencies are installed** (`@radix-ui/react-select`)
4. **Restart your development server**

The AI Assistant tab should appear between "Upcoming Sessions" and the end of the tab list!
