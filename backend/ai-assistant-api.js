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

// =====================================================
// DATABASE QUERY FUNCTIONS FOR AI CONTEXT
// =====================================================

/**
 * Get student attendance data for a specific class
 */
async function getStudentAttendanceData(classId, studentName = null) {
  try {
    console.log('📊 Fetching student attendance data for class:', classId);
    console.log('🔍 Looking for student:', studentName);
    console.log('🔄 Cache-busting timestamp:', Date.now());
    
    // First get ACTIVE enrollments for this class (real-time data)
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        enrollment_date,
        status,
        created_at
      `)
      .eq('class_instance_id', classId)
      .eq('status', 'active'); // Only active enrollments
    
    if (enrollmentsError) {
      console.error('❌ Error fetching enrollments:', enrollmentsError);
      return null;
    }
    
    console.log('📋 Found enrollments:', enrollments?.length || 0);
    
    if (!enrollments || enrollments.length === 0) {
      console.log('❌ No enrollments found for class:', classId);
      return [];
    }
    
    // Get student data for all enrolled students
    const studentIds = enrollments.map(e => e.student_id);
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        user_id,
        student_id,
        users!inner(
          first_name,
          last_name,
          email
        )
      `)
      .in('user_id', studentIds);
    
    if (studentsError) {
      console.error('❌ Error fetching students:', studentsError);
      return null;
    }
    
    console.log('👥 Found students:', students?.length || 0);
    
    // Filter by student name if provided
    let filteredStudents = students || [];
    if (studentName) {
      const searchName = studentName.toLowerCase();
      filteredStudents = students?.filter(student => {
        const user = student.users;
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
        const firstName = user.first_name.toLowerCase();
        const lastName = user.last_name.toLowerCase();
        
        return fullName.includes(searchName) || 
               firstName.includes(searchName) || 
               lastName.includes(searchName);
      }) || [];
      
      console.log('🔍 Filtered students for', studentName, ':', filteredStudents.length);
    }
    
    // Get all sessions for this class
    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        session_number,
        date,
        status,
        attendance_records(
          id,
          student_id,
          status,
          minutes_late,
          scanned_at
        )
      `)
      .eq('class_instance_id', classId)
      .order('session_number');
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return null;
    }
    
    console.log('📅 Found sessions:', sessions?.length || 0);
    
    // Process the data to calculate attendance statistics
    const processedData = [];
    
    for (const student of filteredStudents) {
      const user = student.users;
      const enrollment = enrollments.find(e => e.student_id === student.user_id);
      
      // Calculate attendance statistics - only count sessions with actual attendance data
      const sessionsWithAttendance = sessions?.filter(s => s.attendance_records && s.attendance_records.length > 0) || [];
      const totalSessions = sessionsWithAttendance.length;
      const completedSessions = sessionsWithAttendance.filter(s => s.status === 'completed').length;
      const cancelledSessions = sessionsWithAttendance.filter(s => s.status === 'cancelled').length;
      
      let totalAttendanceRecords = 0;
      let presentCount = 0;
      let lateCount = 0;
      let absentCount = 0;
      let excusedCount = 0;
      const sessionDetails = [];
      
      // Process each session that has attendance data
      for (const session of sessionsWithAttendance) {
        const attendanceRecords = session.attendance_records || [];
        const studentRecord = attendanceRecords.find(record => record.student_id === student.user_id);
        
        if (studentRecord) {
          // Student has an attendance record for this session
          switch (studentRecord.status) {
            case 'present':
              presentCount++;
              break;
            case 'late':
              lateCount++;
              break;
            case 'absent':
              absentCount++;
              break;
            case 'excused':
              excusedCount++;
              break;
          }
          
          sessionDetails.push({
            session_number: session.session_number,
            date: session.date,
            status: studentRecord.status,
            minutes_late: studentRecord.minutes_late,
            scanned_at: studentRecord.scanned_at
          });
        } else {
          // Student has no record for this session (absent)
          absentCount++;
          sessionDetails.push({
            session_number: session.session_number,
            date: session.date,
            status: 'absent',
            minutes_late: 0,
            scanned_at: null
          });
        }
      }
      
      // Calculate total attendance records for this student
      totalAttendanceRecords = presentCount + lateCount + absentCount + excusedCount;
      
      // Calculate attendance percentage correctly
      const totalPossibleAttendance = totalSessions; // Each session counts as 1 possible attendance
      const totalAttended = presentCount + lateCount + excusedCount;
      
      const attendancePercentage = totalPossibleAttendance > 0 
        ? Math.round((totalAttended / totalPossibleAttendance) * 100)
        : 0;
      
      processedData.push({
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        student_id: student.student_id,
        enrollment_date: enrollment?.enrollment_date,
        enrollment_status: enrollment?.status,
        total_sessions: totalSessions,
        completed_sessions: completedSessions,
        cancelled_sessions: cancelledSessions,
        total_attendance_records: totalAttendanceRecords,
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        excused_count: excusedCount,
        attendance_percentage: attendancePercentage,
        session_details: sessionDetails
      });
    }
    
    console.log('✅ Student attendance data fetched:', processedData.length, 'students');
    return processedData;
    
  } catch (error) {
    console.error('❌ Error in getStudentAttendanceData:', error);
    return null;
  }
}

/**
 * Get class overview data for context
 */
async function getClassOverviewData(classId) {
  try {
    
    const { data, error } = await supabase
      .from('class_instances')
      .select(`
        class_code,
        courses!inner(code, name),
        academic_periods!inner(name),
        professors!inner(
          users!inner(first_name, last_name)
        ),
        enrollments(count),
        class_sessions(
          id,
          status,
          attendance_records(
            id,
            status
          )
        )
      `)
      .eq('id', classId)
      .single();
    
    if (error) {
      console.error('❌ Error fetching class overview data:', error);
      return null;
    }
    
    // Process the data - only count sessions with actual attendance records (professor-initiated)
    const sessions = data.class_sessions || [];
    const sessionsWithAttendance = sessions.filter(s => s.attendance_records && s.attendance_records.length > 0);
    const totalSessions = sessionsWithAttendance.length;
    const completedSessions = sessionsWithAttendance.filter(s => s.status === 'completed').length;
    const cancelledSessions = sessionsWithAttendance.filter(s => s.status === 'cancelled').length;
    
    let totalAttendanceRecords = 0;
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let excusedCount = 0;
    
    for (const session of sessionsWithAttendance) {
      const attendanceRecords = session.attendance_records || [];
      totalAttendanceRecords += attendanceRecords.length;
      
      for (const record of attendanceRecords) {
        switch (record.status) {
          case 'present':
            presentCount++;
            break;
          case 'late':
            lateCount++;
            break;
          case 'absent':
            absentCount++;
            break;
          case 'excused':
            excusedCount++;
            break;
        }
      }
    }
    
    // Calculate overall attendance percentage correctly
    const totalEnrolled = data.enrollments?.[0]?.count || 0;
    const totalPossibleAttendance = sessionsWithAttendance.length * totalEnrolled;
    const totalAttended = presentCount + lateCount + excusedCount;
    
    const overallAttendancePercentage = totalPossibleAttendance > 0 
      ? Math.round((totalAttended / totalPossibleAttendance) * 100)
      : 0;
    
    // Get actual count of active enrollments
    const { count: activeEnrollmentCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_instance_id', classId)
      .eq('status', 'active');
    
    const processedData = {
      class_code: data.class_code,
      course_code: data.courses.code,
      course_name: data.courses.name,
      period_name: data.academic_periods.name,
      professor_name: `${data.professors.users.first_name} ${data.professors.users.last_name}`,
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      cancelled_sessions: cancelledSessions,
      total_enrolled: activeEnrollmentCount || 0,
      active_enrolled: activeEnrollmentCount || 0,
      total_attendance_records: totalAttendanceRecords,
      present_count: presentCount,
      late_count: lateCount,
      absent_count: absentCount,
      excused_count: excusedCount,
      overall_attendance_percentage: overallAttendancePercentage
    };
    
    console.log('✅ Class overview data fetched');
    return processedData;
    
  } catch (error) {
    console.error('❌ Error in getClassOverviewData:', error);
    return null;
  }
}

/**
 * Extract student name from question for targeted queries
 */
function extractStudentNameFromQuestion(question) {
  const lowerQuestion = question.toLowerCase();
  
  // Common patterns for asking about specific students
  const patterns = [
    /how has ([a-zA-Z\s]+)/i,
    /how is ([a-zA-Z\s]+)/i,
    /how did ([a-zA-Z\s]+)/i,
    /([a-zA-Z\s]+) attendance/i,
    /([a-zA-Z\s]+) performance/i,
    /([a-zA-Z\s]+) progress/i,
    /student ([a-zA-Z\s]+)/i,
    /([a-zA-Z\s]+) in this class/i,
    /([a-zA-Z\s]+) doing/i,
    /([a-zA-Z\s]+) doing in/i
  ];
  
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match && match[1]) {
      let name = match[1].trim();
      
      // Clean up the name (remove extra words)
      name = name.replace(/\b(doing|in|this|class|my|the|a|an)\b/gi, '').trim();
      
      // Filter out common words that aren't names
      const commonWords = ['the', 'this', 'that', 'my', 'our', 'their', 'his', 'her', 'doing', 'in', 'class'];
      if (!commonWords.includes(name.toLowerCase()) && name.length > 1) {
        console.log('🔍 Extracted name:', name);
        return name;
      }
    }
  }
  
  return null;
}

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

    // Extract student name from question for targeted queries
    const studentName = extractStudentNameFromQuestion(message);

    // Get database context (class overview and student attendance data)
    let databaseContext = '';
    try {
      // Add timestamp to ensure AI knows data is fresh
      const dataTimestamp = new Date().toISOString();
      databaseContext += `📊 LIVE DATABASE DATA (Updated: ${dataTimestamp}):\n`;
      databaseContext += `🔄 This data is fetched in REAL-TIME - it reflects the current state of enrollments and attendance.\n`;
      databaseContext += `✅ Only ACTIVE enrollments are included - dropped/inactive students are excluded.\n\n`;
      
      // Force fresh data by adding cache-busting timestamp
      const classOverview = await getClassOverviewData(classId);
      let studentData;
      try {
        studentData = await getStudentAttendanceData(classId, studentName);
      } catch (error) {
        console.error('Error in getStudentAttendanceData:', error);
        studentData = null;
      }
      
      // Temporarily remove the check to see what data is actually being sent to AI
      console.error('DEBUG: studentData result:', studentData ? `${studentData.length} students` : 'null/undefined');
      
      // Add class identification to context
      if (classOverview) {
        databaseContext += `\nCLASS: ${classOverview.course_name} (${classOverview.class_code})\n`;
        databaseContext += `Sessions: ${classOverview.completed_sessions}/${classOverview.total_sessions} completed\n`;
        databaseContext += `Students: ${classOverview.total_enrolled} enrolled\n`;
        databaseContext += `Overall Attendance: ${classOverview.overall_attendance_percentage}%\n\n`;
      }
      
      if (studentData && studentData.length > 0) {
        if (studentName) {
          databaseContext += `STUDENT ATTENDANCE DATA (${studentName}):\n`;
        } else {
          databaseContext += `STUDENT ATTENDANCE DATA:\n`;
        }
        
        studentData.forEach(student => {
          databaseContext += `• ${student.first_name} ${student.last_name}: ${student.attendance_percentage}% (${student.present_count + student.late_count + student.excused_count}/${student.total_sessions})\n`;
        });
        
      } else {
        databaseContext += `\nSTUDENT ATTENDANCE DATA:\n`;
        databaseContext += `❌ No students enrolled in this class or no attendance data available.\n`;
        databaseContext += `This could mean:\n`;
        databaseContext += `- No students are currently enrolled in this class\n`;
        databaseContext += `- Students are enrolled but no sessions have been completed yet\n`;
        databaseContext += `- You may be in the wrong class (check the Class Code above)\n\n`;
      }
    } catch (error) {
      console.error('❌ Error fetching database context:', error);
    }
    
    // Temporarily remove the check to see what database context is actually being sent to AI
    console.error('DEBUG: databaseContext length:', databaseContext ? databaseContext.length : 'null/undefined');

    // Get recent chat history (reduced to 3 messages to save tokens - 20% reduction)
    const { data: recentMessages, error: messagesError } = await supabase
      .from('professor_chat_messages')
      .select('role, content')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(3);

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
      content: `You are an AI assistant helping a professor with questions about their class materials and student attendance data.

AVAILABLE MATERIALS:
${contextText || 'No materials uploaded yet.'}

${databaseContext}

CRITICAL INSTRUCTIONS:
- Keep responses CONCISE and DIRECT (max 2-3 sentences)
- Focus ONLY on the specific question asked
- Use bullet points for multiple items
- Avoid lengthy explanations or examples
- You can answer questions about both uploaded materials AND student attendance/performance
- For attendance questions, use the provided database context (this data is LIVE and up-to-date)
- The database context shows REAL-TIME data - trust it completely and use it as the source of truth
- IMPORTANT: Only students with ACTIVE enrollments are included in the data - dropped/inactive students are excluded
- **MOST IMPORTANT: If STUDENT ATTENDANCE DATA is provided below, you MUST use it. Do NOT say "no data available" if the data is there.**

ATTENDANCE QUESTIONS YOU CAN ANSWER:
- "Who has the best attendance?" → Look at the STUDENT ATTENDANCE DATA section and find the student with the highest attendance percentage
- "Who was absent in session X?" → Check session details for specific session numbers
- "How is [student name] doing?" → Find the student in the STUDENT ATTENDANCE DATA section
- "Show me [student name]'s attendance record" → Find the student and show their detailed attendance
- "Who was late in the last session?" → Check session details for late status
- "How many classes did [student] miss?" → Calculate from absent_count in student data
- "Is [student] enrolled in this class?" → Check if student appears in STUDENT ATTENDANCE DATA
- "Who has the worst attendance?" → Find student with lowest attendance percentage
- "What's the average attendance?" → Use the overall attendance rate from CLASS OVERVIEW

EXAMPLE RESPONSES:
- "Who has the best attendance?" → "Jovid Jumaev has the best attendance at 100% (4/4 sessions)."
- "How is Pratik doing?" → "Pratik Shrestha has 75% attendance (3/4 sessions) with 1 absence."
- "Who was absent in session 2?" → "Check the session details in the student data for session 2."

CRITICAL: If you see STUDENT ATTENDANCE DATA above, you MUST use it to answer attendance questions. Do NOT say "no data available" if the data is provided above.

IMPORTANT RULES:
- ALWAYS use the STUDENT ATTENDANCE DATA section to answer attendance questions
- If STUDENT ATTENDANCE DATA is provided, you CAN answer individual student questions
- If a student is not in the database context, they are NOT enrolled in this class
- Use session details to answer specific session questions
- If question is unrelated to materials or attendance, say: "Please ask about the uploaded materials or student attendance."
- Prioritize accuracy over verbosity`
    };

    // Call OpenAI with strict token limits (20% reduction)
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [systemMessage, ...conversationHistory],
      max_tokens: 120, // Reduced from 150 to 120 (20% reduction)
      temperature: 0.2, // Reduced from 0.3 for more focused responses
      presence_penalty: 0.2, // Increased to reduce repetition
      frequency_penalty: 0.2 // Increased to reduce repetitive phrases
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

/**
 * Debug endpoint to test database queries
 * GET /api/debug/class/:classId/students
 */
router.get('/api/debug/class/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    console.log('🔍 DEBUG: Testing database queries for class:', classId);
    
    // Test enrollments query
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select('student_id, enrollment_date, status')
      .eq('class_instance_id', classId);
    
    console.log('🔍 DEBUG: Enrollments result:', { enrollments, enrollmentsError });
    
    if (enrollmentsError) {
      return res.status(500).json({ error: 'Enrollments query failed', details: enrollmentsError });
    }
    
    if (!enrollments || enrollments.length === 0) {
      return res.json({ message: 'No enrollments found', enrollments: [] });
    }
    
    // Test students query
    const studentIds = enrollments.map(e => e.student_id);
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        user_id,
        student_id,
        users!inner(
          first_name,
          last_name,
          email
        )
      `)
      .in('user_id', studentIds);
    
    console.log('🔍 DEBUG: Students result:', { students, studentsError });
    
    if (studentsError) {
      return res.status(500).json({ error: 'Students query failed', details: studentsError });
    }
    
    // Test sessions query
    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        session_number,
        date,
        status,
        attendance_records(
          id,
          student_id,
          status,
          minutes_late
        )
      `)
      .eq('class_instance_id', classId)
      .order('session_number');
    
    console.log('🔍 DEBUG: Sessions result:', { sessions, sessionsError });
    
    return res.json({
      success: true,
      enrollments: enrollments.length,
      students: students?.length || 0,
      sessions: sessions?.length || 0,
      data: {
        enrollments,
        students,
        sessions
      }
    });
    
  } catch (error) {
    console.error('❌ DEBUG: Error in debug endpoint:', error);
    return res.status(500).json({ error: 'Debug endpoint failed', details: error.message });
  }
});

module.exports = router;
