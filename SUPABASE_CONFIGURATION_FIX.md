# 🚨 URGENT: Supabase Password Reset Configuration Fix

## Current Issue
**Client-side exception** when clicking password reset links because Supabase is not including authentication tokens in the URL hash.

**Current URL**: `https://fsas-frontend.vercel.app/reset-password?type=student#` (empty hash)
**Expected URL**: `https://fsas-frontend.vercel.app/reset-password?type=student#access_token=...&refresh_token=...`

## 🔧 IMMEDIATE FIX REQUIRED

### Step 1: Update Supabase Site URL Configuration

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Navigate to**: Authentication → URL Configuration
3. **Update these settings**:

```
Site URL: https://fsas-frontend.vercel.app
Redirect URLs: 
  - https://fsas-frontend.vercel.app/reset-password
  - https://fsas-frontend.vercel.app/auth/confirm
```

### Step 2: Update Password Reset Email Template

1. **Go to**: Authentication → Email Templates → Reset Password
2. **Subject**: `Reset your FSAS password`
3. **HTML Body** (replace existing):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .container { background: #f9fafb; padding: 30px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #1f2937; }
        .reset-button { 
            background-color: #3b82f6; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: bold; 
            display: inline-block;
            margin: 20px 0;
        }
        .important-section { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0; }
        .important-title { font-weight: bold; color: #92400e; margin-bottom: 10px; }
        .important-list { margin: 0; padding-left: 20px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
        .footer-logo { font-weight: bold; color: #1f2937; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🔐 FSAS</div>
            <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Furman Smart Attendance System</p>
        </div>

        <h2 style="color: #1f2937; margin-bottom: 20px;">Reset Your Password</h2>
        
        <p class="message">
            Hello,<br><br>
            You requested to reset your password for your FSAS account. Click the button below to create a new password:
        </p>

        <div style="text-align: center;">
            <a href="{{ .ConfirmationURL }}" class="reset-button">
                🔐 Reset Password
            </a>
        </div>

        <div class="important-section">
            <div class="important-title">⚠️ Important Security Information:</div>
            <ul class="important-list">
                <li>This link will expire in <strong>24 hours</strong></li>
                <li>If you didn't request this password reset, please <strong>ignore this email</strong></li>
                <li>For security reasons, this link can only be used <strong>once</strong></li>
                <li>After resetting, you'll be signed out of all devices</li>
            </ul>
        </div>

        <div class="footer">
            <p>
                Best regards,<br>
                <span class="footer-logo">FSAS Team</span>
            </p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af;">
                This email was sent from Furman Smart Attendance System (FSAS).<br>
                If you have any questions, please contact your system administrator.
            </p>
        </div>
    </div>
</body>
</html>
```

### Step 3: Verify Environment Variables

Make sure your environment variables are set correctly:

```bash
NEXT_PUBLIC_FRONTEND_URL=https://fsas-frontend.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://zdtxqzpgggolbebrsymp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 🔍 Why This Fixes The Issue

1. **Site URL Match**: Supabase needs to know your production domain to include tokens in redirects
2. **Redirect URLs**: Explicitly allows Supabase to redirect to your reset password page with tokens
3. **Email Template**: Uses `{{ .ConfirmationURL }}` which Supabase will populate with the correct URL including tokens

## 🧪 Testing After Fix

1. **Request password reset** from `/student/forgot-password` or `/professor/forgot-password`
2. **Check email** for reset link
3. **Click link** - should now include tokens in URL hash
4. **Verify** password reset form loads and works correctly

## 🚨 Critical Notes

- **This is a Supabase configuration issue, not a code issue**
- **The reset password page code is working correctly**
- **The fix must be applied in the Supabase dashboard**
- **After applying the fix, test with a new password reset request**

## 📞 If Issues Persist

If the problem continues after applying these fixes:

1. **Check Supabase logs** in the dashboard for any errors
2. **Verify** the Site URL is exactly `https://fsas-frontend.vercel.app` (no trailing slash)
3. **Test** with a different email address
4. **Clear browser cache** and try again

The client-side exception should be resolved once Supabase properly includes the authentication tokens in the redirect URL.
