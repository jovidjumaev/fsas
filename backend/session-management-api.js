const { createLogger } = require('./lib/logger');
const logger = createLogger('Backend');

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const QRCodeGenerator = require('./qr-code-generator.js');
const { 
  toEasternTime, 
  createEasternDate, 
  getCurrentEasternTime, 
  getMinutesToEasternTime,
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
// SESSION TEMPLATE GENERATION
// =====================================================

// Generate session templates for a class instance
const generateSessionTemplates = async (classInstanceId) => {
  try {
    logger.log('🔄 Generating session templates for class instance:', classInstanceId);
    
    // Get class instance details
    const { data: classInstance, error: instanceError } = await supabase
      .from('class_instances')
      .select(`
        *,
        courses(code, name),
        academic_periods(name, start_date, end_date)
      `)
      .eq('id', classInstanceId)
      .single();
    
    if (instanceError || !classInstance) {
      throw new Error('Class instance not found');
    }
    
    // Use existing schedule information from class instance
    const daysOfWeek = classInstance.days_of_week || [];
    const startTime = classInstance.start_time;
    const endTime = classInstance.end_time;
    
    // Get academic period dates using Eastern Time utility functions
    const periodStart = createEasternDate(classInstance.first_class_date, '00:00:00');
    const periodEnd = createEasternDate(classInstance.last_class_date, '00:00:00');
    
    logger.log('🕐 Session template generation timezone handling:');
    logger.log(`   Period start (Eastern): ${formatEasternTime(periodStart)}`);
    logger.log(`   Period end (Eastern): ${formatEasternTime(periodEnd)}`);
    
    // Find the first actual class day that matches the schedule
    let firstClassDate = new Date(periodStart);
    let foundFirstClass = false;
    
    // Look for the first day that matches the class schedule
    while (firstClassDate <= periodEnd && !foundFirstClass) {
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][firstClassDate.getDay()];
      if (daysOfWeek.includes(dayName)) {
        foundFirstClass = true;
        break;
      }
      firstClassDate.setDate(firstClassDate.getDate() + 1);
    }
    
    if (!foundFirstClass) {
      throw new Error('No matching class days found in the specified period');
    }
    
    // Generate sessions starting from the first actual class day
    const sessions = [];
    let sessionNumber = 1;
    let currentDate = new Date(firstClassDate);
    
    while (currentDate <= periodEnd) {
      const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][currentDate.getDay()];
      
      if (daysOfWeek.includes(dayName)) {
        sessions.push({
          class_instance_id: classInstanceId,
          session_number: sessionNumber++,
          date: currentDate.toISOString().split('T')[0],
          start_time: startTime,
          end_time: endTime,
          room_location: classInstance.room_location,
          status: 'scheduled',
          is_active: false,
          total_enrolled: 0,
          attendance_count: 0
        });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Insert sessions into database
    if (sessions.length > 0) {
      const { data: insertedSessions, error: insertError } = await supabase
        .from('class_sessions')
        .insert(sessions)
        .select();
      
      if (insertError) throw insertError;
      
      logger.log(`✅ Generated ${sessions.length} session templates`);
      return insertedSessions;
    }
    
    return [];
  } catch (error) {
    logger.error('❌ Error generating session templates:', error);
    throw error;
  }
};

// =====================================================
// QR CODE ROTATION SYSTEM
// =====================================================

// Generate rotating QR codes using standardized generator
const generateQRCode = (sessionId) => {
  return QRCodeGenerator.generateRotatingQR(sessionId);
};

// =====================================================
// SESSION MANAGEMENT ENDPOINTS
// =====================================================

// Get professor's sessions (all classes)
router.get('/api/professors/:professorId/sessions', async (req, res) => {
  try {
    const { professorId } = req.params;
    const { status, class_id, date_range } = req.query;
    
    logger.log('📊 Fetching sessions for professor:', professorId);
    
    let query = supabase
      .from('class_sessions')
      .select(`
        *,
        class_instances!inner(
          id,
          room_location,
          days_of_week,
          start_time,
          end_time,
          courses(code, name),
          academic_periods(name)
        )
      `)
      .eq('class_instances.professor_id', professorId);
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (class_id && class_id !== 'all') {
      query = query.eq('class_instance_id', class_id);
    }
    
    if (date_range && date_range !== 'all') {
      const easternTime = getCurrentEasternTime();
      const startDate = new Date(easternTime);
      
      switch (date_range) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(easternTime.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(easternTime.getMonth() - 1);
          break;
      }
      
      query = query.gte('date', startDate.toISOString().split('T')[0]);
    }
    
    const { data: sessions, error } = await query
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
    // Debug: Log session dates using Eastern Time
    const easternTime = getCurrentEasternTime();
    const todayDate = easternTime.toISOString().split('T')[0];
    logger.log('🔍 Backend Session Debug (Eastern Time):');
    logger.log('  Eastern time:', formatEasternTime(easternTime));
    logger.log('  Today\'s date (Eastern):', todayDate);
    logger.log('  Total sessions found:', sessions.length);
    logger.log('  Session dates:', sessions.map(s => ({ id: s.id, date: s.date, code: s.class_instances?.courses?.code })));
    logger.log('  Sessions matching today:', sessions.filter(s => s.date === todayDate).length);
    
    // Get current enrollment and attendance counts for each session
    const sessionsWithCounts = await Promise.all(sessions.map(async (session) => {
      // Get enrollment count from class_instances table for consistency
      const { data: classInstance } = await supabase
        .from('class_instances')
        .select('current_enrollment')
        .eq('id', session.class_instances.id)
        .single();
      
      // Get attendance count for this session (excused counts as present for analytics)
      const { data: attendanceRecords } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('session_id', session.id);
      
      // Count present, late, and excused as "attended" for analytics
      const attendedCount = attendanceRecords ? attendanceRecords.filter(record => 
        ['present', 'late', 'excused'].includes(record.status)
      ).length : 0;
      
      return {
        ...session,
        total_enrolled: classInstance ? classInstance.current_enrollment : 0,
        attendance_count: attendedCount // Excused students count as present for analytics
      };
    }));
    
    res.json({
      success: true,
      sessions: sessionsWithCounts,
      count: sessionsWithCounts.length
    });
  } catch (error) {
    logger.error('❌ Error fetching professor sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sessions for specific class instance
router.get('/api/class-instances/:instanceId/sessions', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { status } = req.query;
    
    let query = supabase
      .from('class_sessions')
      .select('*')
      .eq('class_instance_id', instanceId);
    
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    const { data: sessions, error } = await query
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) throw error;
    
    res.json({
      success: true,
      sessions,
      count: sessions.length
    });
  } catch (error) {
    logger.error('❌ Error fetching class sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Activate session (start attendance)
router.post('/api/sessions/:sessionId/activate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    
    logger.log('🚀 Activating session:', sessionId);
    
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
        updated_at: new Date().toISOString() // Track activation time
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Start QR code rotation
    startQRCodeRotation(sessionId);
    
    // Set automatic timeout after 1 hour
    setTimeout(async () => {
      try {
        logger.log('⏰ Auto-completing session after 1 hour:', sessionId);
        await completeSessionAutomatically(sessionId);
      } catch (error) {
        logger.error('❌ Error auto-completing session:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Notify students (implement notification system)
    await notifyStudentsSessionActivated(sessionId);
    
    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('session_status_update', {
        sessionId: sessionId,
        status: 'active'
      });
      global.io.emit('session_activated', {
        sessionId: sessionId
      });
      logger.log('📡 Emitted session activation events via WebSocket');
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

// Complete session automatically (for timeout)
async function completeSessionAutomatically(sessionId) {
  try {
    logger.log('⏰ Auto-completing session:', sessionId);
    
    // Check if session is still active
    const { data: session, error: fetchError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
    
    if (fetchError || !session) {
      logger.log('Session not found or already completed:', sessionId);
      return;
    }
    
    // VALIDATION: Check if session should actually be completed based on time
    const now = getCurrentEasternTime();
    
    // Create session end time in Eastern Time using utility functions
    const sessionEndTime = createEasternDate(session.date, session.end_time);
    
    logger.log(`🕐 Auto-completion time check for session ${sessionId}:`);
    logger.log(`   Current time (UTC): ${new Date().toISOString()}`);
    logger.log(`   Current time (Eastern): ${formatEasternTime(now)}`);
    logger.log(`   Session end time (Eastern): ${formatEasternTime(sessionEndTime)}`);
    
    // Only auto-complete if session end time has passed (with 1-minute grace period)
    const gracePeriod = 1 * 60 * 1000; // 1 minute in milliseconds
    const earliestCompletionTime = new Date(sessionEndTime.getTime() + gracePeriod);
    
    if (now < earliestCompletionTime) {
      const minutesRemaining = getMinutesToEasternTime(session.end_time, session.date);
      logger.log(`⏰ Auto-completion skipped for session ${sessionId}: ${minutesRemaining} minutes remaining`);
      return;
    }
    
    logger.log(`✅ Auto-completion validation passed for session ${sessionId}`);
    
    // Stop QR code rotation
    stopQRCodeRotation(sessionId);
    
    // Get all enrolled students for this class
    const { data: enrolledStudents, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_instance_id', session.class_instance_id)
      .eq('status', 'active');
    
    if (enrollmentError) throw enrollmentError;
    
    // Get existing attendance records for this session
    const { data: existingRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('student_id')
      .eq('session_id', sessionId);
    
    if (recordsError) throw recordsError;
    
    // Create attendance records for students who don't have them (mark as absent)
    const existingStudentIds = new Set(existingRecords.map(record => record.student_id));
    const studentsNeedingRecords = enrolledStudents.filter(
      enrollment => !existingStudentIds.has(enrollment.student_id)
    );
    
    if (studentsNeedingRecords.length > 0) {
      const absentRecords = studentsNeedingRecords.map(enrollment => ({
        session_id: sessionId,
        student_id: enrollment.student_id,
        status: 'absent',
        scanned_at: new Date().toISOString(),
      }));
      
      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(absentRecords);
      
      if (insertError) throw insertError;
      
      logger.log(`✅ Auto-created ${absentRecords.length} absent attendance records`);
    }
    
    // Update session
    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'completed',
        is_active: false,
        qr_expires_at: null
      })
      .eq('id', sessionId);
    
    if (updateError) throw updateError;
    
    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('session_status_update', {
        sessionId: sessionId,
        status: 'completed'
      });
      global.io.emit('session_completed', {
        sessionId: sessionId
      });
      logger.log('📡 Emitted auto-completion events via WebSocket');
    }
    
    logger.log('✅ Session auto-completed successfully:', sessionId);
  } catch (error) {
    logger.error('❌ Error auto-completing session:', error);
    throw error;
  }
}

// Complete session (end attendance)
router.post('/api/sessions/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.log('🏁 Completing session:', sessionId);
    
    // Get session details with validation
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        start_time,
        end_time,
        status,
        class_instance_id
      `)
      .eq('id', sessionId)
      .single();
    
    if (sessionError) throw sessionError;
    
    // VALIDATION: Check if session can be completed
    const now = getCurrentEasternTime();
    
    // Create session times in Eastern Time using utility functions
    const sessionEndTime = createEasternDate(session.date, session.end_time);
    const sessionStartTime = createEasternDate(session.date, session.start_time);
    
    logger.log(`🕐 Time debugging for session ${sessionId}:`);
    logger.log(`   Current time (UTC): ${new Date().toISOString()}`);
    logger.log(`   Current time (Eastern): ${formatEasternTime(now)}`);
    logger.log(`   Session date: ${session.date}`);
    logger.log(`   Session start time: ${session.start_time}`);
    logger.log(`   Session end time: ${session.end_time}`);
    logger.log(`   Session start time (Eastern): ${formatEasternTime(sessionStartTime)}`);
    logger.log(`   Session end time (Eastern): ${formatEasternTime(sessionEndTime)}`);
    logger.log(`   Session status: ${session.status}`);
    logger.log(`   Session activated_at: ${session.activated_at}`);

    // Check if session times are valid
    if (isNaN(sessionStartTime.getTime()) || isNaN(sessionEndTime.getTime())) {
      logger.error(`❌ Invalid session times for session ${sessionId}`);
      return res.status(500).json({
        success: false,
        error: 'Invalid session time configuration'
      });
    }

    // IMPORTANT: If session is already active (professor started it), skip the start time check
    // This allows professors to end sessions they've already started, regardless of scheduled time
    if (session.status === 'active') {
      logger.log(`✅ Session is active - allowing completion regardless of scheduled start time`);
    } else {
      // Allow completion if:
      // 1. Session has started (current time >= session start time)
      // 2. OR if it's within 30 minutes of session start time (for early completion)
      const earlyCompletionWindow = 30 * 60 * 1000; // 30 minutes in milliseconds
      const earliestCompletionTime = new Date(sessionStartTime.getTime() - earlyCompletionWindow);

      if (now < earliestCompletionTime) {
        const minutesUntilStart = Math.round((sessionStartTime.getTime() - now.getTime()) / (1000 * 60));
        logger.log(`❌ Cannot complete session ${sessionId}: ${minutesUntilStart} minutes until session starts`);

        return res.status(400).json({
          success: false,
          error: `Session cannot be completed yet. Session starts in ${minutesUntilStart} minutes.`,
          minutesUntilStart: minutesUntilStart
        });
      }
    }
    
    // Log completion timing for monitoring
    const minutesRemaining = Math.round((sessionEndTime - now) / (1000 * 60));
    if (isNaN(minutesRemaining)) {
      logger.log(`⚠️ Session ${sessionId} completed (time calculation unavailable)`);
    } else if (minutesRemaining > 0) {
      logger.log(`⚠️ Session ${sessionId} completed ${minutesRemaining} minutes early (professor override)`);
    } else {
      logger.log(`✅ Session ${sessionId} completed on time or after end time`);
    }
    
    // Check if session is in a valid state for completion
    if (session.status !== 'active' && session.status !== 'scheduled') {
      logger.log(`❌ Cannot complete session ${sessionId}: Invalid status '${session.status}'`);
      
      return res.status(400).json({
        success: false,
        error: `Session cannot be completed. Current status: ${session.status}`
      });
    }
    
    logger.log(`✅ Session ${sessionId} validation passed. Completing session...`);
    
    // Stop QR code rotation
    stopQRCodeRotation(sessionId);
    
    // Get all enrolled students for this class
    const { data: enrolledStudents, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_instance_id', session.class_instance_id)
      .eq('status', 'active');
    
    if (enrollmentError) throw enrollmentError;
    
    // Get existing attendance records for this session
    const { data: existingRecords, error: recordsError } = await supabase
      .from('attendance_records')
      .select('student_id')
      .eq('session_id', sessionId);
    
    if (recordsError) throw recordsError;
    
    // Create attendance records for students who don't have them (mark as absent)
    const existingStudentIds = new Set(existingRecords.map(record => record.student_id));
    const studentsNeedingRecords = enrolledStudents.filter(
      enrollment => !existingStudentIds.has(enrollment.student_id)
    );
    
    if (studentsNeedingRecords.length > 0) {
      const absentRecords = studentsNeedingRecords.map(enrollment => ({
        session_id: sessionId,
        student_id: enrollment.student_id,
        status: 'absent',
        scanned_at: new Date().toISOString(),
      }));
      
      const { error: insertError } = await supabase
        .from('attendance_records')
        .insert(absentRecords);
      
      if (insertError) throw insertError;
      
      logger.log(`✅ Created ${absentRecords.length} absent attendance records`);
    }
    
    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'completed',
        is_active: false,
        qr_expires_at: null
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    logger.log('✅ Session completed successfully:', sessionId);
    
    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('session_status_update', {
        sessionId: sessionId,
        status: 'completed'
      });
      global.io.emit('session_completed', {
        sessionId: sessionId
      });
      logger.log('📡 Emitted session completion events via WebSocket');
    }
    
    res.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    logger.error('❌ Error completing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause session (temporarily stop attendance)
router.post('/api/sessions/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.log('⏸️ Pausing session:', sessionId);
    
    // Check if session exists and is active
    const { data: session, error: fetchError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
    
    if (fetchError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found or not active'
      });
    }
    
    // Stop QR code rotation
    stopQRCodeRotation(sessionId);
    
    // Update session to paused state
    const { data: updatedSession, error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'paused',
        is_active: false,
        qr_expires_at: null
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    logger.log('✅ Session paused successfully:', sessionId);
    
    res.json({
      success: true,
      session: updatedSession,
      message: 'Session paused successfully'
    });
  } catch (error) {
    logger.error('❌ Error pausing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume session (restart attendance from paused state)
router.post('/api/sessions/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.log('▶️ Resuming session:', sessionId);
    
    // Check if session exists and is paused
    const { data: session, error: fetchError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'paused')
      .single();
    
    if (fetchError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found or not paused'
      });
    }
    
    // Generate new QR code
    const qrData = await QRCodeGenerator.generateSecureQR(sessionId);
    
    // Update session to active state
    const { data: updatedSession, error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'active',
        is_active: true,
        qr_secret: qrData.secret,
        qr_expires_at: qrData.expires_at
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Start QR code rotation
    startQRCodeRotation(sessionId);
    
    logger.log('✅ Session resumed successfully:', sessionId);
    
    res.json({
      success: true,
      session: updatedSession,
      message: 'Session resumed successfully'
    });
  } catch (error) {
    logger.error('❌ Error resuming session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel session
router.post('/api/sessions/:sessionId/cancel', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    
    logger.log('❌ Cancelling session:', sessionId);
    
    // Stop QR code rotation if active
    stopQRCodeRotation(sessionId);
    
    // Update session
    const { data: updatedSession, error: updateError } = await supabase
      .from('class_sessions')
      .update({
        status: 'cancelled',
        is_active: false,
        qr_expires_at: null,
        notes: notes || null
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    logger.log('✅ Session cancelled successfully:', sessionId);
    
    res.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    logger.error('❌ Error cancelling session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session details
router.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data: session, error } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class_instances!inner(
          id,
          room_location,
          courses(code, name),
          academic_periods(name)
        )
      `)
      .eq('id', sessionId)
      .single();
    
    if (error) throw error;
    
    // Get current enrollment count from class_instances table for consistency
    const { data: classInstance, error: classError } = await supabase
      .from('class_instances')
      .select('current_enrollment')
      .eq('id', session.class_instances.id)
      .single();
    
    if (classError) {
      logger.error('❌ Error fetching class instance enrollment count:', classError);
    }
    
    // Get current attendance count for this session (excused counts as present for analytics)
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select('id, status')
      .eq('session_id', sessionId);
    
    if (attendanceError) {
      logger.error('❌ Error fetching attendance count:', attendanceError);
    }
    
    // Count present, late, and excused as "attended" for analytics
    const attendedCount = attendanceRecords ? attendanceRecords.filter(record => 
      ['present', 'late', 'excused'].includes(record.status)
    ).length : 0;
    
    // Update session with current counts
    const updatedSession = {
      ...session,
      total_enrolled: classInstance ? classInstance.current_enrollment : 0,
      attendance_count: attendedCount // Excused students count as present for analytics
    };
    
    res.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    logger.error('❌ Error fetching session details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get attendance records for a session
router.get('/api/sessions/:sessionId/attendance', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data: attendance, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        students!inner(
          user_id,
          student_id,
          users(first_name, last_name, email)
        )
      `)
      .eq('session_id', sessionId)
      .order('scanned_at', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      success: true,
      attendance
    });
  } catch (error) {
    logger.error('❌ Error fetching attendance records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get current QR code for active session
router.get('/api/sessions/:sessionId/qr-code', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    logger.log('📱 Fetching QR code for session:', sessionId);
    
    // Check if session exists and is active
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or not active'
      });
    }
    
    // Generate current QR code
    const qrData = await QRCodeGenerator.generateSecureQR(sessionId);
    
    res.json({
      success: true,
      qr_code: qrData.qr_code,
      expires_at: qrData.expires_at,
      session_id: sessionId,
      time_remaining: Math.max(0, Math.floor((new Date(qrData.expires_at).getTime() - Date.now()) / 1000))
    });
  } catch (error) {
    logger.error('❌ Error fetching QR code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get QR code for active session (legacy endpoint)
router.get('/api/sessions/:sessionId/qr-code-legacy', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const { data: session, error } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('status', 'active')
      .single();
    
    if (error || !session) {
      return res.status(404).json({
        success: false,
        error: 'Active session not found'
      });
    }
    
    // Generate current QR code
    const qrData = generateQRCode(sessionId);
    
    res.json({
      success: true,
      qr_code: qrData,
      session: session
    });
  } catch (error) {
    logger.error('❌ Error getting QR code:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// QR CODE ROTATION MANAGEMENT
// =====================================================

const activeRotations = new Map();

const startQRCodeRotation = (sessionId) => {
  logger.log('🔄 Starting QR code rotation for session:', sessionId);
  
  const rotationInterval = setInterval(async () => {
    try {
      const qrData = await QRCodeGenerator.generateSecureQR(sessionId);
      
      await supabase
        .from('class_sessions')
        .update({
          qr_secret: qrData.secret,
          qr_expires_at: qrData.expires_at
        })
        .eq('id', sessionId);
      
      logger.log('🔄 QR code rotated for session:', sessionId);
      
      // Emit real-time QR code update
      if (global.io) {
        global.io.to(`session-${sessionId}`).emit('qr_code_update', {
          sessionId,
          qr_code: qrData.qr_code,
          expires_at: qrData.expires_at,
          time_remaining: Math.max(0, Math.floor((new Date(qrData.expires_at).getTime() - Date.now()) / 1000))
        });
        
        logger.log('📡 Real-time QR code update emitted to session room');
      }
    } catch (error) {
      logger.error('❌ Error rotating QR code:', error);
    }
  }, 10000); // 10 seconds - rotate QR codes every 10 seconds for security
  
  activeRotations.set(sessionId, rotationInterval);
};

const stopQRCodeRotation = (sessionId) => {
  logger.log('⏹️ Stopping QR code rotation for session:', sessionId);
  
  const interval = activeRotations.get(sessionId);
  if (interval) {
    clearInterval(interval);
    activeRotations.delete(sessionId);
  }
};

// =====================================================
// NOTIFICATION SYSTEM
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
          id,
          class_code,
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
        student_id
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
      metadata: {
        className,
        sessionTime,
        roomLocation,
        sessionStartDate: new Date().toISOString(),
        notificationType: 'session_started',
        sessionId: sessionId
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

// =====================================================
// ATTENDANCE MANAGEMENT
// =====================================================

// Update student attendance status (for professors)
router.patch('/api/sessions/:sessionId/attendance/:studentNumber', async (req, res) => {
  try {
    const { sessionId, studentNumber } = req.params;
    const { status } = req.body;
    
    logger.log('📝 Updating attendance status:', { sessionId, studentNumber, status });
    
    // Validate status
    const validStatuses = ['present', 'late', 'absent', 'excused'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be one of: present, late, absent, excused'
      });
    }
    
    // Check if session exists and is completed
    const { data: session, error: sessionError } = await supabase
      .from('class_sessions')
      .select('id, status')
      .eq('id', sessionId)
      .eq('status', 'completed')
      .single();
    
    if (sessionError || !session) {
      return res.status(400).json({
        success: false,
        error: 'Session not found or not completed'
      });
    }
    
    // Find the student UUID by student number
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('user_id')
      .eq('student_id', studentNumber)
      .single();
    
    if (studentError || !student) {
      return res.status(400).json({
        success: false,
        error: 'Student not found'
      });
    }
    
    const studentUuid = student.user_id;
    
    // Check if attendance record exists
    const { data: existingRecord, error: recordError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', sessionId)
      .eq('student_id', studentUuid)
      .single();
    
    if (recordError && recordError.code !== 'PGRST116') {
      throw recordError;
    }
    
    if (existingRecord) {
      // Update existing record
      const { data: updatedRecord, error: updateError } = await supabase
        .from('attendance_records')
        .update({
          status,
          status_changed_at: new Date().toISOString(),
          status_change_reason: 'Professor manual update'
        })
        .eq('id', existingRecord.id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      logger.log('✅ Updated existing attendance record');
    } else {
      // Create new record
      const { data: newRecord, error: createError } = await supabase
        .from('attendance_records')
        .insert({
          session_id: sessionId,
          student_id: studentUuid,
          status,
          scanned_at: new Date().toISOString(),
          status_changed_at: new Date().toISOString(),
          status_change_reason: 'Professor manual update'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      logger.log('✅ Created new attendance record');
    }
    
    // Update session attendance_count to mark it as professor-initiated
    const { data: attendanceRecords, error: countError } = await supabase
      .from('attendance_records')
      .select('id')
      .eq('session_id', sessionId);
    
    if (!countError && attendanceRecords) {
      const { error: updateSessionError } = await supabase
        .from('class_sessions')
        .update({ 
          attendance_count: attendanceRecords.length,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (updateSessionError) {
        logger.error('❌ Error updating session attendance count:', updateSessionError);
      } else {
        logger.log('✅ Updated session attendance count:', attendanceRecords.length);
      }
    }
    
    res.json({
      success: true,
      message: 'Attendance status updated successfully'
    });
    
    // Emit WebSocket event for real-time updates
    if (global.io) {
      global.io.emit('attendance_status_updated', {
        sessionId: sessionId,
        studentNumber: studentNumber,
        status: status,
        timestamp: new Date().toISOString()
      });
      logger.log('📡 Emitted attendance status update via WebSocket');
    }
    
  } catch (error) {
    logger.error('❌ Error updating attendance status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// AUTOMATIC SESSION COMPLETION
// =====================================================

// Automatically complete sessions that weren't manually completed by professor
// This creates "present" records for all enrolled students
router.post('/api/sessions/auto-complete', async (req, res) => {
  try {
    logger.log('🔄 Starting automatic session completion process...');
    
    // Find sessions that are past their end time but not completed
    const now = new Date();
    const { data: incompleteSessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        class_instance_id,
        date,
        end_time,
        status
      `)
      .eq('status', 'scheduled')
      .lt('date', now.toISOString().split('T')[0]); // Past sessions
    
    if (sessionsError) throw sessionsError;
    
    logger.log(`📅 Found ${incompleteSessions?.length || 0} incomplete sessions`);
    
    let completedCount = 0;
    
    for (const session of incompleteSessions || []) {
      const sessionEndTime = new Date(`${session.date}T${session.end_time}`);
      
      // Only auto-complete if session ended more than 1 hour ago
      if (now - sessionEndTime > 60 * 60 * 1000) {
        logger.log(`⏰ Auto-completing session ${session.id} (ended ${Math.round((now - sessionEndTime) / (1000 * 60))} minutes ago)`);
        
        // Get all enrolled students for this class
        const { data: enrolledStudents, error: enrollmentError } = await supabase
          .from('enrollments')
          .select('student_id')
          .eq('class_instance_id', session.class_instance_id)
          .eq('status', 'active');
        
        if (enrollmentError) throw enrollmentError;
        
        // Get existing attendance records
        const { data: existingRecords, error: recordsError } = await supabase
          .from('attendance_records')
          .select('student_id')
          .eq('session_id', session.id);
        
        if (recordsError) throw recordsError;
        
        // Create "present" records for students who don't have them
        const existingStudentIds = new Set(existingRecords.map(record => record.student_id));
        const studentsNeedingRecords = enrolledStudents.filter(
          enrollment => !existingStudentIds.has(enrollment.student_id)
        );
        
        if (studentsNeedingRecords.length > 0) {
          const presentRecords = studentsNeedingRecords.map(enrollment => ({
            session_id: session.id,
            student_id: enrollment.student_id,
            status: 'present', // Default to present for auto-completed sessions
            scanned_at: sessionEndTime.toISOString(), // Use session end time
            status_change_reason: 'Auto-completed session - default present'
          }));
          
          const { error: insertError } = await supabase
            .from('attendance_records')
            .insert(presentRecords);
          
          if (insertError) throw insertError;
          
          logger.log(`✅ Created ${presentRecords.length} present attendance records for auto-completed session`);
        }
        
        // Update session status
        const { error: updateError } = await supabase
          .from('class_sessions')
          .update({
            status: 'completed',
            is_active: false,
            qr_expires_at: null,
            attendance_count: enrolledStudents.length // Set attendance count
          })
          .eq('id', session.id);
        
        if (updateError) throw updateError;
        
        completedCount++;
        logger.log(`✅ Auto-completed session ${session.id}`);
      }
    }
    
    res.json({
      success: true,
      message: `Auto-completed ${completedCount} sessions`,
      completed_sessions: completedCount
    });
    
  } catch (error) {
    logger.error('❌ Error in auto-completion process:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// BACKFILL MISSING ATTENDANCE RECORDS
// =====================================================

// Backfill missing attendance records for completed sessions
router.post('/api/classes/:classId/backfill-attendance', async (req, res) => {
  try {
    const { classId } = req.params;
    
    logger.log('🔄 Backfilling attendance records for class:', classId);
    
    // Get all completed sessions for this class
    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select('id, date, session_number, class_instance_id')
      .eq('class_instance_id', classId)
      .eq('status', 'completed')
      .order('date', { ascending: true });
    
    if (sessionsError) throw sessionsError;
    
    // Get all enrolled students for this class
    const { data: enrolledStudents, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('class_instance_id', classId)
      .eq('status', 'active');
    
    if (enrollmentError) throw enrollmentError;
    
    let totalRecordsCreated = 0;
    
    // Process each session
    for (const session of sessions) {
      // Get existing attendance records for this session
      const { data: existingRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', session.id);
      
      if (recordsError) throw recordsError;
      
      // Find students who don't have attendance records
      const existingStudentIds = new Set(existingRecords.map(record => record.student_id));
      const studentsNeedingRecords = enrolledStudents.filter(
        enrollment => !existingStudentIds.has(enrollment.student_id)
      );
      
      if (studentsNeedingRecords.length > 0) {
        const absentRecords = studentsNeedingRecords.map(enrollment => ({
          session_id: session.id,
          student_id: enrollment.student_id,
          status: 'absent',
          scanned_at: new Date().toISOString()
        }));
        
        const { error: insertError } = await supabase
          .from('attendance_records')
          .insert(absentRecords);
        
        if (insertError) throw insertError;
        
        totalRecordsCreated += absentRecords.length;
        logger.log(`✅ Created ${absentRecords.length} absent records for session ${session.session_number}`);
      }
    }
    
    logger.log(`✅ Backfill complete: ${totalRecordsCreated} attendance records created`);
    
    res.json({
      success: true,
      message: `Successfully created ${totalRecordsCreated} attendance records`,
      records_created: totalRecordsCreated,
      sessions_processed: sessions.length
    });
    
  } catch (error) {
    logger.error('❌ Error backfilling attendance records:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// ANALYTICS API
// =====================================================

// Get class analytics data
router.get('/api/classes/:classId/analytics', async (req, res) => {
  try {
    const { classId } = req.params;
    
    logger.log('📊 Fetching analytics for class:', classId);
    
    // Get all completed sessions for this class - only professor-initiated sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        session_number,
        attendance_count,
        total_enrolled,
        class_instances!inner(id)
      `)
      .eq('class_instances.id', classId)
      .eq('status', 'completed')
      .gt('attendance_count', 0) // Only sessions with attendance records (professor-initiated)
      .order('date', { ascending: true });
    
    if (sessionsError) throw sessionsError;
    
    // Get session IDs for the queries
    const sessionIds = sessions.map(s => s.id);
    
    // Get all enrolled students for this class from enrollments table
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        student_id,
        students!inner(
          user_id,
          student_id,
          users!inner(
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('class_instance_id', classId)
      .eq('status', 'active');
    
    if (enrollmentError) throw enrollmentError;
    
    // These are the actual enrolled students
    const enrolledStudents = enrollments;
    
    // Get attendance records for all completed sessions
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        session_id,
        student_id,
        status,
        students!inner(
          student_id
        )
      `)
      .in('session_id', sessionIds);
    
    if (attendanceError) throw attendanceError;
    
    // Calculate student attendance percentages
    const studentAnalytics = enrolledStudents.map(enrollment => {
      const student = enrollment.students;
      const studentNumber = student.student_id;
      
      // Count attendance for this student across all sessions
      const studentAttendance = attendanceRecords.filter(record => 
        record.students.student_id === studentNumber
      );
      
      // Count as attended: present, late, or excused
      const attendedSessions = studentAttendance.filter(record => 
        ['present', 'late', 'excused'].includes(record.status)
      ).length;
      
      const totalSessions = sessions.length;
      const attendancePercentage = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
      
      // Get detailed attendance status for each session
      // For each session, either find the actual record or mark as absent
      const sessionDetails = sessions.map(session => {
        const attendanceRecord = studentAttendance.find(record => record.session_id === session.id);
        const status = attendanceRecord ? attendanceRecord.status : 'absent';
        const attended = ['present', 'late', 'excused'].includes(status);
        
        return {
          session_id: session.id,
          date: session.date,
          session_number: session.session_number,
          status: status,
          attended: attended,
          has_record: !!attendanceRecord // Track if there's an actual record in the database
        };
      });
      
      return {
        student_id: studentNumber,
        user_id: student.user_id,
        first_name: student.users.first_name,
        last_name: student.users.last_name,
        email: student.users.email,
        attended_sessions: attendedSessions,
        total_sessions: totalSessions,
        attendance_percentage: Math.round(attendancePercentage * 100) / 100,
        session_details: sessionDetails
      };
    });
    
    // Calculate class attendance trends
    const attendanceTrends = sessions.map(session => {
      const sessionAttendance = attendanceRecords.filter(record => 
        record.session_id === session.id
      );
      
      const attendedCount = sessionAttendance.filter(record => 
        ['present', 'late', 'excused'].includes(record.status)
      ).length;
      
      // Use the actual enrolled students count instead of session.total_enrolled
      const totalEnrolled = enrolledStudents.length;
      const attendanceRate = totalEnrolled > 0 ? (attendedCount / totalEnrolled) * 100 : 0;
      
      return {
        session_id: session.id,
        date: session.date,
        session_number: session.session_number,
        attended_count: attendedCount,
        total_enrolled: totalEnrolled,
        attendance_rate: Math.round(attendanceRate * 100) / 100
      };
    });
    
    // Calculate overall statistics
    const totalSessions = sessions.length;
    const totalStudents = enrolledStudents.length;
    const averageAttendanceRate = attendanceTrends.length > 0 
      ? attendanceTrends.reduce((sum, trend) => sum + trend.attendance_rate, 0) / attendanceTrends.length
      : 0;
    
    const analyticsData = {
      class_id: classId,
      total_sessions: totalSessions,
      total_students: totalStudents,
      average_attendance_rate: Math.round(averageAttendanceRate * 100) / 100,
      student_analytics: studentAnalytics.sort((a, b) => b.attendance_percentage - a.attendance_percentage),
      attendance_trends: attendanceTrends,
      generated_at: new Date().toISOString()
    };
    
    logger.log('✅ Analytics data generated successfully');
    
    res.json({
      success: true,
      data: analyticsData
    });
    
  } catch (error) {
    logger.error('❌ Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// EXPORT FUNCTIONS
// =====================================================

module.exports = {
  router,
  generateSessionTemplates,
  generateQRCode,
  startQRCodeRotation,
  stopQRCodeRotation
};
