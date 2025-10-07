-- Update notification types to include new student notification types
-- Run this script to add the new notification types

-- First, drop the existing constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with updated types
ALTER TABLE notifications 
ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'attendance_reminder', 'attendance_marked', 'class_cancelled', 
  'class_rescheduled', 'grade_posted', 'assignment_due', 
  'announcement', 'system', 'class_enrolled', 'session_started', 
  'attendance_recorded'
));

-- Verify the constraint was added
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'notifications'::regclass 
AND contype = 'c';
