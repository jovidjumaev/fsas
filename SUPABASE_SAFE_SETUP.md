# 🎓 Student AI Assistant - Safe Supabase Setup (Handles Existing Objects)

## 🚀 **Safe Database Migration**

Copy and paste this SQL into Supabase SQL Editor. This version safely handles existing tables and policies:

```sql
-- =====================================================
-- STUDENT AI ASSISTANT SCHEMA (SAFE VERSION)
-- =====================================================
-- This version safely handles existing tables and policies

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

-- Create indexes (ignore if they exist)
DO $$ 
BEGIN
    -- Chat sessions indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_chat_sessions_student') THEN
        CREATE INDEX idx_student_chat_sessions_student ON student_chat_sessions(student_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_chat_sessions_class') THEN
        CREATE INDEX idx_student_chat_sessions_class ON student_chat_sessions(class_instance_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_chat_messages_session') THEN
        CREATE INDEX idx_student_chat_messages_session ON student_chat_messages(session_id);
    END IF;
    
    -- Flashcards indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_flashcards_student') THEN
        CREATE INDEX idx_student_flashcards_student ON student_flashcards(student_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_flashcards_class') THEN
        CREATE INDEX idx_student_flashcards_class ON student_flashcards(class_instance_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_flashcards_material') THEN
        CREATE INDEX idx_student_flashcards_material ON student_flashcards(material_id);
    END IF;
    
    -- Quiz indexes
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_quiz_questions_student') THEN
        CREATE INDEX idx_student_quiz_questions_student ON student_quiz_questions(student_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_quiz_questions_class') THEN
        CREATE INDEX idx_student_quiz_questions_class ON student_quiz_questions(class_instance_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_quiz_questions_material') THEN
        CREATE INDEX idx_student_quiz_questions_material ON student_quiz_questions(material_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_student_quiz_sessions_student') THEN
        CREATE INDEX idx_student_quiz_sessions_student ON student_quiz_sessions(student_id);
    END IF;
END $$;

-- Enable RLS (ignore if already enabled)
DO $$ 
BEGIN
    ALTER TABLE student_chat_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE student_chat_messages ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE student_flashcards ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE student_quiz_questions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    ALTER TABLE student_quiz_sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Create policies (drop and recreate to avoid conflicts)
DROP POLICY IF EXISTS "Students can manage their own chat sessions" ON student_chat_sessions;
DROP POLICY IF EXISTS "Students can manage their own chat messages" ON student_chat_messages;
DROP POLICY IF EXISTS "Students can manage their own flashcards" ON student_flashcards;
DROP POLICY IF EXISTS "Students can manage their own quiz questions" ON student_quiz_questions;
DROP POLICY IF EXISTS "Students can manage their own quiz sessions" ON student_quiz_sessions;

-- Create the policies
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

-- Grant permissions (ignore if already granted)
DO $$ 
BEGIN
    GRANT ALL ON student_chat_sessions TO authenticated;
    GRANT ALL ON student_chat_messages TO authenticated;
    GRANT ALL ON student_flashcards TO authenticated;
    GRANT ALL ON student_quiz_questions TO authenticated;
    GRANT ALL ON student_quiz_sessions TO authenticated;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
```

## ✅ **What This Safe Version Does**

1. **Creates tables** only if they don't exist (`CREATE TABLE IF NOT EXISTS`)
2. **Creates indexes** only if they don't exist (using conditional logic)
3. **Enables RLS** safely (ignores errors if already enabled)
4. **Drops and recreates policies** to avoid conflicts
5. **Grants permissions** safely (ignores errors if already granted)

## 🎯 **After Running This SQL**

1. **Restart your development server**: `npm run dev`
2. **Navigate to a student class detail page**
3. **Look for the "AI Assistant" tab** with the brain icon 🧠
4. **Click on it** to access Chat, Flashcards, and Quiz tools

This should resolve the policy conflict error and successfully set up all the required database objects!
