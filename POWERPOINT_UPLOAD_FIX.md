# PowerPoint Upload Fix

## Problem
PowerPoint files (.ppt, .pptx) were failing to upload with error "Failed to save file metadata" because the database `file_type` column was limited to 50 characters, but PowerPoint MIME types are longer:

- `application/vnd.openxmlformats-officedocument.presentationml.presentation` = **75 characters**
- `application/vnd.ms-powerpoint` = **32 characters**

## Solution
Run this SQL in your Supabase SQL Editor to fix the column length:

```sql
-- Fix file_type column length for PowerPoint files
ALTER TABLE class_materials 
ALTER COLUMN file_type TYPE VARCHAR(100);
```

## Verification
After running the SQL, you can verify the fix with:

```sql
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'class_materials' 
AND column_name = 'file_type';
```

This should show `character_maximum_length = 100`.

## Files Updated
- `database/ai-assistant-schema.sql` - Updated schema to use VARCHAR(100)
- `backend/ai-assistant-api.js` - Added detailed error logging
- `fix-file-type-length.sql` - SQL script to apply the fix

## Testing
After applying the fix, PowerPoint files should upload successfully without the "Failed to save file metadata" error.
