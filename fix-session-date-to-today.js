const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSessionDateToToday() {
  console.log('🔧 Fixing session date to today...');
  
  try {
    const sessionId = '75455c0a-df33-49fe-aeb3-92c190a3ac2c';
    
    // Get current Eastern date
    const now = new Date();
    const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const todayEastern = easternTime.toISOString().split('T')[0];
    
    console.log(`📅 Current Eastern date: ${todayEastern}`);
    
    // Update the session date to today
    const { error: updateError } = await supabase
      .from('class_sessions')
      .update({ 
        date: todayEastern,
        status: 'active' // Reset to active so it can be completed
      })
      .eq('id', sessionId);
    
    if (updateError) {
      console.error(`❌ Failed to update session: ${updateError.message}`);
    } else {
      console.log(`✅ Updated session date to ${todayEastern} and reset status to active`);
      
      // Verify the update
      const { data: session, error: fetchError } = await supabase
        .from('class_sessions')
        .select('id, date, start_time, end_time, status')
        .eq('id', sessionId)
        .single();
      
      if (fetchError) {
        console.error(`❌ Failed to fetch updated session: ${fetchError.message}`);
      } else {
        console.log(`📋 Updated session details:`);
        console.log(`   Date: ${session.date}`);
        console.log(`   Start Time: ${session.start_time}`);
        console.log(`   End Time: ${session.end_time}`);
        console.log(`   Status: ${session.status}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixSessionDateToToday();
