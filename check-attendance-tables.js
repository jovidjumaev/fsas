const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkAttendanceTables() {
  console.log('🔍 Checking attendance-related tables...\n');
  
  const possibleTables = ['attendance', 'attendance_records', 'attendance_data'];
  
  for (const tableName of possibleTables) {
    try {
      console.log(`\n📋 Checking ${tableName.toUpperCase()}:`);
      console.log('=' .repeat(40));
      
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`❌ Table ${tableName} does not exist`);
        } else {
          console.log(`❌ Error: ${error.message}`);
        }
      } else if (data && data.length > 0) {
        console.log(`✅ Table ${tableName} exists and has data:`);
        const record = data[0];
        Object.keys(record).forEach(key => {
          console.log(`  - ${key}: ${typeof record[key]} (${record[key]})`);
        });
      } else {
        console.log(`✅ Table ${tableName} exists but is empty`);
        
        // Try to get column info by attempting a simple insert
        console.log(`  🧪 Testing column structure...`);
        const testData = { test: 'value' };
        const { error: insertError } = await supabaseAdmin
          .from(tableName)
          .insert(testData);
        
        if (insertError) {
          console.log(`  📝 Insert error: ${insertError.message}`);
        }
      }
    } catch (err) {
      console.log(`❌ Exception for ${tableName}: ${err.message}`);
    }
  }
}

checkAttendanceTables();
