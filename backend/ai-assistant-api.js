const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
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
        // For PPTX files - simplified approach
        console.log('📊 Processing PowerPoint file:', req.file.originalname);
        console.log('📊 File size:', req.file.size, 'bytes');
        console.log('📊 MIME type:', req.file.mimetype);
        extractedText = `PowerPoint presentation: ${req.file.originalname}\n\nThis PowerPoint file has been uploaded successfully. The AI assistant can help answer questions about the presentation content, but detailed text extraction from slides is not available yet.`;
        console.log('✅ PowerPoint file processed successfully');
      } else if (req.file.mimetype === 'application/vnd.ms-powerpoint') {
        // For older PPT files
        console.log('📊 Processing legacy PowerPoint file:', req.file.originalname);
        console.log('📊 File size:', req.file.size, 'bytes');
        console.log('📊 MIME type:', req.file.mimetype);
        extractedText = `PowerPoint presentation: ${req.file.originalname}\n\nThis PowerPoint file has been uploaded successfully. The AI assistant can help answer questions about the presentation content, but detailed text extraction from slides is not available yet.`;
        console.log('✅ Legacy PowerPoint file processed successfully');
      }
    } catch (extractError) {
      console.error('❌ Text extraction error:', extractError);
      extractedText = 'Error extracting text from file';
    }

    // Save to database
    console.log('💾 Saving material to database:', {
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      extractedTextLength: extractedText.length
    });
    
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
      console.error('❌ Database error details:', JSON.stringify(dbError, null, 2));
      console.error('❌ Insert data:', {
        class_instance_id: classId,
        professor_id: professorId,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        file_size: req.file.size,
        file_url: urlData.publicUrl,
        extracted_text: extractedText,
        is_processed: true
      });
      return res.status(500).json({
        success: false,
        error: 'Failed to save file metadata',
        details: dbError.message
      });
    }

    console.log('✅ Material saved successfully:', materialData.id);

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

    console.log('🗑️ Delete request received:', { classId, materialId, professorId });

    // Validate access
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('id, professor_id')
      .eq('id', classId)
      .eq('professor_id', professorId)
      .single();

    if (classError || !classInstance) {
      console.log('❌ Access denied:', classError);
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
      console.log('❌ Material not found:', materialError);
      return res.status(404).json({
        success: false,
        error: 'Material not found'
      });
    }

    console.log('📁 Found material to delete:', material.file_name);
    console.log('🔗 File URL:', material.file_url);
    console.log('📄 File type:', material.file_type);
    
    // Check if this is a PowerPoint file
    const isPowerPoint = material.file_type.includes('powerpoint') || 
                        material.file_name.toLowerCase().endsWith('.ppt') || 
                        material.file_name.toLowerCase().endsWith('.pptx');
    
    if (isPowerPoint) {
      console.log('📊 This is a PowerPoint file - enhanced logging enabled');
    }
    
    // List files in storage bucket to see what's actually there
    console.log('📋 Listing files in storage bucket...');
    const { data: bucketFiles, error: listError } = await supabase.storage
      .from('class-materials')
      .list();
    
    if (listError) {
      console.error('❌ Error listing bucket files:', listError);
    } else {
      console.log('📋 Files in bucket:', bucketFiles?.map(f => f.name) || []);
      
      // For PowerPoint files, show which files match
      if (isPowerPoint) {
        const matchingFiles = bucketFiles?.filter(f => 
          f.name.toLowerCase().includes(material.file_name.toLowerCase().split('.')[0])
        ) || [];
        console.log('📊 PowerPoint files that might match:', matchingFiles.map(f => f.name));
      }
    }

    // Extract filename from URL - handle different Supabase URL formats
    let fileName;
    try {
      // Try to extract from the URL path
      const urlParts = material.file_url.split('/');
      fileName = urlParts[urlParts.length - 1];
      
      // If the filename has query parameters, remove them
      if (fileName.includes('?')) {
        fileName = fileName.split('?')[0];
      }
      
      // If the filename is empty or doesn't look right, use the original filename
      if (!fileName || fileName.length < 3) {
        fileName = material.file_name;
      }
      
      console.log('📄 Extracted filename:', fileName);
      
      // For PowerPoint files, try additional extraction methods
      if (isPowerPoint) {
        console.log('📊 PowerPoint filename extraction details:');
        console.log('📊 Original file_name:', material.file_name);
        console.log('📊 Extracted from URL:', fileName);
        console.log('📊 URL parts:', urlParts);
        
        // Try to find the actual filename in the bucket
        if (bucketFiles) {
          const exactMatch = bucketFiles.find(f => f.name === fileName);
          const nameMatch = bucketFiles.find(f => f.name === material.file_name);
          const partialMatch = bucketFiles.find(f => 
            f.name.toLowerCase().includes(material.file_name.toLowerCase().split('.')[0])
          );
          
          console.log('📊 Exact match found:', exactMatch?.name || 'none');
          console.log('📊 Name match found:', nameMatch?.name || 'none');
          console.log('📊 Partial match found:', partialMatch?.name || 'none');
          
          // Use the best match
          if (exactMatch) {
            fileName = exactMatch.name;
            console.log('📊 Using exact match:', fileName);
          } else if (nameMatch) {
            fileName = nameMatch.name;
            console.log('📊 Using name match:', fileName);
          } else if (partialMatch) {
            fileName = partialMatch.name;
            console.log('📊 Using partial match:', fileName);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error extracting filename:', error);
      fileName = material.file_name;
    }
    
    // Delete from Supabase Storage
    console.log('🗑️ Attempting to delete from storage bucket "class-materials"');
    console.log('📄 Filename to delete:', fileName);
    console.log('🔗 Original file URL:', material.file_url);
    
    const { data: storageData, error: storageError } = await supabase.storage
      .from('class-materials')
      .remove([fileName]);

    console.log('🗑️ Storage deletion result:', { storageData, storageError });

    if (storageError) {
      console.error('❌ Storage deletion error:', storageError);
      console.log('📄 Attempted filename:', fileName);
      console.log('🔗 Original URL:', material.file_url);
      
      // Try alternative filename extraction
      console.log('🔄 Trying alternative filename extraction...');
      const alternativeFileName = material.file_name;
      console.log('📄 Alternative filename:', alternativeFileName);
      
      const { data: altStorageData, error: altStorageError } = await supabase.storage
        .from('class-materials')
        .remove([alternativeFileName]);
      
      console.log('🗑️ Alternative storage deletion result:', { altStorageData, altStorageError });
      
      if (altStorageError) {
        console.error('❌ Alternative storage deletion also failed:', altStorageError);
        
        // For PowerPoint files, try additional approaches
        if (isPowerPoint && bucketFiles) {
          console.log('📊 PowerPoint deletion failed - trying all possible filenames...');
          
          // Try deleting all files that might be related
          const possibleFiles = bucketFiles.filter(f => 
            f.name.toLowerCase().includes(material.file_name.toLowerCase().split('.')[0]) ||
            f.name.toLowerCase().includes(fileName.toLowerCase().split('.')[0])
          );
          
          console.log('📊 Possible PowerPoint files to delete:', possibleFiles.map(f => f.name));
          
          if (possibleFiles.length > 0) {
            const fileNamesToDelete = possibleFiles.map(f => f.name);
            console.log('📊 Attempting to delete PowerPoint files:', fileNamesToDelete);
            
            const { data: pptStorageData, error: pptStorageError } = await supabase.storage
              .from('class-materials')
              .remove(fileNamesToDelete);
            
            console.log('🗑️ PowerPoint storage deletion result:', { pptStorageData, pptStorageError });
            
            if (!pptStorageError) {
              console.log('✅ PowerPoint files deleted from storage:', fileNamesToDelete);
            } else {
              console.error('❌ PowerPoint storage deletion failed:', pptStorageError);
            }
          }
        }
      } else {
        console.log('✅ File deleted from storage with alternative filename:', alternativeFileName);
      }
    } else {
      console.log('✅ File deleted from storage:', fileName);
      console.log('📊 Storage deletion data:', storageData);
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

    console.log('✅ Material deleted from database');

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
