-- =====================================================
-- AI ASSISTANT MINIMAL SCHEMA
-- =====================================================
-- Simple schema for professor file upload and chatbot

-- File materials table
CREATE TABLE IF NOT EXISTS class_materials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    professor_id UUID NOT NULL REFERENCES professors(user_id) ON DELETE CASCADE,
    
    -- File details
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100) NOT NULL, -- 'pdf', 'txt', 'docx', 'pptx', 'ppt'
    file_size BIGINT NOT NULL,
    file_url TEXT NOT NULL, -- Supabase Storage URL
    
    -- Simple processing
    extracted_text TEXT, -- Extracted text content
    is_processed BOOLEAN DEFAULT false,
    processing_error TEXT, -- Error message if processing failed
    
    -- Metadata
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Simple chat sessions for professors
CREATE TABLE IF NOT EXISTS professor_chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    professor_id UUID NOT NULL REFERENCES professors(user_id) ON DELETE CASCADE,
    class_instance_id UUID NOT NULL REFERENCES class_instances(id) ON DELETE CASCADE,
    
    -- Session details
    session_name VARCHAR(200) DEFAULT 'Chat Session',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Chat messages
CREATE TABLE IF NOT EXISTS professor_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES professor_chat_sessions(id) ON DELETE CASCADE,
    
    -- Message details
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Simple metadata
    tokens_used INTEGER DEFAULT 0,
    model_used VARCHAR(50) DEFAULT 'gpt-4'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_class_materials_class_instance ON class_materials(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_class_materials_professor ON class_materials(professor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_professor ON professor_chat_sessions(professor_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_class ON professor_chat_sessions(class_instance_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON professor_chat_messages(session_id);

-- RLS Policies for security
ALTER TABLE class_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_chat_messages ENABLE ROW LEVEL SECURITY;

-- Professor can only access their own materials and chats
CREATE POLICY "Professors can manage their own materials" ON class_materials
    FOR ALL USING (professor_id = auth.uid());

CREATE POLICY "Professors can manage their own chat sessions" ON professor_chat_sessions
    FOR ALL USING (professor_id = auth.uid());

CREATE POLICY "Professors can manage their own chat messages" ON professor_chat_messages
    FOR ALL USING (
        session_id IN (
            SELECT id FROM professor_chat_sessions 
            WHERE professor_id = auth.uid()
        )
    );
