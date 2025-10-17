#!/usr/bin/env node

/**
 * Student Dashboard Data Accuracy Analysis
 * Focus on attendance statistics accuracy and real-time behavior
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('📊 Student Dashboard Data Accuracy Analysis\n');

async function analyzeAttendanceAccuracy() {
  try {
    console.log('🎯 Analysis 1: Overall Attendance Percentage Accuracy');
    console.log('=' .repeat(60));
    
    const testUserId = '03cfe76e-57d1-41dc-89ee-079a69750f1e'; // Known test user
    const testStudentId = '5002378'; // Known student ID
    
    // Get all attendance records for this student
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          date,
          status,
          class_instance_id,
          class_instances!inner(
            courses(code, name)
          )
        )
      `)
      .eq('student_id', testUserId)
      .order('scanned_at', { ascending: false });
    
    if (attendanceError) {
      console.log('❌ Error fetching attendance records:', attendanceError.message);
      return;
    }
    
    console.log('✅ Total Attendance Records:', attendanceRecords.length);
    
    // Calculate overall statistics
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
    
    const overallAttendance = totalRecords > 0 
      ? Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100)
      : 0;
    
    console.log('📊 Manual Calculation:', {
      total_records: totalRecords,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      excused: excusedCount,
      overall_attendance: `${overallAttendance}%`
    });
    
    // Show recent records to verify data freshness
    console.log('\n📝 Recent Attendance Records (Last 10):');
    attendanceRecords.slice(0, 10).forEach((record, index) => {
      console.log(`${index + 1}. ${record.class_sessions.date} - ${record.class_sessions.class_instances.courses.name} - ${record.status.toUpperCase()} (${record.scanned_at})`);
    });
    
    console.log('\n🎯 Analysis 2: Class-wise Attendance Accuracy');
    console.log('=' .repeat(60));
    
    // Calculate statistics by class
    const classStats = {};
    attendanceRecords.forEach(record => {
      const classCode = record.class_sessions.class_instances.courses.code;
      const className = record.class_sessions.class_instances.courses.name;
      
      if (!classStats[classCode]) {
        classStats[classCode] = {
          class_code: classCode,
          class_name: className,
          total_sessions: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0
        };
      }
      
      classStats[classCode].total_sessions++;
      classStats[classCode][record.status]++;
    });
    
    console.log('📈 Class-wise Statistics:');
    Object.values(classStats).forEach(stats => {
      const attendanceRate = stats.total_sessions > 0 
        ? Math.round(((stats.present + stats.late + stats.excused) / stats.total_sessions) * 100)
        : 0;
      
      console.log(`📚 ${stats.class_code} - ${stats.class_name}:`);
      console.log(`   Total Sessions: ${stats.total_sessions}`);
      console.log(`   Present: ${stats.present}, Late: ${stats.late}, Absent: ${stats.absent}, Excused: ${stats.excused}`);
      console.log(`   Attendance Rate: ${attendanceRate}%`);
      console.log('');
    });
    
    console.log('🎯 Analysis 3: Real-time Data Freshness');
    console.log('=' .repeat(60));
    
    const now = new Date();
    const todayString = now.toISOString().split('T')[0];
    
    // Check today's attendance
    const todayAttendance = attendanceRecords.filter(record => 
      record.class_sessions.date === todayString
    );
    
    console.log('📅 Today\'s Attendance:', {
      date: todayString,
      records_count: todayAttendance.length,
      records: todayAttendance.map(record => ({
        class: record.class_sessions.class_instances.courses.name,
        status: record.status,
        scanned_at: record.scanned_at
      }))
    });
    
    // Check recent activity (last 24 hours)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const recentActivity = attendanceRecords.filter(record => 
      new Date(record.scanned_at) > yesterday
    );
    
    console.log('🕐 Recent Activity (Last 24 hours):', {
      records_count: recentActivity.length,
      records: recentActivity.map(record => ({
        class: record.class_sessions.class_instances.courses.name,
        status: record.status,
        scanned_at: record.scanned_at,
        time_ago: Math.round((now - new Date(record.scanned_at)) / (1000 * 60)) + ' minutes ago'
      }))
    });
    
    console.log('\n🎯 Analysis 4: Session Completion Impact on Data');
    console.log('=' .repeat(60));
    
    // Get sessions for this student's classes
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('class_instance_id')
      .eq('student_id', testUserId)
      .eq('status', 'active');
    
    if (enrollmentError) {
      console.log('❌ Error fetching enrollments:', enrollmentError.message);
      return;
    }
    
    const classInstanceIds = enrollments.map(e => e.class_instance_id);
    
    // Get all sessions for these classes
    const { data: sessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class_instances!inner(
          courses(code, name)
        )
      `)
      .in('class_instance_id', classInstanceIds)
      .order('date', { ascending: false });
    
    if (sessionsError) {
      console.log('❌ Error fetching sessions:', sessionsError.message);
      return;
    }
    
    console.log('📊 Session Status Analysis:', {
      total_sessions: sessions.length,
      completed_sessions: sessions.filter(s => s.status === 'completed').length,
      scheduled_sessions: sessions.filter(s => s.status === 'scheduled').length,
      active_sessions: sessions.filter(s => s.status === 'active').length,
      cancelled_sessions: sessions.filter(s => s.status === 'cancelled').length
    });
    
    // Check if sessions are properly completed
    const completedSessions = sessions.filter(s => s.status === 'completed');
    console.log('✅ Completed Sessions Sample (Last 5):');
    completedSessions.slice(0, 5).forEach(session => {
      console.log(`📅 ${session.date} - ${session.class_instances.courses.name} - Attendance: ${session.attendance_count} students`);
    });
    
    console.log('\n🎯 Analysis 5: Data Consistency Check');
    console.log('=' .repeat(60));
    
    // Check if attendance records match completed sessions
    const sessionIds = sessions.map(s => s.id);
    const attendanceBySession = {};
    
    attendanceRecords.forEach(record => {
      if (sessionIds.includes(record.session_id)) {
        if (!attendanceBySession[record.session_id]) {
          attendanceBySession[record.session_id] = [];
        }
        attendanceBySession[record.session_id].push(record);
      }
    });
    
    console.log('🔍 Data Consistency:', {
      total_sessions: sessions.length,
      sessions_with_attendance: Object.keys(attendanceBySession).length,
      total_attendance_records: attendanceRecords.length,
      records_in_sessions: Object.values(attendanceBySession).reduce((sum, records) => sum + records.length, 0)
    });
    
    // Check for sessions that should have attendance but don't
    const sessionsWithoutAttendance = sessions.filter(session => 
      session.status === 'completed' && !attendanceBySession[session.id]
    );
    
    console.log('⚠️ Sessions Without Attendance Records:', {
      count: sessionsWithoutAttendance.length,
      sessions: sessionsWithoutAttendance.slice(0, 3).map(s => ({
        date: s.date,
        class: s.class_instances.courses.name,
        status: s.status
      }))
    });
    
    console.log('\n🎯 Analysis 6: Real-time Update Simulation');
    console.log('=' .repeat(60));
    
    // Simulate what should happen when a new session completes
    const nowTime = new Date();
    const todaySessions = sessions.filter(s => s.date === todayString);
    
    console.log('📅 Today\'s Sessions Status:', {
      total: todaySessions.length,
      completed: todaySessions.filter(s => s.status === 'completed').length,
      scheduled: todaySessions.filter(s => s.status === 'scheduled').length,
      active: todaySessions.filter(s => s.status === 'active').length
    });
    
    // Check if any sessions should be completed based on time
    const sessionsToComplete = todaySessions.filter(session => {
      if (session.status !== 'active') return false;
      const sessionEndTime = new Date(`${session.date}T${session.end_time}`);
      return nowTime > sessionEndTime;
    });
    
    console.log('⏰ Sessions That Should Be Completed:', {
      count: sessionsToComplete.length,
      sessions: sessionsToComplete.map(s => ({
        class: s.class_instances.courses.name,
        end_time: s.end_time,
        current_time: nowTime.toLocaleTimeString(),
        overdue_minutes: Math.floor((nowTime - new Date(`${s.date}T${s.end_time}`)) / (1000 * 60))
      }))
    });
    
    console.log('\n✅ Data Accuracy Analysis Complete!');
    console.log('\n📋 Summary:');
    console.log(`- Overall Attendance: ${overallAttendance}% (${presentCount + lateCount + excusedCount}/${totalRecords})`);
    console.log(`- Total Classes: ${Object.keys(classStats).length}`);
    console.log(`- Today's Records: ${todayAttendance.length}`);
    console.log(`- Recent Activity: ${recentActivity.length} records in last 24h`);
    console.log(`- Sessions Status: ${sessions.filter(s => s.status === 'completed').length}/${sessions.length} completed`);
    console.log(`- Data Consistency: ${Object.keys(attendanceBySession).length}/${sessions.length} sessions have attendance`);
    
    // Final assessment
    console.log('\n🎯 Final Assessment:');
    if (overallAttendance > 0) {
      console.log('✅ Attendance statistics are being calculated and updated');
    } else {
      console.log('❌ Attendance statistics are not being calculated properly');
    }
    
    if (recentActivity.length > 0) {
      console.log('✅ System is receiving real-time attendance updates');
    } else {
      console.log('⚠️ No recent activity - may indicate system is not actively used');
    }
    
    if (sessionsWithoutAttendance.length === 0) {
      console.log('✅ All completed sessions have attendance records');
    } else {
      console.log('⚠️ Some completed sessions are missing attendance records');
    }
    
  } catch (error) {
    console.error('❌ Analysis Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run analysis
analyzeAttendanceAccuracy().catch(error => {
  console.error('❌ Analysis Suite Error:', error);
  process.exit(1);
});
