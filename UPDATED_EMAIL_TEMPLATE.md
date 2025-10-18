# Updated Supabase Email Template

## Correct Email Template for Supabase

Replace your current email template with this:

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirm Your Account - FSAS</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #2563eb; margin-bottom: 10px;">🎓 Furman Student Attendance System</h1>
        <h2 style="color: #1f2937; font-weight: normal;">Welcome to FSAS!</h2>
    </div>
    
    <!-- Main Content -->
    <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
        <h3 style="color: #1f2937; margin-top: 0;">Almost There! Confirm Your Email</h3>
        
        <p>Hi there!</p>
        
        <p>Thank you for registering with the Furman Student Attendance System (FSAS). To complete your account setup and start using the system, please confirm your email address by clicking the button below:</p>
        
        <!-- Confirmation Button -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://fsas-frontend.vercel.app/auth/confirm?token_hash={{ .TokenHash }}&type={{ .UserRole }}" 
               style="background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                ✅ Confirm My Email
            </a>
        </div>
        
        <p><strong>What happens next?</strong></p>
        <ul>
            <li>Click the button above to verify your email</li>
            <li>You'll be redirected to a confirmation page</li>
            <li>Then you can sign in and access your dashboard</li>
        </ul>
        
        <p style="margin-bottom: 0;"><strong>Email:</strong> {{ .Email }}</p>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; color: #6b7280; font-size: 14px;">
        <p>If you didn't create an account with FSAS, you can safely ignore this email.</p>
        <p>This link will expire in 24 hours for security reasons.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">
        
        <p><strong>Furman Student Attendance System</strong><br>
        Furman University<br>
        Need help? Contact your system administrator</p>
    </div>
    
</body>
</html>
```

## Key Changes Made:

1. **Changed `token` to `token_hash`** - This is the correct Supabase parameter
2. **Added better debugging** to the confirmation page
3. **Added fallback handling** for cases where token might be missing
4. **Professional email design** with proper styling

## Steps to Update:

1. **Go to Supabase Dashboard** → Authentication → Email Templates
2. **Find "Confirm signup" template**
3. **Replace entire template** with the HTML above
4. **Save the template**

## What This Fixes:

- ✅ **Correct token parameter** (`token_hash` instead of `token`)
- ✅ **Better error handling** in confirmation page
- ✅ **Professional email design**
- ✅ **Proper debugging** to see what's happening

The confirmation page will now properly handle the token and show the success message!
