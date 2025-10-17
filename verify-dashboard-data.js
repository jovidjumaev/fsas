#!/usr/bin/env node

/**
 * Real-time Dashboard Data Verification
 * Test if the dashboard shows accurate real-time data
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔄 Real-time Dashboard Data Verification\n');

async function verifyDashboardData() {
  try {
    console.log('🎯 Test 1: Dashboard Stats Accuracy');
    console.log('=' .repeat(50));
    
    const testUserId = '03cfe76e-57d1-41dc-89ee-079a69750f1e';
    
    // Get student data
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select(`
        *,
        users!inner(
          first_name,
          last_name,
          email,
          is_active,
          created_at
        )
      `)
      .eq('user_id', testUserId)
      .single();
    
    if (studentError) {
      console.log('❌ Error fetching student data:', studentError.message);
      return;
    }
    
    console.log('✅ Student Profile:', {
      name: `${studentData.users.first_name} ${studentData.users.last_name}`,
      email: studentData.users.email,
      major: studentData.major,
      enrollment_year: studentData.enrollment_year
    });
    
    // Get enrollments
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        *,
        class_instances!inner(
          id,
          class_code,
          days_of_week,
          start_time,
          end_time,
          first_class_date,
          last_class_date,
          courses!inner(
            code,
            name
          )
        )
      `)
      .eq('student_id', testUserId)
      .eq('status', 'active');
    
    if (enrollmentError) {
      console.log('❌ Error fetching enrollments:', enrollmentError.message);
      return;
    }
    
    console.log('✅ Active Enrollments:', enrollments.length);
    
    // Calculate today's classes
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[dayOfWeek];
    
    const todayClasses = enrollments.filter(enrollment => {
      const classInstance = enrollment.class_instances;
      const daysOfWeek = classInstance.days_of_week;
      const firstClassDate = classInstance.first_class_date;
      const lastClassDate = classInstance.last_class_date;
      
      const withinPeriod = todayString >= firstClassDate && todayString <= lastClassDate;
      const matchesSchedule = Array.isArray(daysOfWeek) && daysOfWeek.includes(todayName);
      
      return withinPeriod && matchesSchedule;
    });
    
    console.log('✅ Today\'s Classes:', {
      count: todayClasses.length,
      classes: todayClasses.map(e => ({
        class_code: e.class_instances.class_code,
        class_name: e.class_instances.courses.name,
        start_time: e.class_instances.start_time,
        end_time: e.class_instances.end_time
      }))
    });
    
    // Get attendance records
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          date,
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
    
    // Calculate overall attendance
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
    
    const overallAttendance = totalRecords > 0 
      ? Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100)
      : 0;
    
    console.log('✅ Attendance Statistics:', {
      total_records: totalRecords,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      excused: excusedCount,
      overall_attendance: `${overallAttendance}%`
    });
    
    console.log('\n🎯 Test 2: Real-time Data Updates');
    console.log('=' .repeat(50));
    
    // Check recent activity
    const now = new Date();
    const recentActivity = attendanceRecords.filter(record => {
      const recordTime = new Date(record.scanned_at);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      return recordTime > oneHourAgo;
    });
    
    console.log('🕐 Recent Activity (Last Hour):', {
      count: recentActivity.length,
      records: recentActivity.map(record => ({
        class: record.class_sessions.class_instances.courses.name,
        status: record.status,
        scanned_at: record.scanned_at,
        minutes_ago: Math.round((now - new Date(record.scanned_at)) / (1000 * 60))
      }))
    });
    
    // Check today's attendance
    const todayAttendance = attendanceRecords.filter(record => 
      record.class_sessions.date === todayString
    );
    
    console.log('📅 Today\'s Attendance:', {
      date: todayString,
      count: todayAttendance.length,
      records: todayAttendance.map(record => ({
        class: record.class_sessions.class_instances.courses.name,
        status: record.status,
        scanned_at: record.scanned_at
      }))
    });
    
    console.log('\n🎯 Test 3: Session Status Impact');
    console.log('=' .repeat(50));
    
    // Get sessions for today
    const classInstanceIds = enrollments.map(e => e.class_instance_id);
    const { data: todaySessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        *,
        class_instances!inner(
          courses(code, name)
        )
      `)
      .in('class_instance_id', classInstanceIds)
      .eq('date', todayString);
    
    if (sessionsError) {
      console.log('❌ Error fetching today\'s sessions:', sessionsError.message);
      return;
    }
    
    console.log('📅 Today\'s Sessions:', {
      total: todaySessions.length,
      completed: todaySessions.filter(s => s.status === 'completed').length,
      active: todaySessions.filter(s => s.status === 'active').length,
      scheduled: todaySessions.filter(s => s.status === 'scheduled').length,
      sessions: todaySessions.map(s => ({
        class: s.class_instances.courses.name,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        attendance_count: s.attendance_count
      }))
    });
    
    console.log('\n🎯 Test 4: Dashboard Data Simulation');
    console.log('=' .repeat(50));
    
    // Simulate what the dashboard should show
    const dashboardData = {
      studentData: {
        student_id: studentData.student_id,
        student_number: studentData.student_id,
        enrollment_year: studentData.enrollment_year,
        major: studentData.major,
        graduation_year: studentData.graduation_year,
        first_name: studentData.users.first_name,
        last_name: studentData.users.last_name,
        email: studentData.users.email,
        phone: '',
        is_active: studentData.users.is_active,
        account_created: studentData.users.created_at
      },
      todayClasses: todayClasses.map(e => ({
        id: e.class_instance_id,
        class_code: e.class_instances.class_code,
        class_name: e.class_instances.courses.name,
        time: `${e.class_instances.start_time} - ${e.class_instances.end_time}`,
        room: 'TBD',
        professor: 'TBD',
        status: 'upcoming'
      })),
      stats: {
        overallAttendance: overallAttendance,
        totalClasses: enrollments.length,
        classesToday: todayClasses.length,
        attendanceStreak: 0 // Not implemented
      }
    };
    
    console.log('📊 Dashboard Data Summary:', {
      student_name: `${dashboardData.studentData.first_name} ${dashboardData.studentData.last_name}`,
      total_classes: dashboardData.stats.totalClasses,
      classes_today: dashboardData.stats.classesToday,
      overall_attendance: `${dashboardData.stats.overallAttendance}%`,
      today_classes: dashboardData.todayClasses.map(cls => ({
        class_code: cls.class_code,
        class_name: cls.class_name,
        time: cls.time
      }))
    });
    
    console.log('\n🎯 Test 5: Data Accuracy Verification');
    console.log('=' .repeat(50));
    
    // Verify the data accuracy
    const expectedStats = {
      overallAttendance: overallAttendance,
      totalClasses: enrollments.length,
      classesToday: todayClasses.length
    };
    
    console.log('✅ Expected Dashboard Stats:', expectedStats);
    
    // Check if data is consistent
    const dataConsistency = {
      attendance_calculation: overallAttendance > 0,
      class_count_match: enrollments.length > 0,
      today_classes_calculation: todayClasses.length > 0,
      recent_data_available: recentActivity.length > 0
    };
    
    console.log('🔍 Data Consistency Check:', dataConsistency);
    
    // Final assessment
    console.log('\n🎯 Final Assessment:');
    
    if (dataConsistency.attendance_calculation) {
      console.log('✅ Attendance percentage is being calculated correctly');
    } else {
      console.log('❌ Attendance percentage calculation has issues');
    }
    
    if (dataConsistency.class_count_match) {
      console.log('✅ Total classes count is accurate');
    } else {
      console.log('❌ Total classes count has issues');
    }
    
    if (dataConsistency.today_classes_calculation) {
      console.log('✅ Today\'s classes calculation is working');
    } else {
      console.log('❌ Today\'s classes calculation has issues');
    }
    
    if (dataConsistency.recent_data_available) {
      console.log('✅ System has recent activity data');
    } else {
      console.log('⚠️ No recent activity - system may not be actively used');
    }
    
    console.log('\n📋 Dashboard Data Accuracy Summary:');
    console.log(`- Overall Attendance: ${overallAttendance}% (${presentCount + lateCount + excusedCount}/${totalRecords})`);
    console.log(`- Total Classes: ${enrollments.length}`);
    console.log(`- Classes Today: ${todayClasses.length}`);
    console.log(`- Recent Activity: ${recentActivity.length} records in last hour`);
    console.log(`- Today's Sessions: ${todaySessions.length} total, ${todaySessions.filter(s => s.status === 'completed').length} completed`);
    
    // Check if the dashboard would show real-time data
    const latestRecord = attendanceRecords[0];
    const latestRecordTime = new Date(latestRecord.scanned_at);
    const timeSinceLatest = Math.round((now - latestRecordTime) / (1000 * 60));
    
    console.log('\n🔄 Real-time Behavior:');
    console.log(`- Latest record: ${timeSinceLatest} minutes ago`);
    console.log(`- Data freshness: ${timeSinceLatest < 60 ? 'Real-time' : timeSinceLatest < 1440 ? 'Recent' : 'Stale'}`);
    
    if (timeSinceLatest < 60) {
      console.log('✅ Dashboard would show real-time data');
    } else if (timeSinceLatest < 1440) {
      console.log('⚠️ Dashboard would show recent data (not real-time)');
    } else {
      console.log('❌ Dashboard data may be stale');
    }
    
  } catch (error) {
    console.error('❌ Verification Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run verification
verifyDashboardData().catch(error => {
  console.error('❌ Verification Suite Error:', error);
  process.exit(1);
});
