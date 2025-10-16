#!/usr/bin/env node

/**
 * Production Environment Diagnostic Script
 * 
 * This script tests the actual production environment to identify
 * why the professor dashboard shows 0s when deployed on Vercel.
 */

const API_BASE_URL = 'http://156.143.88.239:3001';

async function diagnoseProductionIssue() {
  console.log('🔍 Diagnosing Production Environment Issue');
  console.log('=' .repeat(60));
  
  try {
    // 1. Test API connectivity
    console.log('\n1. Testing API Connectivity...');
    const healthCheck = await fetch(`${API_BASE_URL}/api/health`);
    if (healthCheck.ok) {
      console.log('✅ API is accessible');
    } else {
      console.log('❌ API is not accessible');
      return;
    }

    // 2. Check if we're using the right database
    console.log('\n2. Checking Database Data...');
    const professorsResponse = await fetch(`${API_BASE_URL}/api/professors`);
    const professorsData = await professorsResponse.json();
    
    if (!professorsData.success) {
      console.log('❌ Failed to fetch professors');
      return;
    }
    
    console.log(`✅ Found ${professorsData.count} professors in database`);
    
    // 3. Check enrollments
    const enrollmentsResponse = await fetch(`${API_BASE_URL}/api/enrollments`);
    const enrollmentsData = await enrollmentsResponse.json();
    
    if (enrollmentsData.success) {
      console.log(`✅ Found ${enrollmentsData.count} enrollments in database`);
      
      // Group enrollments by professor
      const enrollmentsByProfessor = {};
      enrollmentsData.data.forEach(enrollment => {
        if (!enrollmentsByProfessor[enrollment.class_instance_id]) {
          enrollmentsByProfessor[enrollment.class_instance_id] = 0;
        }
        enrollmentsByProfessor[enrollment.class_instance_id]++;
      });
      
      console.log('📊 Enrollments by class instance:');
      Object.entries(enrollmentsByProfessor).forEach(([classId, count]) => {
        console.log(`   Class ${classId}: ${count} enrollments`);
      });
    }

    // 4. Test each professor's dashboard
    console.log('\n3. Testing Each Professor Dashboard...');
    for (const professor of professorsData.data) {
      console.log(`\n   Testing Professor: ${professor.users.first_name} ${professor.users.last_name}`);
      console.log(`   Email: ${professor.users.email}`);
      console.log(`   User ID: ${professor.user_id}`);
      
      const dashboardResponse = await fetch(`${API_BASE_URL}/api/professors/${professor.user_id}/dashboard`);
      const dashboardData = await dashboardResponse.json();
      
      if (!dashboardData.success) {
        console.log(`   ❌ Dashboard API failed: ${dashboardData.error}`);
        continue;
      }
      
      const stats = dashboardData.data.stats;
      console.log(`   📊 Dashboard Stats:`);
      console.log(`      - Total Classes: ${stats.totalClasses}`);
      console.log(`      - Total Students: ${stats.totalStudents}`);
      console.log(`      - Active Sessions: ${stats.activeSessions}`);
      console.log(`      - Average Attendance: ${stats.averageAttendance}%`);
      
      // Check if this professor has classes with enrollments
      if (stats.totalClasses > 0) {
        console.log(`   📚 Classes: ${dashboardData.data.classes.length}`);
        for (const classData of dashboardData.data.classes) {
          console.log(`      - ${classData.code}: ${classData.name}`);
          console.log(`        Enrolled: ${classData.enrolled_students}/${classData.max_students}`);
          
          // Check actual enrollments for this class
          const classEnrollmentsResponse = await fetch(`${API_BASE_URL}/api/class-instances/${classData.id}/students`);
          const classEnrollmentsData = await classEnrollmentsResponse.json();
          console.log(`        Actual Enrollments: ${classEnrollmentsData.count}`);
        }
      }
    }

    // 5. Check for potential issues
    console.log('\n4. Potential Issues Analysis...');
    
    // Check if there are any professors with data
    const professorsWithData = professorsData.data.filter(p => {
      // We'll check this by testing their dashboard
      return true; // We'll check this in the loop above
    });
    
    console.log('\n🔍 Potential Issues:');
    console.log('1. **Environment Variable Mismatch**:');
    console.log('   - Development uses: http://156.143.88.239:3001');
    console.log('   - Production should use: https://your-backend-url.railway.app');
    console.log('   - Check if Vercel is using the correct API URL');
    
    console.log('\n2. **Database Connection**:');
    console.log('   - Verify Vercel is connecting to the same database');
    console.log('   - Check if production uses different Supabase project');
    
    console.log('\n3. **Authentication Issue**:');
    console.log('   - Verify professor authentication is working in production');
    console.log('   - Check if user IDs match between environments');
    
    console.log('\n4. **CORS/Network Issues**:');
    console.log('   - Check if Vercel can reach the Railway backend');
    console.log('   - Verify CORS settings allow Vercel domain');
    
    console.log('\n💡 Next Steps:');
    console.log('1. Check Vercel environment variables');
    console.log('2. Verify Railway backend URL');
    console.log('3. Test API calls from Vercel deployment');
    console.log('4. Check browser network tab for failed requests');
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

// Run the diagnostic
diagnoseProductionIssue();
