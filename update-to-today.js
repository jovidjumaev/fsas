const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateAttendanceToToday() {
  console.log('🚀 Updating attendance records to today...');

  try {
    const today = new Date().toISOString().split('T')[0];
    const testStudentUserId = '03cfe76e-57d1-41dc-89ee-079a69750f1e';
    
    console.log('📅 Today:', today);
    console.log('👨‍🎓 Student user_id:', testStudentUserId);

    // Update existing attendance records to today
    const { data: updatedRecords, error: updateError } = await supabase
      .from('attendance_records')
      .update({
        scanned_at: `${today}T09:00:00.000Z`
      })
      .eq('student_id', testStudentUserId)
      .select();

    if (updateError) {
      console.error('❌ Error updating attendance records:', updateError);
      return;
    }

    console.log('✅ Updated attendance records:', updatedRecords.length);

    // Also update the session date to today
    const { data: sessions, error: sessionError } = await supabase
      .from('class_sessions')
      .select('*')
      .eq('id', '51c4127b-1e67-4bac-9932-f7f61d52fb96')
      .single();

    if (sessions) {
      await supabase
        .from('class_sessions')
        .update({ date: today })
        .eq('id', '51c4127b-1e67-4bac-9932-f7f61d52fb96');
      
      console.log('✅ Updated session date to today');
    }

    // Test the stats API
    console.log('🧪 Testing stats API...');
    const statsResponse = await fetch('http://localhost:3001/api/attendance/student/5002378/today-stats');
    const stats = await statsResponse.json();
    
    console.log('📊 Today\'s stats:', JSON.stringify(stats, null, 2));

    console.log('🎉 Attendance records updated successfully!');
    console.log('\n📋 Summary:');
    console.log(`• Updated records: ${updatedRecords.length}`);
    console.log(`• Date: ${today}`);
    console.log(`• Present: ${stats.stats.present}`);
    console.log(`• Late: ${stats.stats.late}`);
    console.log(`• Total scans: ${stats.stats.scansToday}`);

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateAttendanceToToday().then(() => {
  console.log('\n✅ Done! Check the scan page now.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
