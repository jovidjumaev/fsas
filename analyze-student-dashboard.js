#!/usr/bin/env node

/**
 * Comprehensive Student Dashboard Data Analysis
 * Tests the logic and accuracy of student dashboard data without requiring API server
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔍 Student Dashboard Data Analysis\n');

async function analyzeStudentData() {
  try {
    console.log('📊 Analysis 1: Student Data Structure');
    console.log('=' .repeat(60));
    
    // Get test student
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
      .eq('student_id', '5002378')
      .single();
    
    if (studentError) {
      console.log('❌ Student not found:', studentError.message);
      return;
    }
    
    console.log('✅ Student Profile:', {
      student_id: studentData.student_id,
      user_id: studentData.user_id,
      name: `${studentData.users.first_name} ${studentData.users.last_name}`,
      email: studentData.users.email,
      major: studentData.major,
      enrollment_year: studentData.enrollment_year,
      graduation_year: studentData.graduation_year,
      is_active: studentData.users.is_active
    });
    
    console.log('\n📚 Analysis 2: Class Enrollments and Schedule Logic');
    console.log('=' .repeat(60));
    
    // Get enrollments with class details
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
          room_location,
          courses!inner(
            code,
            name,
            description,
            credits
          ),
          academic_periods!inner(
            name,
            year,
            semester
          )
        )
      `)
      .eq('student_id', studentData.user_id)
      .eq('status', 'active');
    
    if (enrollmentError) {
      console.log('❌ Error fetching enrollments:', enrollmentError.message);
      return;
    }
    
    console.log('✅ Active Enrollments:', {
      count: enrollments.length,
      classes: enrollments.map(e => ({
        class_code: e.class_instances.class_code,
        course_name: e.class_instances.courses.name,
        days_of_week: e.class_instances.days_of_week,
        start_time: e.class_instances.start_time,
        end_time: e.class_instances.end_time,
        room: e.class_instances.room_location,
        period: e.class_instances.academic_periods.name
      }))
    });
    
    console.log('\n📅 Analysis 3: Today\'s Classes Calculation');
    console.log('=' .repeat(60));
    
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    const dayOfWeek = today.getDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayName = dayNames[dayOfWeek];
    
    console.log('📅 Today\'s Information:', {
      date: todayString,
      day: todayName,
      dayOfWeek: dayOfWeek
    });
    
    // Calculate today's classes
    const todayClasses = enrollments.filter(enrollment => {
      const classInstance = enrollment.class_instances;
      const daysOfWeek = classInstance.days_of_week;
      const firstClassDate = classInstance.first_class_date;
      const lastClassDate = classInstance.last_class_date;
      
      // Check if today is within the class period
      const withinPeriod = todayString >= firstClassDate && todayString <= lastClassDate;
      
      // Check if today matches the class schedule
      let matchesSchedule = false;
      if (Array.isArray(daysOfWeek)) {
        matchesSchedule = daysOfWeek.includes(todayName);
      }
      
      return withinPeriod && matchesSchedule;
    });
    
    console.log('📚 Classes Meeting Today:', {
      count: todayClasses.length,
      classes: todayClasses.map(e => ({
        class_code: e.class_instances.class_code,
        course_name: e.class_instances.courses.name,
        start_time: e.class_instances.start_time,
        end_time: e.class_instances.end_time,
        room: e.class_instances.room_location,
        days_of_week: e.class_instances.days_of_week
      }))
    });
    
    console.log('\n📊 Analysis 4: Attendance Statistics Calculation');
    console.log('=' .repeat(60));
    
    // Get attendance records
    const { data: attendanceRecords, error: attendanceError } = await supabase
      .from('attendance_records')
      .select(`
        *,
        class_sessions!inner(
          date,
          class_instance_id,
          class_instances!inner(
            courses(code, name)
          )
        )
      `)
      .eq('student_id', studentData.user_id)
      .order('scanned_at', { ascending: false });
    
    if (attendanceError) {
      console.log('❌ Error fetching attendance records:', attendanceError.message);
      return;
    }
    
    console.log('✅ Attendance Records:', {
      total_records: attendanceRecords.length,
      recent_records: attendanceRecords.slice(0, 5).map(record => ({
        date: record.class_sessions.date,
        status: record.status,
        class_name: record.class_sessions.class_instances.courses.name,
        scanned_at: record.scanned_at
      }))
    });
    
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
    
    console.log('📈 Attendance Statistics by Class:', Object.values(classStats).map(stats => ({
      class_code: stats.class_code,
      class_name: stats.class_name,
      total_sessions: stats.total_sessions,
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
      excused: stats.excused,
      attendance_rate: stats.total_sessions > 0 
        ? Math.round(((stats.present + stats.late + stats.excused) / stats.total_sessions) * 100)
        : 0
    })));
    
    // Calculate overall statistics
    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
    
    const overallAttendance = totalSessions > 0 
      ? Math.round(((presentCount + lateCount + excusedCount) / totalSessions) * 100)
      : 0;
    
    console.log('📊 Overall Statistics:', {
      total_sessions: totalSessions,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      excused: excusedCount,
      overall_attendance: `${overallAttendance}%`
    });
    
    console.log('\n🔄 Analysis 5: Session Status and Completion Logic');
    console.log('=' .repeat(60));
    
    // Get sessions for enrolled classes
    const classInstanceIds = enrollments.map(e => e.class_instance_id);
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
    
    console.log('✅ Class Sessions:', {
      total_sessions: sessions.length,
      recent_sessions: sessions.slice(0, 10).map(session => ({
        id: session.id,
        date: session.date,
        start_time: session.start_time,
        end_time: session.end_time,
        status: session.status,
        is_active: session.is_active,
        attendance_count: session.attendance_count,
        class_name: session.class_instances.courses.name
      }))
    });
    
    // Analyze session statuses
    const sessionStatuses = sessions.reduce((acc, session) => {
      acc[session.status] = (acc[session.status] || 0) + 1;
      return acc;
    }, {});
    
    console.log('📊 Session Status Distribution:', sessionStatuses);
    
    // Check for sessions that should be completed
    const now = new Date();
    const activeSessions = sessions.filter(session => session.status === 'active');
    const sessionsToComplete = activeSessions.filter(session => {
      const sessionEndTime = new Date(`${session.date}T${session.end_time}`);
      return now > sessionEndTime;
    });
    
    console.log('⏰ Session Completion Analysis:', {
      active_sessions: activeSessions.length,
      sessions_to_complete: sessionsToComplete.length,
      overdue_sessions: sessionsToComplete.map(session => {
        const sessionEndTime = new Date(`${session.date}T${session.end_time}`);
        const overdueMinutes = Math.floor((now - sessionEndTime) / (1000 * 60));
        return {
          id: session.id,
          class_name: session.class_instances.courses.name,
          end_time: session.end_time,
          overdue_minutes: overdueMinutes
        };
      })
    });
    
    console.log('\n📱 Analysis 6: Today\'s Attendance Check');
    console.log('=' .repeat(60));
    
    // Check today's attendance
    const todayAttendance = attendanceRecords.filter(record => 
      record.class_sessions.date === todayString
    );
    
    console.log('📝 Today\'s Attendance:', {
      count: todayAttendance.length,
      records: todayAttendance.map(record => ({
        status: record.status,
        class_name: record.class_sessions.class_instances.courses.name,
        scanned_at: record.scanned_at
      }))
    });
    
    // Check if student has attendance for all today's classes
    const todayClassCodes = todayClasses.map(e => e.class_instances.class_code);
    const attendedTodayClassCodes = todayAttendance.map(record => 
      record.class_sessions.class_instances.courses.code
    );
    
    const missingAttendance = todayClassCodes.filter(classCode => 
      !attendedTodayClassCodes.includes(classCode)
    );
    
    console.log('✅ Attendance Coverage:', {
      classes_today: todayClassCodes.length,
      attended_classes: attendedTodayClassCodes.length,
      missing_attendance: missingAttendance.length,
      missing_classes: missingAttendance
    });
    
    console.log('\n🎯 Analysis 7: Dashboard Data Accuracy');
    console.log('=' .repeat(60));
    
    // Simulate dashboard data calculation
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
        room: e.class_instances.room_location,
        professor: 'TBD', // Would need to fetch professor data
        status: 'upcoming' // Would need to check session status
      })),
      stats: {
        overallAttendance: overallAttendance,
        totalClasses: enrollments.length,
        classesToday: todayClasses.length,
        attendanceStreak: 0 // Would need to calculate streak
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
        time: cls.time,
        room: cls.room
      }))
    });
    
    console.log('\n✅ Analysis Complete!');
    console.log('\n📋 Key Findings:');
    console.log(`- Student has ${enrollments.length} active enrollments`);
    console.log(`- ${todayClasses.length} classes meet today`);
    console.log(`- Overall attendance rate: ${overallAttendance}%`);
    console.log(`- ${attendanceRecords.length} total attendance records`);
    console.log(`- ${sessions.length} total class sessions`);
    console.log(`- ${sessionsToComplete.length} sessions need completion`);
    
  } catch (error) {
    console.error('❌ Analysis Error:', error);
    console.error('Stack:', error.stack);
  }
}

// Run analysis
analyzeStudentData().catch(error => {
  console.error('❌ Analysis Suite Error:', error);
  process.exit(1);
});
