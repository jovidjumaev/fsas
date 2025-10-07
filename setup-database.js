const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupDatabase() {
  console.log('🚀 Setting up FSAS database with test data...');

  try {
    // 1. Create academic period
    console.log('📅 Creating academic period...');
    const { data: academicPeriod, error: periodError } = await supabase
      .from('academic_periods')
      .upsert({
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Fall 2025',
        year: 2025,
        semester: 'fall',
        start_date: '2025-08-15',
        end_date: '2025-12-15',
        is_current: true,
        is_active: true
      })
      .select()
      .single();

    if (periodError) {
      console.error('❌ Error creating academic period:', periodError);
    } else {
      console.log('✅ Academic period created:', academicPeriod.name);
    }

    // 2. Create departments
    console.log('🏫 Creating departments...');
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          code: 'CSC',
          name: 'Computer Science',
          description: 'Computer Science Department'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          code: 'MAT',
          name: 'Mathematics',
          description: 'Mathematics Department'
        }
      ])
      .select();

    if (deptError) {
      console.error('❌ Error creating departments:', deptError);
    } else {
      console.log('✅ Departments created:', departments.length);
    }

    // 3. Create courses
    console.log('📚 Creating courses...');
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440010',
          code: 'CSC-105',
          name: 'Introduction to Computer Science',
          description: 'Fundamental concepts of computer science',
          credits: 3,
          department_id: '550e8400-e29b-41d4-a716-446655440001'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440011',
          code: 'CSC-201',
          name: 'Data Structures',
          description: 'Advanced data structures and algorithms',
          credits: 4,
          department_id: '550e8400-e29b-41d4-a716-446655440001'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440012',
          code: 'MAT-201',
          name: 'Calculus I',
          description: 'Introduction to calculus',
          credits: 4,
          department_id: '550e8400-e29b-41d4-a716-446655440002'
        }
      ])
      .select();

    if (courseError) {
      console.error('❌ Error creating courses:', courseError);
    } else {
      console.log('✅ Courses created:', courses.length);
    }

    // 4. Create professors
    console.log('👨‍🏫 Creating professors...');
    const { data: professors, error: profError } = await supabase
      .from('users')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440020',
          email: 'prof.smith@furman.edu',
          first_name: 'John',
          last_name: 'Smith',
          role: 'professor',
          employee_id: 'EMP001'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440021',
          email: 'prof.jones@furman.edu',
          first_name: 'Sarah',
          last_name: 'Jones',
          role: 'professor',
          employee_id: 'EMP002'
        }
      ])
      .select();

    if (profError) {
      console.error('❌ Error creating professors:', profError);
    } else {
      console.log('✅ Professors created:', professors.length);
    }

    // 5. Create students
    console.log('👨‍🎓 Creating students...');
    const { data: students, error: studentError } = await supabase
      .from('users')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440030',
          email: 'student.doe@furman.edu',
          first_name: 'John',
          last_name: 'Doe',
          role: 'student',
          student_id: '5002378'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440031',
          email: 'student.wilson@furman.edu',
          first_name: 'Jane',
          last_name: 'Wilson',
          role: 'student',
          student_id: '5002379'
        }
      ])
      .select();

    if (studentError) {
      console.error('❌ Error creating students:', studentError);
    } else {
      console.log('✅ Students created:', students.length);
    }

    // 6. Create class instances
    console.log('🏫 Creating class instances...');
    const { data: classInstances, error: classError } = await supabase
      .from('class_instances')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440040',
          course_id: '550e8400-e29b-41d4-a716-446655440010',
          professor_id: '550e8400-e29b-41d4-a716-446655440020',
          academic_period_id: '550e8400-e29b-41d4-a716-446655440000',
          room_location: 'Riley Hall 101',
          max_students: 30,
          current_enrollment: 0,
          days_of_week: ['Monday', 'Wednesday', 'Friday'],
          start_time: '09:00:00',
          end_time: '09:50:00',
          first_class_date: '2025-08-15',
          last_class_date: '2025-12-15'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440041',
          course_id: '550e8400-e29b-41d4-a716-446655440011',
          professor_id: '550e8400-e29b-41d4-a716-446655440021',
          academic_period_id: '550e8400-e29b-41d4-a716-446655440000',
          room_location: 'Riley Hall 102',
          max_students: 25,
          current_enrollment: 0,
          days_of_week: ['Tuesday', 'Thursday'],
          start_time: '10:00:00',
          end_time: '11:15:00',
          first_class_date: '2025-08-15',
          last_class_date: '2025-12-15'
        }
      ])
      .select();

    if (classError) {
      console.error('❌ Error creating class instances:', classError);
    } else {
      console.log('✅ Class instances created:', classInstances.length);
    }

    // 7. Create enrollments
    console.log('📝 Creating enrollments...');
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .upsert([
        {
          id: '550e8400-e29b-41d4-a716-446655440050',
          student_id: '550e8400-e29b-41d4-a716-446655440030',
          class_instance_id: '550e8400-e29b-41d4-a716-446655440040',
          enrollment_date: '2025-08-01',
          status: 'active'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440051',
          student_id: '550e8400-e29b-41d4-a716-446655440030',
          class_instance_id: '550e8400-e29b-41d4-a716-446655440041',
          enrollment_date: '2025-08-01',
          status: 'active'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440052',
          student_id: '550e8400-e29b-41d4-a716-446655440031',
          class_instance_id: '550e8400-e29b-41d4-a716-446655440040',
          enrollment_date: '2025-08-01',
          status: 'active'
        }
      ])
      .select();

    if (enrollError) {
      console.error('❌ Error creating enrollments:', enrollError);
    } else {
      console.log('✅ Enrollments created:', enrollments.length);
    }

    // Update enrollment counts
    console.log('📊 Updating enrollment counts...');
    const { error: updateError } = await supabase
      .from('class_instances')
      .update({ current_enrollment: 2 })
      .eq('id', '550e8400-e29b-41d4-a716-446655440040');

    const { error: updateError2 } = await supabase
      .from('class_instances')
      .update({ current_enrollment: 1 })
      .eq('id', '550e8400-e29b-41d4-a716-446655440041');

    if (updateError || updateError2) {
      console.error('❌ Error updating enrollment counts:', updateError || updateError2);
    } else {
      console.log('✅ Enrollment counts updated');
    }

    console.log('🎉 Database setup completed successfully!');
    console.log('\n📋 Test Data Summary:');
    console.log('• Academic Period: Fall 2025');
    console.log('• Departments: Computer Science, Mathematics');
    console.log('• Courses: CSC-105, CSC-201, MAT-201');
    console.log('• Professors: John Smith, Sarah Jones');
    console.log('• Students: John Doe (5002378), Jane Wilson (5002379)');
    console.log('• Class Instances: 2 classes');
    console.log('• Enrollments: 3 enrollments');
    console.log('\n🔑 Test Student ID: 550e8400-e29b-41d4-a716-446655440030');
    console.log('📧 Test Student Email: student.doe@furman.edu');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run setup
setupDatabase().then(() => {
  console.log('\n✅ Setup complete! You can now test the application.');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
