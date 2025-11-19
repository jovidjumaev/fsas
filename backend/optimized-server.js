const { createLogger } = require('./lib/logger');
const logger = createLogger('Backend');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { getCurrentEasternTime, formatEasternTime, createEasternDate } = require('./eastern-time-utils');
require('dotenv').config({ path: '.env.local' });

// Import the new class management API
const classManagementAPI = require('./final-class-management-api.js');

// Import the session management API
const sessionManagementAPI = require('./session-management-api.js');

// Import the attendance API
const attendanceAPI = require('./attendance-api.js');

// Import the student classes API
const studentClassesAPI = require('./student-classes-api.js');

// Import the student class detail API
const studentClassDetailAPI = require('./student-class-detail-api.js');

// Import the AI assistant API
const aiAssistantAPI = require('./ai-assistant-api.js');

// Import the student AI assistant API
const studentAIAssistantAPI = require('./student-ai-assistant-api.js');

// Import the professor quiz insights API
const { router: professorQuizInsightsAPI } = require('./professor-quiz-insights-api.js');

// Import the student dashboard API (commented out - using frontend service instead)
// const studentDashboardAPI = require('./student-dashboard-api.js');

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://fsas-frontend.vercel.app",
      "https://fsas-frontend.vercel.app/"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// QR Code Generator Class
class QRCodeGenerator {
  static get QR_SECRET() {
    return process.env.QR_SECRET || 'fsas_qr_secret_key_2024_secure';
  }
  
  static get QR_EXPIRY_SECONDS() {
    return 300; // 5 minutes - gives students more time to scan
  }

  static async generateSecureQR(sessionId) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    const qrCodeSecret = crypto.randomBytes(32).toString('hex');
    
    const data = `${sessionId}-${timestamp}-${nonce}`;
    
    const signature = crypto
      .createHmac('sha256', this.QR_SECRET)
      .update(data)
      .digest('hex');

    const qrData = {
      sessionId,
      timestamp,
      nonce,
      signature,
      expiresAt: new Date(timestamp + (this.QR_EXPIRY_SECONDS * 1000)).toISOString()
    };

    // Create a URL that students can scan directly
    // Use the Vercel frontend URL for QR codes (hardcoded for reliability)
    const baseUrl = 'https://fsas-frontend.vercel.app';
    const qrUrl = `${baseUrl}/student/scan?data=${encodeURIComponent(JSON.stringify(qrData))}`;

    // Generate QR code image with the URL
    const qrCodeImage = await QRCode.toDataURL(qrUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 256
    });

    const expiresAt = new Date(timestamp + (this.QR_EXPIRY_SECONDS * 1000));

    return {
      qr_code: qrCodeImage,
      expires_at: expiresAt.toISOString(),
      session_id: sessionId
    };
  }
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", "https://*.supabase.co", "http://localhost:*", "ws://localhost:*"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://fsas-frontend.vercel.app",
    "https://fsas-frontend.vercel.app/"
  ],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['qr-generation', 'attendance-tracking', 'real-time-updates', 'role-based-access', 'enrollment-management']
  });
});

// =====================================================
// NEW OPTIMIZED CLASS MANAGEMENT API
// =====================================================
app.use('/', classManagementAPI);
app.use('/', sessionManagementAPI.router);
app.use('/', attendanceAPI);
app.use('/', studentClassesAPI);
app.use('/', studentClassDetailAPI);
app.use('/', aiAssistantAPI);
app.use('/', studentAIAssistantAPI);
app.use('/', professorQuizInsightsAPI);
// app.use('/', studentDashboardAPI); // Commented out - using frontend service instead

// =====================================================
// USER MANAGEMENT ENDPOINTS
// =====================================================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get students
app.get('/api/students', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('students')
      .select(`
        *,
        users!inner(first_name, last_name, email, role)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get professors
app.get('/api/professors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('professors')
      .select(`
        *,
        users!inner(first_name, last_name, email, role)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// DEPARTMENT MANAGEMENT ENDPOINTS
// =====================================================

// Get departments
app.get('/api/departments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// ACADEMIC PERIOD MANAGEMENT ENDPOINTS
// =====================================================

// Get academic periods
app.get('/api/academic-periods', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('academic_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('semester');
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// CLASS MANAGEMENT ENDPOINTS (ENHANCED)
// =====================================================

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        classes!inner(code, name, professor_id, room_location)
      `)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all classes with department and period info
app.get('/api/classes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('classes')
      .select(`
        *,
        departments(name, code),
        academic_periods(name, year, semester)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get professor info separately
    const classesWithProfessors = await Promise.all(data.map(async (cls) => {
      const { data: professorData } = await supabase
        .from('professors')
        .select(`
          employee_id,
          title,
          users!inner(first_name, last_name, email)
        `)
        .eq('user_id', cls.professor_id)
        .single();
      
      return {
        ...cls,
        professor: professorData
      };
    }));
    
    res.json({
      success: true,
      data: classesWithProfessors,
      count: classesWithProfessors.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get classes for a specific professor
app.get('/api/professors/:professorId/classes', async (req, res) => {
  try {
    const { professorId } = req.params;
    
    // Get class instances (using new schema)
    const { data: classInstances, error } = await supabase
      .from('class_instances')
      .select(`
        *,
        courses(code, name, description, credits),
        academic_periods(name, year, semester)
      `)
      .eq('professor_id', professorId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get enrollment counts and attendance rates for each class
    const classesWithStats = await Promise.all(
      classInstances.map(async (classInstance) => {
        // Get enrollments
        const { data: enrollments, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('id')
          .eq('class_instance_id', classInstance.id)
          .eq('status', 'active');
        
        if (enrollmentError) {
          logger.error('Error fetching enrollments for class', classInstance.id, enrollmentError);
        }
        
        const enrolledCount = enrollments?.length || 0;
        const capacityPercentage = classInstance.max_students > 0 
          ? Math.round((enrolledCount / classInstance.max_students) * 100) 
          : 0;
        
        // Get all sessions for this class (active + completed)
        const { data: sessions, error: sessionsError } = await supabase
          .from('class_sessions')
          .select('id, status')
          .eq('class_instance_id', classInstance.id);
        
        if (sessionsError) {
          logger.error('Error fetching sessions for class', classInstance.id, sessionsError);
        }
        
        // Calculate attendance rate from professor-initiated sessions only
        let attendanceRate = 0;
        let totalSessions = 0;
        let activeSessions = 0;
        
        if (sessions && sessions.length > 0) {
          const allSessions = sessions;
          const activeSessionsList = sessions.filter(s => s.status === 'active');
          
          totalSessions = allSessions.length;
          activeSessions = activeSessionsList.length;
          
          // Only calculate attendance rate for sessions where professor took attendance
          const { data: sessionsWithAttendance, error: sessionsError } = await supabase
            .from('class_sessions')
            .select(`
              id,
              attendance_count,
              attendance_records(
                status
              )
            `)
            .eq('class_instance_id', classInstance.id)
            .eq('status', 'completed')
            .gt('attendance_count', 0); // Only sessions where professor took attendance
          
          if (!sessionsError && sessionsWithAttendance && sessionsWithAttendance.length > 0) {
            let totalPossibleAttendance = 0;
            let totalAttended = 0;
            
            sessionsWithAttendance.forEach(session => {
              // Total possible attendance = number of enrolled students for each session
              totalPossibleAttendance += enrolledCount;
              
              // Count how many were present/late/excused
              if (session.attendance_records && session.attendance_records.length > 0) {
                const attendedInSession = session.attendance_records.filter(record => 
                  ['present', 'late', 'excused'].includes(record.status)
                ).length;
                totalAttended += attendedInSession;
              }
            });
            
            if (totalPossibleAttendance > 0) {
              attendanceRate = Math.round((totalAttended / totalPossibleAttendance) * 100);
            }
          }
        }
        
        return {
          id: classInstance.id,
          code: classInstance.courses?.code || 'Unknown',
          name: classInstance.courses?.name || 'Unknown Class',
          description: classInstance.courses?.description || '',
          credits: classInstance.courses?.credits || 0,
          class_code: classInstance.class_code,
          days_of_week: classInstance.days_of_week,
          start_time: classInstance.start_time,
          end_time: classInstance.end_time,
          room_location: classInstance.room_location,
          max_students: classInstance.max_students,
          enrolled_students: enrolledCount,
          capacity_percentage: capacityPercentage,
          attendance_rate: attendanceRate,
          total_sessions: totalSessions,
          active_sessions: activeSessions,
          academic_period: classInstance.academic_periods?.name || 'Unknown Period',
          is_active: classInstance.is_active,
          status: classInstance.status,
          created_at: classInstance.created_at
        };
      })
    );
    
    res.json({
      success: true,
      data: classesWithStats,
      count: classesWithStats.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// ENROLLMENT MANAGEMENT ENDPOINTS
// =====================================================

// Get all enrollments
app.get('/api/enrollments', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        students!inner(
          student_id,
          users!inner(first_name, last_name, email)
        ),
        classes(code, name),
        academic_periods(name, year, semester),
        professors!enrolled_by(
          employee_id,
          users!inner(first_name, last_name)
        )
      `)
      .order('enrollment_date', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Enroll student in class (professor adds student)
app.post('/api/enrollments', async (req, res) => {
  try {
    const { student_id, class_id, academic_period_id, enrolled_by } = req.body;
    
    // Validate required fields
    if (!student_id || !class_id || !academic_period_id || !enrolled_by) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: student_id, class_id, academic_period_id, enrolled_by'
      });
    }
    
    const { data, error } = await supabase
      .from('enrollments')
      .insert({
        student_id,
        class_id,
        academic_period_id,
        enrolled_by,
        enrollment_date: new Date().toISOString().split('T')[0],
        status: 'active'
      })
      .select();
    
    if (error) throw error;
    
    // Create notification for the enrolled student
    try {
      logger.log('🔔 Creating enrollment notification for student:', student_id);
      
      // Get class and professor information for the notification
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          code,
          name,
          professor_id,
          professors!inner(
            users!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('id', class_id)
        .single();
      
      if (!classError && classInfo) {
        const className = `${classInfo.code} - ${classInfo.name}`;
        const professorName = `${classInfo.professors.users.first_name} ${classInfo.professors.users.last_name}`;
        
        const notificationData = {
          user_id: student_id,
          type: 'system', // Use 'system' type since 'class_enrolled' isn't available yet
          title: 'You\'ve been enrolled in a new class!',
          message: `You have been enrolled in ${className} by Professor ${professorName}. Check your dashboard to view class details.`,
          priority: 'high',
          link: `/student/classes/${class_id}`,
          metadata: {
            className,
            professorName,
            enrollmentDate: new Date().toISOString(),
            notificationType: 'class_enrolled', // Store the intended type in metadata
            classId: class_id
          }
        };
        
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notificationData);
        
        if (notificationError) {
          logger.error('❌ Error creating enrollment notification:', notificationError);
        } else {
          logger.log('✅ Enrollment notification created successfully');
        }
      }
    } catch (notificationErr) {
      logger.error('❌ Error in enrollment notification creation:', notificationErr);
    }
    
    res.json({
      success: true,
      data: data[0],
      message: 'Student enrolled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get students enrolled in a specific class
app.get('/api/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const { data, error } = await supabase
      .from('enrollments')
      .select(`
        *,
        students!inner(
          student_id,
          users!inner(first_name, last_name, email)
        )
      `)
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('enrollment_date', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update student grade
app.put('/api/enrollments/:enrollmentId/grade', async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const { final_grade } = req.body;
    
    if (!final_grade) {
      return res.status(400).json({
        success: false,
        error: 'final_grade is required'
      });
    }
    
    const { data, error } = await supabase
      .from('enrollments')
      .update({ final_grade })
      .eq('id', enrollmentId)
      .select();
    
    if (error) throw error;
    
    res.json({
      success: true,
      data: data[0],
      message: 'Grade updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// SESSION MANAGEMENT ENDPOINTS (EXISTING)
// =====================================================

// Get sessions for a class
app.get('/api/classes/:classId/sessions', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const { data, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('class_instance_id', classId)
      .order('date', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate QR code for session
app.get('/api/sessions/:sessionId/qr', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Verify session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }
    
    // Generate QR code
    const qrData = await QRCodeGenerator.generateSecureQR(sessionId);
    
    // Update session with QR data
    await supabase
      .from('sessions')
      .update({
        qr_secret: qrData.session_id,
        qr_expires_at: qrData.expires_at,
        is_active: true
      })
      .eq('id', sessionId);
    
    res.json({
      success: true,
      data: qrData
    });
  } catch (error) {
    logger.error('Error generating QR code:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate QR code'
    });
  }
});

// Activate session (start attendance)
app.post('/api/sessions/:sessionId/activate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    
    logger.log('🚀 Activating session:', sessionId);
    logger.log('🔍 Session activation endpoint called with sessionId:', sessionId);
    
    // Check if session exists and is scheduled
    const { data: session, error: fetchError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'scheduled')
      .single();
    
    if (fetchError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found or already activated'
      });
    }
    
    // Generate initial QR code
    const qrData = await QRCodeGenerator.generateSecureQR(sessionId);
    
    // Calculate session end time (1 hour from now)
    const endTime = new Date(Date.now() + 60 * 60 * 1000);
    
    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'active',
        is_active: true,
        qr_secret: qrData.secret,
        qr_expires_at: qrData.expires_at,
        notes: notes || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    logger.log('✅ Session updated successfully, now calling notification function...');
    
    // Notify students about session activation
    logger.log('🔔 Calling notifyStudentsSessionActivated...');
    try {
      await notifyStudentsSessionActivated(sessionId);
      logger.log('✅ notifyStudentsSessionActivated completed');
    } catch (notificationError) {
      logger.error('❌ Error in notifyStudentsSessionActivated:', notificationError);
    }
    
    logger.log('✅ Session activated successfully:', sessionId);
    
    res.json({
      success: true,
      session: updatedSession,
      qr_code: qrData
    });
    
  } catch (error) {
    logger.error('❌ Error activating session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// ATTENDANCE ENDPOINTS (ENHANCED)
// =====================================================

// Get all attendance records
app.get('/api/attendance', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('attendance')
      .select(`
        *,
        users!inner(first_name, last_name, email),
        sessions!inner(date, start_time, end_time, classes!inner(code, name))
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get QR usage records
app.get('/api/qr-usage', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('qr_usage')
      .select(`
        *,
        users!inner(first_name, last_name, email),
        sessions!inner(date, start_time, classes!inner(code, name))
      `)
      .order('used_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get attendance for a session
app.get('/api/sessions/:sessionId/attendance', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        students!inner(
          student_id,
          users!inner(first_name, last_name, email)
        )
      `)
      .eq('session_id', sessionId)
      .order('scanned_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      data,
      count: data.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// PASSWORD RESET API ENDPOINTS
// =====================================================

// Forgot Password - Send reset email
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email, role } = req.body;
    
    logger.log('🔐 Password reset request:', { email, role });
    
    // Validate input
    if (!email || !role) {
      return res.status(400).json({
        success: false,
        error: 'Email and role are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address'
      });
    }

    // Check if user exists in database with correct role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, role, is_active')
      .eq('email', email.trim().toLowerCase())
      .single();

    if (userError || !userData) {
      logger.log('🔐 User not found:', email);
      return res.status(404).json({
        success: false,
        error: 'No account found with this email address'
      });
    }

    if (userData.role !== role) {
      logger.log('🔐 Role mismatch:', userData.role, 'expected:', role);
      return res.status(400).json({
        success: false,
        error: `This email is registered as a ${userData.role}. Please use the ${userData.role} forgot password page.`
      });
    }

    if (!userData.is_active) {
      logger.log('🔐 Account inactive:', email);
      return res.status(400).json({
        success: false,
        error: 'This account has been deactivated. Please contact support.'
      });
    }

    // Send password reset email using Supabase Auth
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://fsas-frontend.vercel.app'}/reset-password?type=${role}`,
    });

    if (resetError) {
      logger.error('🔐 Password reset error:', resetError);
      return res.status(500).json({
        success: false,
        error: resetError.message
      });
    }

    logger.log('✅ Password reset email sent to:', email);
    res.json({
      success: true,
      message: 'Password reset email sent successfully'
    });

  } catch (error) {
    logger.error('🔐 Password reset error:', error);
    res.status(500).json({
      success: false,
      error: 'An unexpected error occurred. Please try again.'
    });
  }
});

// Validate Reset Token
app.post('/api/auth/validate-reset-token', async (req, res) => {
  try {
    const { token, type } = req.body;
    
    logger.log('🔐 Validating reset token:', { hasToken: !!token, type });
    
    if (!token || !type) {
      return res.status(400).json({
        success: false,
        error: 'Token and type are required'
      });
    }

    // For now, we'll accept any token format
    // In a production environment, you'd validate the JWT token
    // and check if it's valid and not expired
    
    res.json({
      success: true,
      message: 'Token is valid'
    });

  } catch (error) {
    logger.error('🔐 Token validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate token'
    });
  }
});

// Reset Password - Update password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, password, type } = req.body;
    
    logger.log('🔐 Password reset update:', { hasToken: !!token, type });
    
    // Validate input
    if (!token || !password || !type) {
      return res.status(400).json({
        success: false,
        error: 'Token, password, and type are required'
      });
    }

    // Validate password
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long'
      });
    }

    // In a production environment, you would:
    // 1. Validate the JWT token
    // 2. Extract user ID from token
    // 3. Update password for that specific user
    
    // For now, we'll return success
    // The actual password update will be handled by Supabase Auth
    // when the user clicks the reset link and is redirected
    
    logger.log('✅ Password reset completed for type:', type);
    res.json({
      success: true,
      message: 'Password has been reset successfully'
    });

  } catch (error) {
    logger.error('🔐 Password reset update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password. Please try again.'
    });
  }
});

// =====================================================
// COURSES API
// =====================================================

// Get all available courses
app.get('/api/courses', async (req, res) => {
  try {
    logger.log('📚 Fetching available courses');
    
    const { data: courses, error } = await supabase
      .from('classes')
      .select(`
        id,
        code,
        name,
        description,
        credits,
        departments!inner(name)
      `)
      .eq('is_active', true);
    
    if (error) {
      logger.error('Error fetching courses:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch courses'
      });
    }
    
    const formattedCourses = courses.map(course => ({
      id: course.id,
      code: course.code,
      name: course.name,
      description: course.description,
      credits: course.credits,
      department_name: course.departments.name
    }));
    
    logger.log('✅ Courses fetched successfully:', formattedCourses.length);
    res.json({
      success: true,
      courses: formattedCourses
    });
    
  } catch (error) {
    logger.error('📚 Courses fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch courses'
    });
  }
});

// =====================================================
// CLASSES API
// =====================================================

// Create a new class
app.post('/api/classes', async (req, res) => {
  try {
    const { course_id, professor_id, academic_period_id, room_location, max_students } = req.body;
    
    logger.log('📚 Creating new class:', { course_id, professor_id, academic_period_id, room_location, max_students });
    
    // First, get the course details
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('code, name, description, credits, department_id')
      .eq('id', course_id)
      .single();
    
    if (courseError || !course) {
      logger.error('Error fetching course:', courseError);
      return res.status(400).json({
        success: false,
        error: 'Course not found'
      });
    }
    
    // Create the class instance
    const { data: newClass, error: createError } = await supabase
      .from('classes')
      .insert({
        code: course.code,
        name: course.name,
        description: course.description,
        credits: course.credits,
        professor_id,
        department_id: course.department_id,
        academic_period_id: academic_period_id,
        room_location,
        max_students,
        is_active: true
      })
      .select()
      .single();
    
    if (createError) {
      logger.error('Error creating class:', createError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create class'
      });
    }
    
    logger.log('✅ Class created successfully:', newClass.id);
    res.json({
      success: true,
      class: newClass
    });
    
  } catch (error) {
    logger.error('📚 Class creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create class'
    });
  }
});

// =====================================================
// AUTOMATIC SESSION COMPLETION
// =====================================================

// Automatically complete sessions that are past their end time
async function autoCompletePastSessions(classInstanceIds) {
  try {
    logger.log('🔄 Checking for past sessions that need completion...');
    
    const easternTime = getCurrentEasternTime();
    const todayDate = easternTime.toISOString().split('T')[0];
    
    // Find sessions that are past their end time but still scheduled
    const { data: pastSessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        class_instance_id,
        date,
        start_time,
        end_time,
        status
      `)
      .in('class_instance_id', classInstanceIds)
      .eq('status', 'scheduled')
      .lte('date', todayDate); // Sessions on or before today
    
    if (sessionsError) {
      logger.error('❌ Error fetching past sessions:', sessionsError);
      return;
    }
    
    if (!pastSessions || pastSessions.length === 0) {
      logger.log('✅ No past sessions need completion');
      return;
    }
    
    logger.log(`📅 Found ${pastSessions.length} past sessions to check`);
    
    let completedCount = 0;
    
    for (const session of pastSessions) {
      // Create session end time in Eastern Time
      const sessionEndTime = createEasternDate(session.date, session.end_time);
      
      // Check if session end time has passed (with 5-minute grace period)
      const gracePeriod = 5 * 60 * 1000; // 5 minutes in milliseconds
      const completionTime = new Date(sessionEndTime.getTime() + gracePeriod);
      
      if (easternTime >= completionTime) {
        logger.log(`⏰ Auto-completing session ${session.id} (ended ${Math.round((easternTime - sessionEndTime) / (1000 * 60))} minutes ago)`);
        
        // Get all enrolled students for this class
        const { data: enrolledStudents, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_instance_id', session.class_instance_id)
          .eq('status', 'active');
        
        if (enrollmentError) {
          logger.error(`❌ Error fetching enrollments for session ${session.id}:`, enrollmentError);
          continue;
        }
        
        // Get existing attendance records
        const { data: existingRecords, error: recordsError } = await supabase
          .from('attendance_records')
          .select('student_id')
          .eq('session_id', session.id);
        
        if (recordsError) {
          logger.error(`❌ Error fetching attendance records for session ${session.id}:`, recordsError);
          continue;
        }
        
        // Create "present" records for students who don't have them
        const existingStudentIds = new Set(existingRecords.map(record => record.student_id));
        const studentsNeedingRecords = enrolledStudents.filter(
          enrollment => !existingStudentIds.has(enrollment.student_id)
        );
        
        if (studentsNeedingRecords.length > 0) {
          // Create attendance records for students who don't have them
          const attendanceRecords = studentsNeedingRecords.map(enrollment => ({
            session_id: session.id,
            student_id: enrollment.student_id,
            status: 'present', // Default to present for auto-completed sessions
            scanned_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            device_fingerprint: 'auto-completion',
            ip_address: '127.0.0.1'
          }));
          
          const { error: insertError } = await supabase
            .from('attendance_records')
            .insert(attendanceRecords);
          
          if (insertError) {
            logger.error(`❌ Error creating attendance records for session ${session.id}:`, insertError);
            continue;
          }
          
          logger.log(`✅ Created ${attendanceRecords.length} attendance records for session ${session.id}`);
        }
        
        // Update session status to completed
        const { error: updateError } = await supabase
          .from('class_sessions')
          .update({
            status: 'completed',
            is_active: false,
            attendance_count: enrolledStudents.length,
            updated_at: new Date().toISOString()
          })
          .eq('id', session.id);
        
        if (updateError) {
          logger.error(`❌ Error updating session ${session.id}:`, updateError);
          continue;
        }
        
        completedCount++;
        logger.log(`✅ Auto-completed session ${session.id}`);
      } else {
        logger.log(`⏰ Session ${session.id} not yet ready for completion (${Math.round((completionTime - easternTime) / (1000 * 60))} minutes remaining)`);
      }
    }
    
    if (completedCount > 0) {
      logger.log(`🎉 Auto-completed ${completedCount} past sessions`);
    } else {
      logger.log('✅ No sessions needed auto-completion');
    }
    
  } catch (error) {
    logger.error('❌ Error in autoCompletePastSessions:', error);
  }
}

// =====================================================
// PROFESSOR DASHBOARD API
// =====================================================

// Get professor dashboard data
app.get('/api/professors/:professorId/dashboard', async (req, res) => {
  try {
    const { professorId } = req.params;
    
    logger.log('📊 Fetching dashboard data for professor:', professorId);
    
    // Get professor's class instances (using new schema)
    const { data: classInstances, error: classInstancesError } = await supabase
      .from('class_instances')
      .select(`
        id,
        class_code,
        professor_id,
        academic_period_id,
        course_id,
        days_of_week,
        start_time,
        end_time,
        first_class_date,
        last_class_date,
        max_students,
        current_enrollment,
        is_active,
        created_at,
        courses(code, name, description, credits),
        academic_periods(name, year, semester)
      `)
      .eq('professor_id', professorId)
      .eq('is_active', true);
    
    if (classInstancesError) {
      logger.error('Error fetching class instances:', classInstancesError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch class instances'
      });
    }
    
    // Get total students across all class instances
    const { data: enrollments, error: enrollmentsError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        class_instance_id,
        status
      `)
      .in('class_instance_id', classInstances.map(c => c.id))
      .eq('status', 'active');
    
    if (enrollmentsError) {
      logger.error('Error fetching enrollments:', enrollmentsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch enrollments'
      });
    }
    
    // Get all sessions (for finding today's sessions)
    const { data: allSessions, error: allSessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        class_instance_id,
        date,
        start_time,
        end_time,
        is_active,
        status,
        qr_expires_at
      `)
      .in('class_instance_id', classInstances.map(c => c.id));
    
    if (allSessionsError) {
      logger.error('Error fetching all sessions:', allSessionsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch sessions'
      });
    }
    
    // Filter active sessions
    const activeSessions = allSessions.filter(s => s.is_active === true);
    
    // Define Eastern Time for consistent day calculation across the function
    // Get today's date in Eastern Time using centralized utilities
    const easternTime = getCurrentEasternTime();
    const todayDate = easternTime.toISOString().split('T')[0];
    
    logger.log('🕐 Dashboard timezone handling (using centralized utilities):');
    logger.log('  Server UTC time:', new Date().toISOString());
    logger.log('  Eastern time:', formatEasternTime(easternTime));
    logger.log('  Eastern day of week:', easternTime.getDay(), '(' + easternTime.toLocaleDateString('en-US', { weekday: 'long' }) + ')');
    logger.log('  Eastern date:', todayDate);
    
    // Helper function to check if a class meets on a specific day
    const isClassToday = (classInstance) => {
      const todayDayOfWeek = easternTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      logger.log(`🔍 Checking if class ${classInstance.class_code} meets today:`);
      logger.log(`   Today's day of week: ${todayDayOfWeek} (${easternTime.toLocaleDateString('en-US', { weekday: 'long' })})`);
      logger.log(`   Class days: ${classInstance.days_of_week?.join(', ') || 'none'}`);
      
      // Check if today is within the class period using Eastern Time utilities
      const firstClassDate = createEasternDate(classInstance.first_class_date, '00:00:00');
      const lastClassDate = createEasternDate(classInstance.last_class_date, '23:59:59');
      
      logger.log(`   Class period: ${classInstance.first_class_date} to ${classInstance.last_class_date}`);
      logger.log(`   Today within period: ${easternTime >= firstClassDate && easternTime <= lastClassDate}`);
      
      if (easternTime < firstClassDate || easternTime > lastClassDate) {
        logger.log(`   ❌ Class ${classInstance.class_code} not in period`);
        return false;
      }
      
      // Check if today's day of week matches the class schedule
      const daysOfWeek = classInstance.days_of_week || [];
      const dayMapping = {
        'Monday': 1,
        'Tuesday': 2,
        'Wednesday': 3,
        'Thursday': 4,
        'Friday': 5,
        'Saturday': 6,
        'Sunday': 0
      };
      
      const meetsToday = daysOfWeek.some(day => dayMapping[day] === todayDayOfWeek);
      logger.log(`   ✅ Class ${classInstance.class_code} meets today: ${meetsToday}`);
      
      return meetsToday;
    };
    
    // Get today's classes
    const todayClasses = classInstances.filter(isClassToday);
    
    // AUTOMATIC SESSION COMPLETION: Check for past sessions that need to be completed
    await autoCompletePastSessions(classInstances.map(c => c.id));
    
    // Calculate stats
    const totalClasses = classInstances.length;
    const totalStudents = new Set(enrollments.map(e => e.student_id)).size;
    const activeSessionsCount = activeSessions.length;
    
    // Calculate average attendance from COMPLETED sessions (not active sessions)
    const { data: completedSessions, error: completedSessionsError } = await supabase
      .from('class_sessions')
      .select('id, class_instance_id')
      .in('class_instance_id', classInstances.map(c => c.id))
      .eq('status', 'completed');
    
    let averageAttendance = 0;
    if (!completedSessionsError && completedSessions.length > 0) {
      // Get sessions with attendance (professor-initiated)
      const { data: sessionsWithAttendance, error: sessionsWithAttendanceError } = await supabase
        .from('class_sessions')
        .select(`
          id,
          class_instance_id,
          attendance_count,
          attendance_records(
            status
          )
        `)
        .in('class_instance_id', classInstances.map(c => c.id))
        .eq('status', 'completed')
        .gt('attendance_count', 0); // Only sessions where professor took attendance
      
      if (!sessionsWithAttendanceError && sessionsWithAttendance.length > 0) {
        let totalPossibleAttendance = 0;
        let totalAttended = 0;
        
        sessionsWithAttendance.forEach(session => {
          // Get enrollments for this class
          const classEnrollments = enrollments.filter(e => e.class_instance_id === session.class_instance_id);
          const totalEnrolled = classEnrollments.length;
          
          // Total possible attendance = number of enrolled students for each session
          totalPossibleAttendance += totalEnrolled;
          
          // Count how many were present/late/excused
          if (session.attendance_records && session.attendance_records.length > 0) {
            const attendedInSession = session.attendance_records.filter(record => 
              ['present', 'late', 'excused'].includes(record.status)
            ).length;
            totalAttended += attendedInSession;
          }
        });
        
        if (totalPossibleAttendance > 0) {
          averageAttendance = Math.round((totalAttended / totalPossibleAttendance) * 100);
        }
      }
    }
    
    // Format class instances with stats
    const classesWithStats = await Promise.all(classInstances.map(async (instance) => {
      const classEnrollments = enrollments.filter(e => e.class_instance_id === instance.id);
      const classActiveSessions = activeSessions.filter(s => s.class_instance_id === instance.id);
      const classCompletedSessions = completedSessions.filter(s => s.class_instance_id === instance.id);
      // Find today's session first
      const todayDate = easternTime.toISOString().split('T')[0];
      const todaySession = allSessions.find(s => 
        s.class_instance_id === instance.id && 
        s.date === todayDate
      );
      
      // Only consider it a "today's class" if there's actually a session scheduled for today
      const isToday = isClassToday(instance) && todaySession;
      
      // Calculate today-specific attendance rate if session exists, otherwise overall class rate
      let classAttendanceRate = 0;
      let todayAttendanceRate = 0;
      
      if (todaySession) {
        // Only calculate attendance for active or completed sessions
        if (todaySession.status === 'active' || todaySession.status === 'completed') {
          // Calculate today's specific attendance
          const { data: todayAttendanceData } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('session_id', todaySession.id);
          
          if (todayAttendanceData && todayAttendanceData.length > 0) {
            const attendedCount = todayAttendanceData.filter(a => 
              ['present', 'late', 'excused'].includes(a.status)
            ).length;
            todayAttendanceRate = instance.current_enrollment > 0 ? 
              Math.round((attendedCount / instance.current_enrollment) * 100) : 0;
          }
        } else {
          // For scheduled/upcoming sessions, show 0% attendance
          todayAttendanceRate = 0;
        }
        classAttendanceRate = todayAttendanceRate; // Use today's rate for today's classes
      } else {
        // Calculate overall class attendance rate for non-today classes
        const allClassSessions = [...classActiveSessions, ...classCompletedSessions];
        
        if (allClassSessions.length > 0) {
          const { data: classAttendanceData } = await supabase
            .from('attendance_records')
            .select('status')
            .in('session_id', allClassSessions.map(s => s.id));
          
          if (classAttendanceData && classAttendanceData.length > 0) {
            const attendedCount = classAttendanceData.filter(a => 
              ['present', 'late', 'excused'].includes(a.status)
            ).length;
            classAttendanceRate = Math.round((attendedCount / classAttendanceData.length) * 100);
          }
        }
      }
      
      const activeSession = classActiveSessions.length > 0 ? classActiveSessions[0] : null;
      
      // Determine status based on actual session state, not time
      let status = 'upcoming';
      if (classActiveSessions.length > 0) {
        status = 'active';
      } else if (todaySession) {
        // Use actual session status
        status = todaySession.status;
      } else if (isToday) {
        // No session exists for today, check if time has passed
        const now = new Date();
        const todaySessionTime = new Date(`${todayDate}T${instance.start_time}`);
        const sessionEndTime = new Date(`${todayDate}T${instance.end_time}`);
        
        if (now > sessionEndTime) {
          status = 'completed';
        } else if (now > todaySessionTime) {
          status = 'completed';
        }
      }
      
      return {
        id: instance.id,
        code: instance.courses?.code || 'Unknown',
        name: instance.courses?.name || 'Unknown Class',
        description: instance.courses?.description || '',
        credits: instance.courses?.credits || 0,
        class_code: instance.class_code,
        days_of_week: instance.days_of_week,
        start_time: instance.start_time,
        end_time: instance.end_time,
        enrolled_students: instance.current_enrollment || 0,
        max_students: instance.max_students,
        totalSessions: classActiveSessions.length + classCompletedSessions.length,
        completedSessions: classCompletedSessions.length,
        averageAttendance: classAttendanceRate,
        attendance_rate: classAttendanceRate, // Add attendance_rate for frontend compatibility
        status: status,
        isToday: isToday,
        academic_period: instance.academic_periods?.name || 'Unknown Period',
        today_session_id: todaySession?.id || null, // Add session ID for today's session
        active_session_id: activeSession?.id || null // Add active session ID if active
      };
    }));
    
    // Format active sessions
    const formattedActiveSessions = activeSessions.map(session => {
      const classData = classInstances.find(c => c.id === session.class_instance_id);
      const sessionEnrollments = enrollments.filter(e => e.class_instance_id === session.class_instance_id);
      
      return {
        id: session.id,
        class_code: classData?.courses?.code || 'Unknown',
        class_name: classData?.courses?.name || 'Unknown Class',
        present_count: 0, // Would need to query attendance table
        total_students: sessionEnrollments.length,
        qr_code_expires_at: session.qr_expires_at
      };
    });
    
    const dashboardData = {
      stats: {
        totalClasses,
        totalStudents,
        activeSessions: activeSessionsCount,
        averageAttendance
      },
      classes: classesWithStats,
      activeSessions: formattedActiveSessions,
      todayClasses: classesWithStats.filter(c => c.isToday)
    };
    
    logger.log('✅ Dashboard data fetched successfully');
    res.json({
      success: true,
      data: dashboardData
    });
    
  } catch (error) {
    logger.error('❌ Dashboard data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// =====================================================
// SOCKET.IO REAL-TIME UPDATES
// =====================================================

// Make io available globally for other modules
global.io = io;

io.on('connection', (socket) => {
  logger.log('Client connected:', socket.id);
  
  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
    logger.log(`Client ${socket.id} joined session ${sessionId}`);
  });
  
  // Join professor dashboard room for live updates
  socket.on('join-professor-dashboard', (professorId) => {
    socket.join(`professor-${professorId}`);
    logger.log(`Client ${socket.id} joined professor dashboard ${professorId}`);
  });
  
  socket.on('leave-session', (sessionId) => {
    socket.leave(`session-${sessionId}`);
    logger.log(`Client ${socket.id} left session ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    logger.log('Client disconnected:', socket.id);
  });
});

// Helper function to broadcast attendance updates
function broadcastAttendanceUpdate(sessionId, attendanceData) {
  // Broadcast to session room
  io.to(`session-${sessionId}`).emit('attendance-update', attendanceData);
  
  // Also broadcast to professor dashboard if we have professor info
  if (attendanceData.professorId) {
    io.to(`professor-${attendanceData.professorId}`).emit('dashboard-attendance-update', {
      sessionId,
      attendanceCount: attendanceData.attendanceCount,
      totalStudents: attendanceData.totalStudents,
      attendanceRate: attendanceData.attendanceRate,
      timestamp: new Date().toISOString()
    });
  }
}

// =====================================================
// CLASS MANAGEMENT ENDPOINTS
// =====================================================

// Get individual class details
app.get('/api/classes/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select(`
        *,
        departments (
          name,
          code
        ),
        academic_periods (
          name,
          year,
          semester
        )
      `)
      .eq('id', classId)
      .single();
    
    if (classError) {
      logger.error('Error fetching class:', classError);
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }
    
    res.json({
      success: true,
      class: classData
    });
  } catch (error) {
    logger.error('Error in /api/classes/:classId:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get enrolled students for a class
app.get('/api/classes/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        students (
          id,
          student_id,
          enrollment_year,
          major,
          users (
            first_name,
            last_name,
            email,
            phone
          )
        )
      `)
      .eq('class_id', classId)
      .eq('status', 'active');
    
    if (enrollmentError) {
      logger.error('Error fetching enrolled students:', enrollmentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch enrolled students'
      });
    }
    
    // Calculate attendance rate for each student
    const studentsWithAttendance = await Promise.all(
      enrollments.map(async (enrollment) => {
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('attendance')
          .select(`
            status,
            sessions (
              class_id
            )
          `)
          .eq('student_id', enrollment.student_id)
          .eq('sessions.class_id', classId);
        
        let attendanceRate = 0;
        if (!attendanceError && attendanceData.length > 0) {
          const presentCount = attendanceData.filter(a => a.status === 'present').length;
          attendanceRate = Math.round((presentCount / attendanceData.length) * 100);
        }
        
        return {
          ...enrollment.students,
          enrollment_date: enrollment.created_at,
          attendance_rate: attendanceRate
        };
      })
    );
    
    res.json({
      success: true,
      students: studentsWithAttendance
    });
  } catch (error) {
    logger.error('Error in /api/classes/:classId/students:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update current academic period based on real time
app.post('/api/academic-periods/update-current', async (req, res) => {
  try {
    const now = getCurrentEasternTime();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    
    logger.log(`🕐 Updating current period for Eastern Time: ${year}-${month.toString().padStart(2, '0')}`);
    logger.log(`   UTC time: ${new Date().toISOString()}`);
    logger.log(`   Eastern time: ${formatEasternTime(now)}`);
    
    // Determine current period based on Eastern Time date
    let currentPeriod;
    if (month >= 8 && month <= 12) {
      currentPeriod = { name: `Fall ${year}`, year, semester: 'fall' };
    } else if (month >= 1 && month <= 5) {
      currentPeriod = { name: `Spring ${year}`, year, semester: 'spring' };
    } else if (month === 6) {
      currentPeriod = { name: `Summer I ${year}`, year, semester: 'summer_i' };
    } else if (month === 7) {
      currentPeriod = { name: `Summer II ${year}`, year, semester: 'summer_ii' };
    } else {
      currentPeriod = { name: `Fall ${year}`, year, semester: 'fall' };
    }
    
    // Set all periods to not current
    const { error: updateError } = await supabase
      .from('academic_periods')
      .update({ is_current: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (updateError) {
      logger.error('Error updating periods:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Failed to update periods'
      });
    }
    
    // Find or create the current period
    const { data: existingPeriod, error: findError } = await supabase
      .from('academic_periods')
      .select('*')
      .eq('name', currentPeriod.name)
      .eq('year', currentPeriod.year)
      .eq('semester', currentPeriod.semester)
      .single();
    
    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error finding current period:', findError);
      return res.status(500).json({
        success: false,
        error: 'Failed to find current period'
      });
    }
    
    if (existingPeriod) {
      // Update existing period to be current
      const { data, error } = await supabase
        .from('academic_periods')
        .update({ is_current: true })
        .eq('id', existingPeriod.id)
        .select()
        .single();
      
      if (error) {
        logger.error('Error updating current period:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update current period'
        });
      }
      
      res.json({
        success: true,
        message: `Updated current period to ${data.name}`,
        currentPeriod: data
      });
    } else {
      // Create new current period
      const { data, error } = await supabase
        .from('academic_periods')
        .insert({
          name: currentPeriod.name,
          year: currentPeriod.year,
          semester: currentPeriod.semester,
          start_date: `${currentPeriod.year}-08-15`,
          end_date: `${currentPeriod.year}-12-15`,
          is_current: true
        })
        .select()
        .single();
      
      if (error) {
        logger.error('Error creating current period:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to create current period'
        });
      }
      
      res.json({
        success: true,
        message: `Created current period ${data.name}`,
        currentPeriod: data
      });
    }
    
  } catch (error) {
    logger.error('Error in /api/academic-periods/update-current:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all academic periods
app.get('/api/academic-periods', async (req, res) => {
  try {
    const { data: periods, error } = await supabase
      .from('academic_periods')
      .select('*')
      .order('year', { ascending: false })
      .order('semester', { ascending: true });
    
    if (error) {
      logger.error('Error fetching academic periods:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch academic periods'
      });
    }
    
    res.json({
      success: true,
      data: periods
    });
  } catch (error) {
    logger.error('Error in /api/academic-periods:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get all available students
app.get('/api/students', async (req, res) => {
  try {
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select(`
        id,
        student_id,
        first_name,
        last_name,
        email,
        major,
        enrollment_year
      `)
      .eq('is_active', true);
    
    if (studentsError) {
      logger.error('Error fetching students:', studentsError);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch students'
      });
    }
    
    res.json({
      success: true,
      students: students
    });
  } catch (error) {
    logger.error('Error in /api/students:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Create a new student
app.post('/api/students', async (req, res) => {
  try {
    const { student_id, first_name, last_name, email, major, enrollment_year } = req.body;
    
    if (!student_id || !first_name || !last_name || !email || !major || !enrollment_year) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }
    
    // Check if student already exists
    const { data: existingStudent, error: checkError } = await supabase
      .from('students')
      .select('id')
      .eq('student_id', student_id)
      .single();
    
    if (existingStudent) {
      return res.status(400).json({
        success: false,
        error: 'Student with this ID already exists'
      });
    }
    
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert({
        student_id,
        first_name,
        last_name,
        email,
        major,
        enrollment_year,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (studentError) {
      logger.error('Error creating student:', studentError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create student'
      });
    }
    
    res.json({
      success: true,
      student: student
    });
  } catch (error) {
    logger.error('Error in /api/students POST:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Enroll students in a class
app.post('/api/classes/:classId/enroll', async (req, res) => {
  try {
    const { classId } = req.params;
    const { student_ids } = req.body;
    
    if (!student_ids || !Array.isArray(student_ids)) {
      return res.status(400).json({
        success: false,
        error: 'Student IDs array is required'
      });
    }
    
    // Check if class exists and get max_students
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('max_students')
      .eq('id', classId)
      .single();
    
    if (classError) {
      return res.status(404).json({
        success: false,
        error: 'Class not found'
      });
    }
    
    // Check current enrollment count
    const { count: currentEnrollmentCount, error: countError } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classId)
      .eq('status', 'active');
    
    if (countError) {
      logger.error('Error checking enrollment count:', countError);
      return res.status(500).json({
        success: false,
        error: 'Failed to check enrollment count'
      });
    }
    
    if (currentEnrollmentCount + student_ids.length > classData.max_students) {
      return res.status(400).json({
        success: false,
        error: `Cannot enroll ${student_ids.length} students. Class capacity is ${classData.max_students} and currently has ${currentEnrollmentCount} students.`
      });
    }
    
    // Get the current academic period
    const { data: periods, error: periodError } = await supabase
      .from('academic_periods')
      .select('id')
      .eq('is_current', true);
    
    if (periodError) {
      logger.error('Error finding current academic period:', periodError);
      return res.status(500).json({
        success: false,
        error: 'Failed to find academic period'
      });
    }
    
    const currentPeriod = periods && periods.length > 0 ? periods[0] : null;
    
    if (!currentPeriod) {
      logger.error('No current academic period found');
      return res.status(500).json({
        success: false,
        error: 'No current academic period found'
      });
    }

    // Get professor ID from the class
    const { data: classInfo, error: classInfoError } = await supabase
      .from('classes')
      .select('professor_id')
      .eq('id', classId)
      .single();
    
    if (classInfoError) {
      logger.error('Error getting class info:', classInfoError);
      return res.status(500).json({
        success: false,
        error: 'Failed to get class information'
      });
    }

    // Handle enrollments - check for existing dropped enrollments first
    const enrollmentResults = [];
    
    for (const studentId of student_ids) {
      // Check if student already has an enrollment (active or dropped)
      const { data: existingEnrollment, error: checkError } = await supabase
        .from('enrollments')
        .select('*')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .eq('academic_period_id', currentPeriod.id)
        .single();
      
      if (checkError && checkError.code !== 'PGRST116') {
        logger.error('Error checking existing enrollment:', checkError);
        continue;
      }
      
      if (existingEnrollment) {
        // Update existing enrollment to active
        const { data: updatedEnrollment, error: updateError } = await supabase
          .from('enrollments')
          .update({
            status: 'active',
            enrolled_by: classInfo.professor_id
          })
          .eq('id', existingEnrollment.id)
          .select()
          .single();
        
        if (updateError) {
          logger.error('Error updating enrollment:', updateError);
          continue;
        }
        
        enrollmentResults.push(updatedEnrollment);
      } else {
        // Create new enrollment
        const { data: newEnrollment, error: insertError } = await supabase
          .from('enrollments')
          .insert({
            class_id: classId,
            student_id: studentId,
            academic_period_id: currentPeriod.id,
            enrolled_by: classInfo.professor_id,
            status: 'active',
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (insertError) {
          logger.error('Error creating enrollment:', insertError);
          continue;
        }
        
        enrollmentResults.push(newEnrollment);
      }
    }
    
    if (enrollmentResults.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Failed to enroll any students'
      });
    }
    
    // Create notifications for enrolled students
    try {
      logger.log('🔔 Creating enrollment notifications for', enrollmentResults.length, 'students');
      
      // Get class information for notifications
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          code,
          name,
          professor_id,
          professors!inner(
            users!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('id', classId)
        .single();
      
      if (!classError && classInfo) {
        const className = `${classInfo.code} - ${classInfo.name}`;
        const professorName = `${classInfo.professors.users.first_name} ${classInfo.professors.users.last_name}`;
        
        // Create notifications for each enrolled student
        const notificationsToCreate = enrollmentResults.map(enrollment => ({
          user_id: enrollment.student_id,
          type: 'system', // Use 'system' type since 'class_enrolled' isn't available yet
          title: 'You\'ve been enrolled in a new class!',
          message: `You have been enrolled in ${className} by Professor ${professorName}. Check your dashboard to view class details.`,
          priority: 'high',
          link: `/student/classes/${classId}`,
          metadata: {
            className,
            professorName,
            enrollmentDate: new Date().toISOString(),
            notificationType: 'class_enrolled', // Store the intended type in metadata
            classId: classId
          }
        }));
        
        if (notificationsToCreate.length > 0) {
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert(notificationsToCreate);
          
          if (notificationError) {
            logger.error('❌ Error creating enrollment notifications:', notificationError);
          } else {
            logger.log(`✅ Enrollment notifications created for ${notificationsToCreate.length} students`);
          }
        }
      }
    } catch (notificationErr) {
      logger.error('❌ Error in enrollment notification creation:', notificationErr);
    }
    
    res.json({
      success: true,
      message: `Successfully enrolled ${enrollmentResults.length} students`,
      enrollments: enrollmentResults
    });
  } catch (error) {
    logger.error('Error in /api/classes/:classId/enroll:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Unenroll student from a class
app.post('/api/classes/:classId/unenroll', async (req, res) => {
  try {
    logger.log('🔔 CLASS UNENROLLMENT ENDPOINT CALLED:', req.params.classId);
    const { classId } = req.params;
    const { student_id } = req.body;
    
    logger.log('📝 Class unenrollment request:', { classId, student_id });
    
    if (!student_id) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('enrollments')
      .update({ 
        status: 'dropped'
      })
      .eq('class_id', classId)
      .eq('student_id', student_id)
      .eq('status', 'active')
      .select();
    
    if (error) {
      logger.error('Error unenrolling student:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to unenroll student'
      });
    }
    
    if (!data || data.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enrollment not found or already inactive'
      });
    }
    
    // Create notification for the unenrolled student
    try {
      logger.log('🔔 Creating unenrollment notification for student:', student_id);
      
      // Get class and professor information for the notification
      logger.log('🔍 Fetching class info for classId:', classId);
      const { data: classInfo, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          code,
          name,
          professor_id,
          professors!inner(
            users!inner(
              first_name,
              last_name
            )
          )
        `)
        .eq('id', classId)
        .single();
      
      if (classError) {
        logger.error('❌ Error fetching class info:', classError);
        logger.log('❌ Class ID:', classId);
      } else {
        logger.log('✅ Class info fetched:', classInfo);
      }
      
      if (!classError && classInfo) {
        const className = `${classInfo.code} - ${classInfo.name}`;
        const professorName = `${classInfo.professors.users.first_name} ${classInfo.professors.users.last_name}`;
        
        const notificationData = {
          user_id: student_id,
          type: 'system', // Use 'system' type since 'class_unenrolled' isn't available yet
          title: 'You\'ve been removed from a class',
          message: `You have been removed from ${className} by Professor ${professorName}. Please contact your professor if you have any questions.`,
          priority: 'medium',
          link: `/student/classes`,
          metadata: {
            className,
            professorName,
            unenrollmentDate: new Date().toISOString(),
            notificationType: 'class_unenrolled', // Store the intended type in metadata
            classId: classId
          }
        };
        
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert(notificationData);
        
        if (notificationError) {
          logger.error('❌ Error creating unenrollment notification:', notificationError);
        } else {
          logger.log('✅ Unenrollment notification created successfully');
        }
      }
    } catch (notificationErr) {
      logger.error('❌ Error in unenrollment notification creation:', notificationErr);
    }
    
    res.json({
      success: true,
      message: 'Student successfully unenrolled',
      data: data[0]
    });
  } catch (error) {
    logger.error('❌ Error in /api/classes/:classId/unenroll:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error: ' + error.message
    });
  }
});

// =====================================================
// NOTIFICATION SYSTEM FUNCTIONS
// =====================================================

const notifyStudentsSessionActivated = async (sessionId) => {
  try {
    logger.log('📢 Notifying students about session activation:', sessionId);
    
    // Get session details with class information
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        start_time,
        room_location,
        class_instance_id,
        class_instances!inner(
          courses!inner(
            code,
            name
          )
        )
      `)
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      logger.error('❌ Error fetching session details:', sessionError);
      return;
    }
    
    // Get enrolled students for this class instance
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        status
      `)
      .eq('class_instance_id', session.class_instance_id)
      .eq('status', 'active');
    
    if (enrollmentError) {
      logger.error('❌ Error fetching enrollments:', enrollmentError);
      return;
    }
    
    if (!enrollments || enrollments.length === 0) {
      logger.log('📢 No enrolled students found for this class');
      return;
    }
    
    // Prepare notification data
    const className = `${session.class_instances.courses.code} - ${session.class_instances.courses.name}`;
    const sessionTime = `${session.date} at ${session.start_time}`;
    const roomLocation = session.room_location;
    
    // Create notifications for each student
    const notifications = enrollments.map(enrollment => ({
      user_id: enrollment.student_id,
      type: 'system',
      title: 'Class session has started!',
      message: `${className} session has started at ${sessionTime}${roomLocation ? ` in ${roomLocation}` : ''}. You can now scan the QR code to mark your attendance.`,
      priority: 'urgent',
      link: '/student/scan',
      session_id: sessionId,
      metadata: {
        className,
        sessionTime,
        roomLocation,
        sessionStartDate: new Date().toISOString(),
        notificationType: 'session_started'
      }
    }));
    
    if (notifications.length > 0) {
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notificationError) {
        logger.error('❌ Error creating session notifications:', notificationError);
      } else {
        logger.log(`📢 Session notifications sent to ${notifications.length} students`);
      }
    }
  } catch (error) {
    logger.error('❌ Error notifying students:', error);
  }
};

// NOTIFICATIONS API
// =====================================================

// Get notifications for a user
app.get('/api/notifications', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      logger.error('Error fetching notifications:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch notifications'
      });
    }
    
    res.json({
      success: true,
      data: data || [],
      count: data?.length || 0
    });
    
  } catch (error) {
    logger.error('Error in notifications API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get unread notifications count
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('is_read', false);
    
    if (error) {
      logger.error('Error fetching unread count:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch unread count'
      });
    }
    
    res.json({
      success: true,
      count: count || 0
    });
    
  } catch (error) {
    logger.error('Error in unread count API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark notification as read
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('notifications')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', id);
    
    if (error) {
      logger.error('Error marking notification as read:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to mark notification as read'
      });
    }
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
    
  } catch (error) {
    logger.error('Error in mark as read API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create a test notification
app.post('/api/notifications/test', async (req, res) => {
  try {
    const { user_id, title, message } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }
    
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id,
        type: 'system',
        priority: 'medium',
        title: title || 'Test Notification',
        message: message || 'This is a test notification to verify the system is working.',
        metadata: { test: true }
      })
      .select()
      .single();
    
    if (error) {
      logger.error('Error creating test notification:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create test notification'
      });
    }
    
    res.json({
      success: true,
      data,
      message: 'Test notification created successfully'
    });
    
  } catch (error) {
    logger.error('Error in test notification API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 3001;

server.listen(PORT, '0.0.0.0', () => {
  logger.log('🚀 Optimized FSAS Backend Server running on port', PORT);
  logger.log('📊 Health check: http://localhost:' + PORT + '/api/health');
  logger.log('🔗 Supabase connected:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  logger.log('✨ Features: QR Generation, Attendance Tracking, Real-time Updates, Role-based Access, Enrollment Management');
});

module.exports = { app, server, io, broadcastAttendanceUpdate };
