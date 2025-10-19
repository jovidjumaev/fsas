const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const QRCodeGenerator = require('./qr-code-generator.js');
const { 
  getCurrentEasternTime, 
  createEasternDate, 
  formatEasternTime 
} = require('./eastern-time-utils');
require('dotenv').config({ path: '.env.local' });

const router = express.Router();

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// QR CODE SCANNING AND ATTENDANCE RECORDING
// =====================================================

/**
 * Process QR code scan and record attendance
 * POST /api/attendance/scan
 */
router.post('/api/attendance/scan', async (req, res) => {
  try {
    const { qrData, studentId } = req.body;
    
    console.log('📱 Processing QR code scan for student:', studentId);
    
    if (!qrData || !studentId) {
      return res.status(400).json({
        success: false,
        error: 'QR data and student ID are required'
      });
    }
    
    // Parse QR code data
    let parsedQRData;
    try {
      parsedQRData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData;
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Invalid QR code format'
      });
    }
    
    // Validate QR code
    const validation = QRCodeGenerator.validateQR(parsedQRData);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error || 'Invalid QR code'
      });
    }
    
    const sessionId = validation.sessionId;
    
    // Check if session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class_instances!inner(
          id,
          professor_id,
          courses(code, name),
          academic_periods(name)
        )
      `)
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not active'
      });
    }
    
    // First, get the student's user_id from the student_id
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !studentRecord) {
      return res.status(404).json({
        success: false,
        error: 'Student record not found'
      });
    }
    
    // Check if student is enrolled in this class using user_id
    const { data: enrollment, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('*')
      .eq('student_id', studentRecord.user_id)
      .eq('class_instance_id', session.class_instance_id)
      .eq('status', 'active')  // Only allow active enrollments
      .single();
    
    if (enrollmentError || !enrollment) {
      // Get class information for better error message
      const { data: classInfo } = await supabase
        .from('class_instances')
        .select(`
          class_code,
          courses!inner(code, name)
        `)
        .eq('id', session.class_instance_id)
        .single();
      
      const className = classInfo ? `${classInfo.courses.code} - ${classInfo.courses.name}` : 'this class';
      
      // Check if student is enrolled in any instance of this course
      const { data: anyEnrollment } = await supabase
        .from('enrollments')
        .select(`
          class_instances!inner(
            class_code,
            courses!inner(code, name)
          )
        `)
        .eq('student_id', studentRecord.user_id)
        .eq('class_instances.courses.code', classInfo?.courses.code)
        .eq('status', 'active')
        .single();
      
      let errorMessage = `You are not enrolled in ${className} or your enrollment is not active.`;
      
      if (anyEnrollment) {
        errorMessage += ` You are enrolled in ${anyEnrollment.class_instances.courses.code} - ${anyEnrollment.class_instances.courses.name} (${anyEnrollment.class_instances.class_code}), but this QR code is for ${className} (${classInfo.class_code}). Please scan the correct QR code for your class section.`;
      } else {
        errorMessage += ' Please contact your professor if you believe this is an error.';
      }
      
      return res.status(403).json({
        success: false,
        error: errorMessage
      });
    }
    
    // Check if student has already scanned for this session
    const { data: existingAttendance, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentRecord.user_id)
      .single();
    
    if (existingAttendance) {
      return res.status(409).json({
        success: false,
        error: 'You have already marked attendance for this session',
        attendance: {
          id: existingAttendance.id,
          scanned_at: existingAttendance.scanned_at,
          status: existingAttendance.status
        }
      });
    }
    
    // Determine if student is late (more than 5 minutes after class start time)
    // Note: This is based on the scheduled class start time, NOT when the professor started the session
    const currentTime = getCurrentEasternTime();
    
    // Create session start time in Eastern Time using utility functions
    const sessionStartTime = createEasternDate(session.date, session.start_time);
    
    const minutesLate = Math.floor((currentTime - sessionStartTime) / (1000 * 60));
    const isLate = minutesLate > 5;
    
    console.log('🕐 Attendance time calculation:');
    console.log(`   Current time (UTC): ${new Date().toISOString()}`);
    console.log(`   Current time (Eastern): ${formatEasternTime(currentTime)}`);
    console.log(`   Session start time (Eastern): ${formatEasternTime(sessionStartTime)}`);
    console.log(`   Minutes late: ${minutesLate}`);
    console.log(`   Is late: ${isLate}`);
    
    // Record attendance
    const { data: attendanceRecord, error: recordError } = await supabase
      .from('attendance_records')
      .insert({
        session_id: sessionId,
        student_id: studentRecord.user_id,
        scanned_at: currentTime.toISOString(),
        status: isLate ? 'late' : 'present',
        minutes_late: minutesLate, // Store actual calculated value (can be negative for early arrivals)
        device_fingerprint: req.headers['user-agent'] || 'unknown',
        ip_address: req.ip || req.connection.remoteAddress
      })
      .select()
      .single();
    
    if (recordError) {
      console.error('❌ Error recording attendance:', recordError);
      return res.status(500).json({
        success: false,
        error: 'Failed to record attendance'
      });
    }
    
    // Update session attendance count
    await supabase
      .from('class_sessions')
      .update({
        attendance_count: session.attendance_count + 1
      })
      .eq('id', sessionId);
    
    console.log('✅ Attendance recorded successfully:', {
      studentId,
      sessionId,
      status: attendanceRecord.status,
      scanned_at: attendanceRecord.scanned_at
    });
    
    // Emit real-time update to professor
    if (global.io) {
      const professorId = session.class_instances.professor_id;
      
      // Get current attendance count for this session
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('session_id', sessionId);
      
      const attendedCount = attendanceRecords ? 
        attendanceRecords.filter(a => ['present', 'late', 'excused'].includes(a.status)).length : 0;
      const totalStudents = attendanceRecords ? attendanceRecords.length : 0;
      const attendanceRate = totalStudents > 0 ? Math.round((attendedCount / totalStudents) * 100) : 0;
      
      // Broadcast to session room
      global.io.to(`session-${sessionId}`).emit('attendance_update', {
        sessionId,
        studentId,
        status: attendanceRecord.status,
        scanned_at: attendanceRecord.scanned_at,
        attendanceCount: attendedCount,
        totalStudents,
        attendanceRate
      });
      
      // Broadcast to professor dashboard
      global.io.to(`professor-${professorId}`).emit('dashboard-attendance-update', {
        sessionId,
        attendanceCount: attendedCount,
        totalStudents,
        attendanceRate,
        timestamp: new Date().toISOString()
      });
      
      console.log('📡 Real-time attendance update emitted to session room and professor dashboard');
    }
    
    // Create notification for the student
    try {
      const className = `${session.class_instances.courses.code} - ${session.class_instances.courses.name}`;
      const statusText = isLate ? `late (${minutesLate} minutes)` : 'present';
      
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: studentRecord.user_id,
          type: 'attendance_recorded',
          title: 'Attendance recorded successfully!',
          message: `Your attendance has been recorded for ${className}. Status: ${statusText}.`,
          priority: 'medium',
          link: '/student/attendance',
          session_id: sessionId,
          metadata: {
            className,
            status: attendanceRecord.status,
            minutesLate: minutesLate,
            recordedAt: new Date().toISOString()
          }
        });
      
      if (notificationError) {
        console.error('❌ Error creating attendance notification:', notificationError);
      } else {
        console.log('✅ Attendance notification created for student:', studentId);
      }
    } catch (notificationErr) {
      console.error('❌ Error in attendance notification creation:', notificationErr);
    }
    
    res.json({
      success: true,
      message: `Attendance marked successfully! ${isLate ? `You are marked as late (${minutesLate} minutes after class start).` : 'You are present.'}`,
      attendance: {
        id: attendanceRecord.id,
        scanned_at: attendanceRecord.scanned_at,
        status: attendanceRecord.status,
        minutes_late: minutesLate,
        session: {
          id: session.id,
          class_code: session.class_instances.courses.code,
          class_name: session.class_instances.courses.name,
          date: session.date,
          start_time: session.start_time
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error processing QR scan:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get attendance records for a student
 * GET /api/attendance/student/:studentId
 */
router.get('/api/attendance/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { sessionId, limit = 50 } = req.query;
    
    // First, get the student's user_id from the student_id (like "5002378")
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !studentRecord) {
      console.error('❌ Student record not found:', studentError);
      return res.status(404).json({
        success: false,
        error: 'Student record not found',
        details: studentError?.message
      });
    }
    
    let query = supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          id,
          date,
          start_time,
          end_time,
          room_location,
          class_instances!inner(
            courses(code, name),
            academic_periods(name)
          )
        )
      `)
      .eq('student_id', studentRecord.user_id)
      .order('scanned_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }
    
    const { data: attendanceRecords, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching attendance records:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch attendance records'
      });
    }
    
    res.json({
      success: true,
      attendance: attendanceRecords
    });
    
  } catch (error) {
    console.error('❌ Error fetching student attendance:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Get today's scan statistics for a student
 * GET /api/attendance/student/:studentId/today-stats
 */
router.get('/api/attendance/student/:studentId/today-stats', async (req, res) => {
  try {
    const { studentId } = req.params;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`📊 Fetching today's stats for student ${studentId} on ${today}`);
    
    // First, get the student's user_id from the student_id (like "5002378")
    const { data: studentRecord, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('student_id', studentId)
      .single();
    
    if (studentError || !studentRecord) {
      console.error('❌ Student record not found:', studentError);
      return res.status(404).json({
        success: false,
        error: 'Student record not found',
        details: studentError?.message
      });
    }
    
    console.log(`📊 Found student user_id: ${studentRecord.user_id}`);
    
    // Get today's attendance records using the user_id
    // Filter out test records by requiring valid session ID, device fingerprint, and realistic data
    const { data: todayRecords, error } = await supabase
      .from('attendance_records')
      .select(`
        status, 
        scanned_at, 
        created_at, 
        session_id, 
        device_fingerprint, 
        ip_address,
        class_sessions!inner(
          date
        )
      `)
      .eq('student_id', studentRecord.user_id)
      .gte('scanned_at', `${today}T00:00:00`)
      .lt('scanned_at', `${today}T23:59:59`)
      .not('session_id', 'is', null)  // Exclude records without session ID
      .not('device_fingerprint', 'is', null)  // Exclude records without device fingerprint (test data)
      .neq('device_fingerprint', 'test')  // Exclude records with "test" device fingerprint
      .not('ip_address', 'in', '(127.0.0.1,::1)')  // Exclude localhost IP addresses
      .lte('class_sessions.date', today);  // Exclude records with future session dates
    
    if (error) {
      console.error('❌ Error fetching today\'s stats:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch today\'s statistics',
        details: error.message
      });
    }
    
    console.log(`📊 Found ${todayRecords?.length || 0} valid records for today (excluding test data)`);
    
    // Log the filtered records for debugging
    if (todayRecords && todayRecords.length > 0) {
      console.log('📊 Valid records found:');
      todayRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.scanned_at} - ${record.status} (Session: ${record.session_id}, Device: ${record.device_fingerprint?.substring(0, 20)}...)`);
      });
    } else {
      console.log('📊 No valid records found for today');
    }
    
    // Calculate today's statistics
    const scansToday = todayRecords?.length || 0;
    const presentCount = todayRecords?.filter(r => r.status === 'present').length || 0;
    const lateCount = todayRecords?.filter(r => r.status === 'late').length || 0;
    const absentCount = todayRecords?.filter(r => r.status === 'absent').length || 0;
    const excusedCount = todayRecords?.filter(r => r.status === 'excused').length || 0;
    
    console.log(`📊 Stats: Scans=${scansToday}, Present=${presentCount}, Late=${lateCount}, Absent=${absentCount}, Excused=${excusedCount}`);
    
    res.json({
      success: true,
      stats: {
        scansToday,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        excused: excusedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Error in /api/attendance/student/:studentId/today-stats:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get attendance statistics for a student
 * GET /api/attendance/student/:studentId/stats
 */
router.get('/api/attendance/student/:studentId/stats', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Get all attendance records for the student
    const { data: attendanceRecords, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          class_instance_id,
          class_instances!inner(
            courses(code, name)
          )
        )
      `)
      .eq('student_id', studentId);
    
    if (error) {
      console.error('❌ Error fetching attendance stats:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch attendance statistics'
      });
    }
    
    // Calculate statistics
    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = totalSessions - presentCount - lateCount;
    const attendanceRate = totalSessions > 0 ? (presentCount + lateCount) / totalSessions * 100 : 0;
    
    // Group by class
    const classStats = {};
    attendanceRecords.forEach(record => {
      const classCode = record.class_sessions.class_instances.courses.code;
      if (!classStats[classCode]) {
        classStats[classCode] = {
          class_code: classCode,
          class_name: record.class_sessions.class_instances.courses.name,
          total_sessions: 0,
          present_count: 0,
          late_count: 0,
          absent_count: 0
        };
      }
      
      classStats[classCode].total_sessions++;
      if (record.status === 'present') classStats[classCode].present_count++;
      else if (record.status === 'late') classStats[classCode].late_count++;
      else classStats[classCode].absent_count++;
    });
    
    res.json({
      success: true,
      stats: {
        total_sessions: totalSessions,
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        attendance_rate: Math.round(attendanceRate * 100) / 100,
        class_breakdown: Object.values(classStats)
      }
    });
    
  } catch (error) {
    console.error('❌ Error calculating attendance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
