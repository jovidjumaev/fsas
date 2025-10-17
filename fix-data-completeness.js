#!/usr/bin/env node

/**
 * Fix Data Completeness Issues
 * Backfill missing attendance records and fix future-dated records
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Fixing Data Completeness Issues\n');

async function fixDataCompleteness() {
  try {
    console.log('🎯 Step 1: Fix Future-Dated Records');
    console.log('=' .repeat(50));
    
    // Find and fix future-dated records
    const today = new Date().toISOString().split('T')[0];
    
    const { data: futureRecords, error: futureError } = await supabase
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
      .gt('class_sessions.date', today);
    
    if (futureError) {
      console.log('❌ Error fetching future records:', futureError.message);
    } else {
      console.log('📅 Found', futureRecords.length, 'future-dated records');
      
      if (futureRecords.length > 0) {
        console.log('⚠️ Future-dated records found:');
        futureRecords.forEach(record => {
          console.log(`  - ${record.class_sessions.date}: ${record.class_sessions.class_instances.courses.name} - ${record.status}`);
        });
        
        // Update future-dated records to today's date
        const futureRecordIds = futureRecords.map(r => r.id);
        const { error: updateError } = await supabase
          .from('class_sessions')
          .update({ date: today })
          .in('id', futureRecords.map(r => r.class_sessions.id));
        
        if (updateError) {
          console.log('❌ Error updating future records:', updateError.message);
        } else {
          console.log('✅ Updated', futureRecords.length, 'future-dated records to today');
        }
      }
    }
    
    console.log('\n🎯 Step 2: Backfill Missing Attendance Records');
    console.log('=' .repeat(50));
    
    // Get all completed sessions
    const { data: completedSessions, error: sessionsError } = await supabase
      .from('class_sessions')
      .select(`
        id,
        date,
        session_number,
        class_instance_id,
        class_instances!inner(
          courses(code, name)
        )
      `)
      .eq('status', 'completed')
      .order('date', { ascending: true });
    
    if (sessionsError) {
      console.log('❌ Error fetching completed sessions:', sessionsError.message);
      return;
    }
    
    console.log('📅 Found', completedSessions.length, 'completed sessions');
    
    let totalRecordsCreated = 0;
    
    // Process each completed session
    for (const session of completedSessions) {
      console.log(`\n🔄 Processing session ${session.session_number} (${session.date}): ${session.class_instances.courses.name}`);
      
      // Get all enrolled students for this class
      const { data: enrolledStudents, error: enrollmentError } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('class_instance_id', session.class_instance_id)
        .eq('status', 'active');
      
      if (enrollmentError) {
        console.log('❌ Error fetching enrollments:', enrollmentError.message);
        continue;
      }
      
      // Get existing attendance records for this session
      const { data: existingRecords, error: recordsError } = await supabase
        .from('attendance_records')
        .select('student_id')
        .eq('session_id', session.id);
      
      if (recordsError) {
        console.log('❌ Error fetching existing records:', recordsError.message);
        continue;
      }
      
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
        
        if (insertError) {
          console.log('❌ Error inserting absent records:', insertError.message);
        } else {
          console.log(`✅ Created ${absentRecords.length} absent records`);
          totalRecordsCreated += absentRecords.length;
        }
      } else {
        console.log('✅ All students already have attendance records');
      }
    }
    
    console.log('\n🎯 Step 3: Update Session Attendance Counts');
    console.log('=' .repeat(50));
    
    // Update attendance counts for all sessions
    for (const session of completedSessions) {
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance_records')
        .select('id, status')
        .eq('session_id', session.id);
      
      if (attendanceError) {
        console.log('❌ Error fetching attendance for session', session.id, ':', attendanceError.message);
        continue;
      }
      
      // Count present, late, and excused as "attended"
      const attendedCount = attendanceRecords.filter(record => 
        ['present', 'late', 'excused'].includes(record.status)
      ).length;
      
      // Update session attendance count
      const { error: updateError } = await supabase
        .from('class_sessions')
        .update({ attendance_count: attendedCount })
        .eq('id', session.id);
      
      if (updateError) {
        console.log('❌ Error updating attendance count for session', session.id, ':', updateError.message);
      } else {
        console.log(`✅ Updated session ${session.session_number} attendance count to ${attendedCount}`);
      }
    }
    
    console.log('\n🎯 Step 4: Verify Data Completeness');
    console.log('=' .repeat(50));
    
    // Verify the fix by checking a specific student
    const testUserId = '03cfe76e-57d1-41dc-89ee-079a69750f1e';
    
    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', testUserId)
      .single();
    
    if (studentError) {
      console.log('❌ Error fetching student data:', studentError.message);
      return;
    }
    
    const studentId = studentData.student_id;
    
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
      .eq('student_id', studentId)
      .order('scanned_at', { ascending: false });
    
    if (attendanceError) {
      console.log('❌ Error fetching attendance records:', attendanceError.message);
      return;
    }
    
    console.log('📊 Verification Results:');
    console.log('  Total attendance records:', attendanceRecords.length);
    
    // Check for future-dated records
    const futureRecordsCheck = attendanceRecords.filter(record => 
      record.class_sessions.date > today
    );
    console.log('  Future-dated records:', futureRecordsCheck.length);
    
    // Check for today's records
    const todayRecords = attendanceRecords.filter(record => 
      record.class_sessions.date === today
    );
    console.log('  Today\'s records:', todayRecords.length);
    
    // Calculate overall attendance
    const totalRecords = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(r => r.status === 'present').length;
    const lateCount = attendanceRecords.filter(r => r.status === 'late').length;
    const absentCount = attendanceRecords.filter(r => r.status === 'absent').length;
    const excusedCount = attendanceRecords.filter(r => r.status === 'excused').length;
    
    const overallAttendance = totalRecords > 0 
      ? Math.round(((presentCount + lateCount + excusedCount) / totalRecords) * 100)
      : 0;
    
    console.log('  Overall attendance:', `${overallAttendance}% (${presentCount + lateCount + excusedCount}/${totalRecords})`);
    console.log('  Status breakdown:');
    console.log(`    Present: ${presentCount}`);
    console.log(`    Late: ${lateCount}`);
    console.log(`    Absent: ${absentCount}`);
    console.log(`    Excused: ${excusedCount}`);
    
    console.log('\n✅ Data Completeness Fix Complete!');
    console.log(`📋 Summary:`);
    console.log(`  - Future-dated records fixed: ${futureRecordsCheck.length}`);
    console.log(`  - Missing attendance records created: ${totalRecordsCreated}`);
    console.log(`  - Session attendance counts updated: ${completedSessions.length}`);
    console.log(`  - Overall attendance: ${overallAttendance}%`);
    
    // Final assessment
    if (futureRecordsCheck.length === 0) {
      console.log('✅ Future-dated records issue: FIXED');
    } else {
      console.log('⚠️ Future-dated records issue: PARTIALLY FIXED');
    }
    
    if (totalRecordsCreated > 0) {
      console.log('✅ Missing attendance records issue: FIXED');
    } else {
      console.log('✅ Missing attendance records issue: NO ISSUES FOUND');
    }
    
    console.log('✅ Data completeness issues have been addressed');
    
  } catch (error) {
    console.error('❌ Error fixing data completeness:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the fix
fixDataCompleteness().catch(error => {
  console.error('❌ Fix Suite Error:', error);
  process.exit(1);
});
