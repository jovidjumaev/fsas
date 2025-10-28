const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const router = express.Router();

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =====================================================
// STUDENT AI ASSISTANT API ENDPOINTS
// =====================================================

/**
 * Get available materials for a student's class
 * GET /api/students/:studentId/classes/:classId/materials
 */
router.get('/api/students/:studentId/classes/:classId/materials', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    
    console.log('📚 Getting materials for student:', studentId, 'class:', classId);
    
    // Verify student is enrolled in this class
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get materials for this class
    const { data: materials, error: materialsError } = await supabase
      .from('class_materials')
      .select(`
        id,
        file_name,
        file_type,
        file_size,
        uploaded_at,
        is_processed
      `)
      .eq('class_instance_id', classId)
      .eq('is_processed', true)
      .order('uploaded_at', { ascending: false });
    
    if (materialsError) {
      console.error('❌ Error fetching materials:', materialsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch materials'
      });
    }
    
    res.json({
      success: true,
      materials: materials || []
    });
    
  } catch (error) {
    console.error('❌ Materials error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create a new chat session for student
 * POST /api/students/:studentId/classes/:classId/ai/chat/session
 */
router.post('/api/students/:studentId/classes/:classId/ai/chat/session', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { sessionName = 'Study Session' } = req.body;
    
    console.log('💬 Creating chat session for student:', studentId);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Create new chat session
    const { data: session, error: sessionError } = await supabase
      .from('student_chat_sessions')
      .insert({
        student_id: studentId,
        class_instance_id: classId,
        session_name: sessionName
      })
      .select()
      .single();
    
    if (sessionError) {
      console.error('❌ Error creating session:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create chat session'
      });
    }
    
    res.json({
      success: true,
      session: session
    });
    
  } catch (error) {
    console.error('❌ Chat session error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Send message to AI assistant
 * POST /api/students/:studentId/classes/:classId/ai/chat/message
 */
router.post('/api/students/:studentId/classes/:classId/ai/chat/message', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { sessionId, message } = req.body;
    
    console.log('💬 Student AI message:', message);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('student_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('student_id', studentId)
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
    }
    
    // Get student profile information
    const { data: studentProfile, error: profileError } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', studentId)
      .single();
    
    let studentName = 'Student';
    if (!profileError && studentProfile) {
      studentName = `${studentProfile.first_name || ''} ${studentProfile.last_name || ''}`.trim() || 'Student';
    }
    
    // Get class materials for context
    const { data: materials, error: materialsError } = await supabase
      .from('class_materials')
      .select('file_name, extracted_text')
      .eq('class_instance_id', classId)
      .eq('is_processed', true);
    
    if (materialsError) {
      console.error('❌ Error fetching materials:', materialsError);
    }
    
    // Get class session IDs first
    const { data: sessionIds, error: sessionIdsError } = await supabase
      .from('class_sessions')
      .select('id')
      .eq('class_instance_id', classId);
    
    if (sessionIdsError) {
      console.error('❌ Error fetching session IDs:', sessionIdsError);
    }
    
    // Get student's attendance data
    let attendanceData = [];
    if (sessionIds && sessionIds.length > 0) {
      const sessionIdList = sessionIds.map(s => s.id);
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select(`
          status,
          scanned_at,
          class_sessions!inner(
            session_number,
            date,
            start_time,
            end_time
          )
        `)
        .eq('student_id', studentId)
        .in('session_id', sessionIdList);
      
      if (attendanceError) {
        console.error('❌ Error fetching attendance:', attendanceError);
      } else {
        attendanceData = attendanceRecords || [];
      }
    }
    
    // Get upcoming sessions
    const { data: upcomingSessions, error: upcomingError } = await supabase
      .from('class_sessions')
      .select('session_number, date, start_time, end_time, room_location')
      .eq('class_instance_id', classId)
      .gte('date', new Date().toISOString().split('T')[0])
      .order('date', { ascending: true })
      .limit(3);
    
    // Build context from materials
    let contextText = '';
    if (materials && materials.length > 0) {
      contextText = materials.map(m => 
        `File: ${m.file_name}\nContent: ${m.extracted_text}`
      ).join('\n\n');
    }
    
    // Build student-specific context
    let studentContext = '';
    if (attendanceData && attendanceData.length > 0) {
      const totalSessions = attendanceData.length;
      const presentSessions = attendanceData.filter(a => a.status === 'present').length;
      const attendancePercentage = Math.round((presentSessions / totalSessions) * 100);
      
      studentContext = `
STUDENT ATTENDANCE DATA:
- Total sessions attended: ${totalSessions}
- Present sessions: ${presentSessions}
- Attendance percentage: ${attendancePercentage}%
- Recent attendance: ${attendanceData.slice(-3).map(a => `Session ${a.class_sessions.session_number}: ${a.status}`).join(', ')}

UPCOMING SESSIONS:
${upcomingSessions ? upcomingSessions.map(s => `- Session ${s.session_number}: ${s.date} at ${s.start_time}`).join('\n') : 'No upcoming sessions'}
`;
    }
    
    // Get recent chat history (last 5 messages)
    const { data: chatHistory, error: historyError } = await supabase
      .from('student_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(5);
    
    // Prepare conversation history
    const conversationHistory = [];
    if (chatHistory && chatHistory.length > 0) {
      conversationHistory.push(...chatHistory.reverse().map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }
    
    // Add current message
    conversationHistory.push({
      role: 'user',
      content: message
    });
    
    // Prepare system message with context
    const systemMessage = {
      role: 'system',
      content: `You are an AI study assistant helping ${studentName} with questions about their class materials and academic information.

STUDENT NAME: ${studentName}

AVAILABLE MATERIALS:
${contextText || 'No materials uploaded yet.'}

${studentContext}

CRITICAL INSTRUCTIONS:
- Address the student by their name: ${studentName}
- Keep responses CONCISE and HELPFUL (max 3-4 sentences)
- Focus on STUDY-RELATED questions about materials, attendance, and class schedule
- Use bullet points for multiple items
- Be encouraging and supportive
- You can answer questions about:
  * Class materials and content (including PowerPoint slide content)
  * Attendance and session information
  * Upcoming class sessions
  * Study tips and explanations
- If question is unrelated to academics, politely redirect to study topics
- Prioritize accuracy and helpfulness
- Use the student's name naturally in responses`
    };
    
    // Call OpenAI with optimized settings
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...conversationHistory],
      max_tokens: 150,
      temperature: 0.3,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });
    
    const aiResponse = completion.choices[0].message.content;
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    console.log('🤖 AI Response tokens:', tokensUsed);
    
    // Save user message
    const { data: userMessage, error: userError } = await supabase
      .from('student_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message,
        tokens_used: 0
      })
      .select()
      .single();
    
    if (userError) {
      console.error('❌ Error saving user message:', userError);
    }
    
    // Save AI response
    const { data: aiMessage, error: aiError } = await supabase
      .from('student_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: aiResponse,
        tokens_used: tokensUsed
      })
      .select()
      .single();
    
    if (aiError) {
      console.error('❌ Error saving AI message:', aiError);
    }
    
    // Update session last activity
    await supabase
      .from('student_chat_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId);
    
    res.json({
      success: true,
      response: aiResponse,
      message: aiMessage,
      tokens_used: tokensUsed
    });
    
  } catch (error) {
    console.error('❌ Chat message error:', error);
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Generate flashcards from material
 * POST /api/students/:studentId/classes/:classId/ai/flashcards/generate
 */
router.post('/api/students/:studentId/classes/:classId/ai/flashcards/generate', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { materialId, count = 5 } = req.body;
    
    console.log('🃏 Generating flashcards for material:', materialId);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get material content
    const { data: material, error: materialError } = await supabase
      .from('class_materials')
      .select('file_name, extracted_text')
      .eq('id', materialId)
      .eq('class_instance_id', classId)
      .eq('is_processed', true)
      .single();
    
    if (materialError || !material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found or not processed'
      });
    }
    
    // Generate flashcards using AI
    const prompt = `You are a study assistant. Create exactly ${count} study flashcards from the following material. Each flashcard should have a clear question on the front and a detailed answer on the back.

Material: ${material.file_name}
Content: ${material.extracted_text.substring(0, 4000)}

Return ONLY a JSON array. No markdown, no code blocks, no explanations. Just the JSON array. Example:
[{"front": "What is the main concept?", "back": "The main concept is..."}, {"front": "Define X", "back": "X is defined as..."}]`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful assistant that returns ONLY valid JSON arrays. No markdown, no explanations, just JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    // Try to parse JSON, handling markdown code blocks
    let flashcards;
    try {
      // Remove markdown code blocks if present
      let jsonText = aiResponse.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }
      
      flashcards = JSON.parse(jsonText);
      
      // Validate flashcards structure
      if (!Array.isArray(flashcards) || flashcards.length === 0) {
        throw new Error('Invalid flashcard format');
      }
      
      // Validate each flashcard has required fields
      flashcards = flashcards.filter(card => card.front && card.back);
      
      if (flashcards.length === 0) {
        throw new Error('No valid flashcards generated');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      console.error('AI Response:', aiResponse);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse flashcard data from AI',
        details: parseError.message
      });
    }
    
    // Save flashcards to database
    const flashcardData = flashcards.map(card => ({
      student_id: studentId,
      class_instance_id: classId,
      material_id: materialId,
      front_text: card.front,
      back_text: card.back
    }));
    
    const { data: savedCards, error: saveError } = await supabase
      .from('student_flashcards')
      .insert(flashcardData)
      .select();
    
    if (saveError) {
      console.error('❌ Error saving flashcards:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save flashcards'
      });
    }
    
    res.json({
      success: true,
      flashcards: savedCards
    });
    
  } catch (error) {
    console.error('❌ Flashcard generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Generate quiz questions from material
 * POST /api/students/:studentId/classes/:classId/ai/quiz/generate
 */
router.post('/api/students/:studentId/classes/:classId/ai/quiz/generate', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { materialId, count = 5 } = req.body;
    
    console.log('📝 Generating quiz questions for material:', materialId);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get material content
    const { data: material, error: materialError } = await supabase
      .from('class_materials')
      .select('file_name, extracted_text')
      .eq('id', materialId)
      .eq('class_instance_id', classId)
      .eq('is_processed', true)
      .single();
    
    if (materialError || !material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found or not processed'
      });
    }
    
    // Generate quiz questions using AI
    const prompt = `You are a quiz creator. Create exactly ${count} multiple choice quiz questions from the following material. Each question must have exactly 4 options with one correct answer (0-indexed).

Material: ${material.file_name}
Content: ${material.extracted_text.substring(0, 4000)}

IMPORTANT: Return ONLY valid JSON array format, no markdown code blocks. Example:
[{"question": "What is X?", "options": ["A", "B", "C", "D"], "correct_answer": 0, "explanation": "X is..."}, {"question": "Define Y", "options": ["E", "F", "G", "H"], "correct_answer": 1, "explanation": "Y is..."}]`;
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { 
          role: 'system', 
          content: 'You are a helpful quiz assistant that returns ONLY valid JSON arrays. No markdown, no explanations, just JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2500,
      temperature: 0.7
    });
    
    const aiResponse = completion.choices[0].message.content;
    
    // Try to parse JSON, handling markdown code blocks
    let questions;
    try {
      // Remove markdown code blocks if present
      let jsonText = aiResponse.trim();
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```[a-z]*\n/, '').replace(/\n```$/, '');
      }
      
      questions = JSON.parse(jsonText);
      
      // Validate questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid quiz question format');
      }
      
      // Validate each question has required fields
      questions = questions.filter(q => 
        q.question && 
        Array.isArray(q.options) && q.options.length === 4 && 
        typeof q.correct_answer === 'number' && q.correct_answer >= 0 && q.correct_answer < 4
      );
      
      if (questions.length === 0) {
        throw new Error('No valid quiz questions generated');
      }
    } catch (parseError) {
      console.error('❌ Error parsing AI response:', parseError);
      console.error('AI Response:', aiResponse);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse quiz data from AI',
        details: parseError.message
      });
    }
    
    // Create quiz session
    const { data: quizSession, error: sessionError } = await supabase
      .from('student_quiz_sessions')
      .insert({
        student_id: studentId,
        class_instance_id: classId,
        material_id: materialId,
        total_questions: count,
        is_completed: false
      })
      .select()
      .single();
    
    if (sessionError) {
      console.error('❌ Error creating quiz session:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create quiz session'
      });
    }
    
    // Save questions to database
    const questionData = questions.map((q, index) => ({
      student_id: studentId,
      class_instance_id: classId,
      material_id: materialId,
      quiz_session_id: quizSession.id,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      question_order: index + 1
    }));
    
    const { data: savedQuestions, error: saveError } = await supabase
      .from('student_quiz_questions')
      .insert(questionData)
      .select();
    
    if (saveError) {
      console.error('❌ Error saving questions:', saveError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save quiz questions'
      });
    }
    
    res.json({
      success: true,
      quiz_session: quizSession,
      questions: savedQuestions
    });
    
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get flashcards for a student
 * GET /api/students/:studentId/classes/:classId/ai/flashcards
 */
router.get('/api/students/:studentId/classes/:classId/ai/flashcards', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get flashcards
    const { data: flashcards, error: flashcardsError } = await supabase
      .from('student_flashcards')
      .select(`
        *,
        class_materials!inner(file_name)
      `)
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .order('created_at', { ascending: false });
    
    if (flashcardsError) {
      console.error('❌ Error fetching flashcards:', flashcardsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch flashcards'
      });
    }
    
    res.json({
      success: true,
      flashcards: flashcards || []
    });
    
  } catch (error) {
    console.error('❌ Get flashcards error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get quiz questions for a student
 * GET /api/students/:studentId/classes/:classId/ai/quiz
 */
router.get('/api/students/:studentId/classes/:classId/ai/quiz', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get quiz sessions and questions
    const { data: quizSessions, error: sessionsError } = await supabase
      .from('student_quiz_sessions')
      .select(`
        *,
        class_materials!inner(file_name),
        student_quiz_questions(*)
      `)
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .order('created_at', { ascending: false });
    
    if (sessionsError) {
      console.error('❌ Error fetching quiz sessions:', sessionsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch quiz sessions'
      });
    }
    
    res.json({
      success: true,
      quiz_sessions: quizSessions || []
    });
    
  } catch (error) {
    console.error('❌ Get quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Submit quiz answers
 * POST /api/students/:studentId/classes/:classId/ai/quiz/submit
 */
router.post('/api/students/:studentId/classes/:classId/ai/quiz/submit', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { quizSessionId, answers } = req.body;
    
    console.log('📝 Submitting quiz answers for session:', quizSessionId);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get quiz questions
    const { data: questions, error: questionsError } = await supabase
      .from('student_quiz_questions')
      .select('*')
      .eq('quiz_session_id', quizSessionId)
      .eq('student_id', studentId);
    
    if (questionsError || !questions) {
      return res.status(404).json({
        success: false,
        error: 'Quiz questions not found'
      });
    }
    
    // Calculate score
    let correctAnswers = 0;
    const results = [];
    
    questions.forEach(question => {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correct_answer;
      
      if (isCorrect) {
        correctAnswers++;
      }
      
      results.push({
        question_id: question.id,
        user_answer: userAnswer,
        correct_answer: question.correct_answer,
        is_correct: isCorrect
      });
      
      // Update question statistics
      supabase
        .from('student_quiz_questions')
        .update({
          times_answered: question.times_answered + 1,
          correct_answers: question.correct_answers + (isCorrect ? 1 : 0),
          last_answered: new Date().toISOString()
        })
        .eq('id', question.id);
    });
    
    const scorePercentage = Math.round((correctAnswers / questions.length) * 100);
    
    // Update quiz session
    const { data: updatedSession, error: sessionError } = await supabase
      .from('student_quiz_sessions')
      .update({
        correct_answers: correctAnswers,
        score_percentage: scorePercentage,
        completed_at: new Date().toISOString(),
        is_completed: true
      })
      .eq('id', quizSessionId)
      .eq('student_id', studentId)
      .select()
      .single();
    
    if (sessionError) {
      console.error('❌ Error updating quiz session:', sessionError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update quiz session'
      });
    }
    
    res.json({
      success: true,
      score: correctAnswers,
      total: questions.length,
      percentage: scorePercentage,
      results: results,
      session: updatedSession
    });
    
  } catch (error) {
    console.error('❌ Quiz submission error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Re-process a material to extract text (for fixing PowerPoint files)
 * POST /api/students/:studentId/classes/:classId/ai/materials/reprocess
 */
router.post('/api/students/:studentId/classes/:classId/ai/materials/reprocess', async (req, res) => {
  try {
    const { studentId, classId } = req.params;
    const { materialId } = req.body;
    
    console.log('🔄 Re-processing material:', materialId);
    
    // Verify student enrollment
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', studentId)
      .eq('class_instance_id', classId)
      .eq('status', 'active')
      .single();
    
    if (enrollmentError || !enrollment) {
      return res.status(403).json({
        success: false,
        error: 'Access denied - not enrolled in this class'
      });
    }
    
    // Get the material
    const { data: material, error: materialError } = await supabase
      .from('class_materials')
      .select('*')
      .eq('id', materialId)
      .eq('class_instance_id', classId)
      .single();
    
    if (materialError || !material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }
    
    // Only process PowerPoint files
    if (material.file_type !== 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
      return res.status(400).json({
        success: false,
        error: 'Only PowerPoint files can be re-processed'
      });
    }
    
    // Extract the actual filename from the file URL
    let actualFileName = material.file_name;
    if (material.file_url) {
      const urlParts = material.file_url.split('/');
      actualFileName = urlParts[urlParts.length - 1];
      console.log('📄 Using filename from URL:', actualFileName);
    }
    
    // Download the file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('class-materials')
      .download(actualFileName);
    
    if (downloadError) {
      console.error('❌ Error downloading file:', downloadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to download file for processing'
      });
    }
    
    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    let extractedText = '';
    
    try {
      // Write buffer to temporary file for pptx2json processing
      const fs = require('fs');
      const path = require('path');
      const tempPath = path.join(__dirname, 'temp', `reprocess_${Date.now()}.pptx`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempPath, buffer);
      
      // Extract text using pptx-text-parser
      const pptxTextParser = require('pptx-text-parser');
      const extractedSlideText = await pptxTextParser(tempPath);
      
      // Format the extracted text
      extractedText = `PowerPoint presentation: ${material.file_name}\n\n${extractedSlideText}`;
      
      // Clean up temporary file
      fs.unlinkSync(tempPath);
      
      console.log('✅ PowerPoint text re-extracted:', extractedText.length, 'characters');
    } catch (pptxError) {
      console.error('❌ PowerPoint re-extraction error:', pptxError);
      extractedText = `PowerPoint presentation: ${material.file_name}\n\nThis PowerPoint file has been uploaded successfully. Text extraction from slides encountered an error, but the AI assistant can still help with general questions about the presentation.`;
    }
    
    // Update the material with new extracted text
    const { data: updatedMaterial, error: updateError } = await supabase
      .from('class_materials')
      .update({ 
        extracted_text: extractedText,
        is_processed: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', materialId)
      .select()
      .single();
    
    if (updateError) {
      console.error('❌ Error updating material:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update material with extracted text'
      });
    }
    
    res.json({
      success: true,
      message: 'Material re-processed successfully',
      material: updatedMaterial,
      extracted_text_length: extractedText.length
    });
    
  } catch (error) {
    console.error('❌ Re-process material error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
