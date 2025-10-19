-- Database trigger to ensure data consistency between users and students/professors tables
-- This is a backup safety mechanism in case the application-level logic fails

-- Function to create student record when user role is 'student'
CREATE OR REPLACE FUNCTION create_student_record_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create student record if role is 'student' and no student record exists
  IF NEW.role = 'student' THEN
    -- Check if student record already exists
    IF NOT EXISTS (SELECT 1 FROM students WHERE user_id = NEW.id) THEN
      -- Generate a unique student ID
      INSERT INTO students (
        user_id,
        student_id,
        enrollment_year,
        major,
        created_at
      ) VALUES (
        NEW.id,
        '500' || EXTRACT(EPOCH FROM NOW())::bigint::text || LPAD((random() * 1000)::int::text, 3, '0'),
        EXTRACT(YEAR FROM NOW()),
        'Computer Science',
        NOW()
      );
      
      RAISE NOTICE 'Automatically created student record for user %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to create professor record when user role is 'professor'
CREATE OR REPLACE FUNCTION create_professor_record_on_user_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create professor record if role is 'professor' and no professor record exists
  IF NEW.role = 'professor' THEN
    -- Check if professor record already exists
    IF NOT EXISTS (SELECT 1 FROM professors WHERE user_id = NEW.id) THEN
      -- Generate a unique employee ID
      INSERT INTO professors (
        user_id,
        employee_id,
        title,
        office_location,
        phone,
        created_at
      ) VALUES (
        NEW.id,
        'EMP' || EXTRACT(EPOCH FROM NOW())::bigint::text || LPAD((random() * 1000)::int::text, 3, '0'),
        'Professor',
        '',
        '',
        NOW()
      );
      
      RAISE NOTICE 'Automatically created professor record for user %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_create_student_record ON users;
CREATE TRIGGER trigger_create_student_record
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_student_record_on_user_insert();

DROP TRIGGER IF EXISTS trigger_create_professor_record ON users;
CREATE TRIGGER trigger_create_professor_record
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_professor_record_on_user_insert();

-- Also create triggers for role updates
DROP TRIGGER IF EXISTS trigger_create_student_record_on_update ON users;
CREATE TRIGGER trigger_create_student_record_on_update
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'student' AND OLD.role != 'student')
  EXECUTE FUNCTION create_student_record_on_user_insert();

DROP TRIGGER IF EXISTS trigger_create_professor_record_on_update ON users;
CREATE TRIGGER trigger_create_professor_record_on_update
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.role = 'professor' AND OLD.role != 'professor')
  EXECUTE FUNCTION create_professor_record_on_user_insert();
