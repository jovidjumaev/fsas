-- Fix file_type column length for PowerPoint files
-- PowerPoint MIME types are longer than 50 characters

ALTER TABLE class_materials 
ALTER COLUMN file_type TYPE VARCHAR(100);

-- Verify the change
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'class_materials' 
AND column_name = 'file_type';
