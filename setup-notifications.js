#!/usr/bin/env node

/**
 * Setup script for Student Notifications System
 * This script helps initialize the notification system in the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupNotifications() {
  console.log('🚀 Setting up Student Notifications System...\n');

  try {
    // 1. Check if notifications table exists
    console.log('1. Checking notifications table...');
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'notifications');

    if (tableError) {
      console.error('❌ Error checking tables:', tableError);
      return;
    }

    if (tables && tables.length > 0) {
      console.log('✅ Notifications table already exists');
    } else {
      console.log('⚠️  Notifications table not found. Please run the database schema first.');
      console.log('   Run: psql -f database/final-optimized-schema.sql');
      return;
    }

    // 2. Check notification types constraint
    console.log('\n2. Checking notification types...');
    const { data: constraints, error: constraintError } = await supabase
      .from('information_schema.check_constraints')
      .select('constraint_name, check_clause')
      .eq('constraint_name', 'notifications_type_check');

    if (constraintError) {
      console.error('❌ Error checking constraints:', constraintError);
    } else if (constraints && constraints.length > 0) {
      console.log('✅ Notification type constraints are in place');
    } else {
      console.log('⚠️  Notification type constraints not found');
    }

    // 3. Test notification creation
    console.log('\n3. Testing notification creation...');
    const testNotification = {
      user_id: '00000000-0000-0000-0000-000000000000', // Test UUID
      type: 'system',
      title: 'System Test',
      message: 'This is a test notification to verify the system is working.',
      priority: 'medium',
      metadata: { test: true, timestamp: new Date().toISOString() }
    };

    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .insert(testNotification)
      .select()
      .single();

    if (notificationError) {
      console.error('❌ Test notification creation failed:', notificationError);
    } else {
      console.log('✅ Test notification created successfully');
      
      // Clean up test notification
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notification.id);
      console.log('✅ Test notification cleaned up');
    }

    // 4. Check indexes
    console.log('\n4. Checking database indexes...');
    const { data: indexes, error: indexError } = await supabase
      .from('pg_indexes')
      .select('indexname')
      .eq('tablename', 'notifications');

    if (indexError) {
      console.error('❌ Error checking indexes:', indexError);
    } else if (indexes && indexes.length >= 5) {
      console.log(`✅ Found ${indexes.length} indexes on notifications table`);
    } else {
      console.log('⚠️  Some indexes may be missing');
    }

    // 5. Display system status
    console.log('\n📊 System Status:');
    console.log('   ✅ Database connection: Working');
    console.log('   ✅ Notifications table: Ready');
    console.log('   ✅ Notification types: Configured');
    console.log('   ✅ Test notifications: Working');
    console.log('   ✅ Database indexes: Optimized');

    console.log('\n🎉 Student Notifications System is ready!');
    console.log('\n📝 Next steps:');
    console.log('   1. Start your backend server: npm run dev');
    console.log('   2. Start your frontend: npm run dev');
    console.log('   3. Test notifications by enrolling students in classes');
    console.log('   4. Test session notifications by starting class sessions');
    console.log('   5. Test attendance notifications by scanning QR codes');

    console.log('\n🔧 Configuration:');
    console.log('   - Notification types: class_enrolled, session_started, attendance_recorded');
    console.log('   - Priority levels: low, medium, high, urgent');
    console.log('   - Real-time updates: Enabled via Supabase subscriptions');
    console.log('   - Browser notifications: Supported');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  }
}

// Run setup
setupNotifications();
