# Apple Touch Icon Fix

## Issue
The app is looking for `/apple-touch-icon.png` but the file doesn't exist, causing 404 errors.

## Solution
Create an apple-touch-icon.png file in the `/public` directory.

### Steps:
1. Create a 180x180 pixel PNG image
2. Use the FSAS logo/icon design
3. Save it as `apple-touch-icon.png` in the `/public` folder
4. The image should be a simple, recognizable icon for FSAS

### Quick Fix (Temporary):
You can copy one of the existing icon files and rename it:
```bash
cp public/icon-192x192.png public/apple-touch-icon.png
```

### Proper Fix:
Create a proper 180x180 PNG icon with:
- FSAS branding
- Simple, clear design
- Good contrast for iOS home screen
- Square format (iOS will add rounded corners automatically)

## Files to Update:
- ✅ `src/app/layout.tsx` - Added `mobile-web-app-capable` meta tag
- ⏳ `public/apple-touch-icon.png` - Need to create this file

## Result:
After creating the apple-touch-icon.png file, the 404 errors will disappear and the PWA will work properly on iOS devices.
