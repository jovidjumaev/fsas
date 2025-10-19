const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const pptx2json = require('pptx2json');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Initialize Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 
      'text/plain', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, DOCX, PPT, and PPTX files are allowed'), false);
    }
  }
});

/**
 * Upload file for a class
 * POST /api/classes/:classId/materials/upload
 */
router.post('/api/classes/:classId/materials/upload', upload.single('file'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { professorId } = req.body;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate professor has access to this class
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this class'
      });
    }

    // Upload file to Supabase Storage
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('class-materials')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (uploadError) {
      console.error('❌ Supabase upload error:', uploadError);
      return res.status(500).json({
        success: false,
        error: 'Failed to upload file'
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('class-materials')
      .getPublicUrl(fileName);

    // Extract text from file
    let extractedText = '';
    try {
      if (req.file.mimetype === 'application/pdf') {
        const pdfData = await pdfParse(req.file.buffer);
        extractedText = pdfData.text;
      } else if (req.file.mimetype === 'text/plain') {
        extractedText = req.file.buffer.toString('utf8');
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
      } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
        // For PPTX files
        const tempPath = path.join(__dirname, 'temp', `${Date.now()}.pptx`);
        await fs.writeFile(tempPath, req.file.buffer);
        
        try {
          const jsonData = await pptx2json(tempPath);
          extractedText = jsonData.slides.map(slide => 
            slide.shapes.map(shape => 
              shape.texts ? shape.texts.join(' ') : ''
            ).join(' ')
          ).join('\n\n');
        } finally {
          // Clean up temp file
          try {
            await fs.unlink(tempPath);
          } catch (cleanupError) {
            console.warn('⚠️ Could not delete temp file:', cleanupError);
          }
        }
      } else if (req.file.mimetype === 'application/vnd.ms-powerpoint') {
        // For older PPT files, we'll just store a placeholder
        extractedText = 'PowerPoint file uploaded. Text extraction for .ppt files is not supported yet.';
      }
    } catch (extractError) {
      console.error('❌ Text extraction error:', extractError);
      extractedText = 'Error extracting text from file';
    }

    // Save to database
    const { data: materialData, error: dbError } = await supabase
      .from('class_materials')
      .insert({
        class_instance_id: classId,
        professor_id: professorId,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        file_url: urlData.publicUrl,
        extracted_text: extractedText,
        is_processed: true
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Database error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to save file metadata'
      });
    }

    res.json({
      success: true,
      material: materialData
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get materials for a class
 * GET /api/classes/:classId/materials
 */
router.get('/api/classes/:classId/materials', async (req, res) => {
  try {
    const { classId } = req.params;
    const { professorId } = req.query;

    // Validate access
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this class'
      });
    }

    // Get materials
    const { data: materials, error: materialsError } = await supabase
      .from('class_materials')
      .select('*')
      .eq('class_instance_id', classId)
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
    console.error('❌ Error in GET materials:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Delete material file
 * DELETE /api/classes/:classId/materials/:materialId
 */
router.delete('/api/classes/:classId/materials/:materialId', async (req, res) => {
  try {
    const { classId, materialId } = req.params;
    const { professorId } = req.body;

    // Validate access
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this class'
      });
    }

    // Get material details
    const { data: material, error: materialError } = await supabase
      .from('class_materials')
      .select('*')
      .eq('id', materialId)
      .eq('class_instance_id', classId)
      .eq('professor_id', professorId)
      .single();

    if (materialError || !material) {
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    // Extract filename from URL for deletion
    const fileName = material.file_url.split('/').pop();
    
    // Delete from Supabase Storage
    const { error: storageError } = await supabase.storage
      .from('class-materials')
      .remove([fileName]);

    if (storageError) {
      console.error('❌ Storage deletion error:', storageError);
      // Continue with database deletion even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('class_materials')
      .delete()
      .eq('id', materialId);

    if (dbError) {
      console.error('❌ Database deletion error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete material from database'
      });
    }

    res.json({
      success: true,
      message: 'Material deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Create or get chat session
 * POST /api/classes/:classId/chat/session
 */
router.post('/api/classes/:classId/chat/session', async (req, res) => {
  try {
    const { classId } = req.params;
    const { professorId, sessionName } = req.body;

    // Validate access
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this class'
      });
    }

    // Create new session
    const { data: sessionData, error: sessionError } = await supabase
      .from('professor_chat_sessions')
      .insert({
        professor_id: professorId,
        class_instance_id: classId,
        session_name: sessionName || 'Chat Session'
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
      session: sessionData
    });

  } catch (error) {
    console.error('❌ Error in create session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Send message to AI assistant
 * POST /api/classes/:classId/chat/message
 */
router.post('/api/classes/:classId/chat/message', async (req, res) => {
  try {
    const { classId } = req.params;
    const { professorId, sessionId, message } = req.body;

    // Validate access
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this class'
      });
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('professor_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('professor_id', professorId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Chat session not found'
      });
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

    // Build context from materials
    let contextText = '';
    if (materials && materials.length > 0) {
      contextText = materials.map(m => 
        `File: ${m.file_name}\nContent: ${m.extracted_text}`
      ).join('\n\n');
    }

    // Get recent chat history (reduced to 5 messages to save tokens)
    const { data: recentMessages, error: messagesError } = await supabase
      .from('professor_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(5);

    // Build conversation history
    const conversationHistory = [];
    if (recentMessages) {
      recentMessages.reverse().forEach(msg => {
        conversationHistory.push({
          role: msg.role,
          content: msg.content
        });
      });
    }

    // Add user message
    conversationHistory.push({
      role: 'user',
      content: message
    });

    // Prepare system message with context
    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant helping a professor with questions about their class materials. 

Available materials:
${contextText || 'No materials uploaded yet.'}

IMPORTANT INSTRUCTIONS:
- Keep responses CONCISE and DIRECT (max 2-3 sentences)
- Focus ONLY on the specific question asked
- Use bullet points for multiple items
- Avoid lengthy explanations or examples
- If question is unrelated to materials, say: "Please ask about the uploaded materials."
- Prioritize accuracy over verbosity`
    };

    // Call OpenAI with strict token limits
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...conversationHistory],
      max_tokens: 150, // Reduced from 1000 to 150 for concise responses
      temperature: 0.3, // Reduced from 0.7 for more focused responses
      presence_penalty: 0.1, // Slight penalty to avoid repetition
      frequency_penalty: 0.1 // Slight penalty to avoid repetitive phrases
    });

    const aiResponse = completion.choices[0].message.content;
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    // Check token usage and add warning if high
    let finalResponse = aiResponse;
    if (tokensUsed > 100) {
      console.log(`⚠️ High token usage: ${tokensUsed} tokens for response`);
    }
    
    // Truncate response if it's too long (additional safety)
    if (aiResponse.length > 500) {
      finalResponse = aiResponse.substring(0, 500) + '...';
      console.log('⚠️ Response truncated due to length');
    }

    // Save user message
    await supabase
      .from('professor_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'user',
        content: message,
        tokens_used: 0,
        model_used: 'gpt-4'
      });

    // Save AI response
    const { data: messageData, error: messageError } = await supabase
      .from('professor_chat_messages')
      .insert({
        session_id: sessionId,
        role: 'assistant',
        content: finalResponse,
        tokens_used: tokensUsed,
        model_used: 'gpt-4'
      })
      .select()
      .single();

    if (messageError) {
      console.error('❌ Error saving message:', messageError);
    }

    // Update session last activity
    await supabase
      .from('professor_chat_sessions')
      .update({ last_activity: new Date().toISOString() })
      .eq('id', sessionId);

    res.json({
      success: true,
      response: finalResponse,
      message: messageData,
      tokens_used: tokensUsed
    });

  } catch (error) {
    console.error('❌ Error in chat message:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get chat history for a session
 * GET /api/classes/:classId/chat/session/:sessionId/messages
 */
router.get('/api/classes/:classId/chat/session/:sessionId/messages', async (req, res) => {
  try {
    const { classId, sessionId } = req.params;
    const { professorId } = req.query;

    // Validate access
    const { data: session, error: sessionError } = await supabase
      .from('professor_chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('professor_id', professorId)
      .eq('class_instance_id', classId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from('professor_chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (messagesError) {
      console.error('❌ Error fetching messages:', messagesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }

    res.json({
      success: true,
      messages: messages || []
    });

  } catch (error) {
    console.error('❌ Error in get messages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
