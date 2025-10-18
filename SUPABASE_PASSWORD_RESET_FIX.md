# SUPABASE PASSWORD RESET CONFIGURATION FIX

## 🚨 Current Issue
The password reset is failing because Supabase is not including tokens in the redirect URL hash.

**Current URL:** `https://fsas-frontend.vercel.app/reset-password?type=student#`
**Expected URL:** `https://fsas-frontend.vercel.app/reset-password?type=student#access_token=...&refresh_token=...`

## 🔧 Root Cause
Supabase is redirecting to your page but not including the authentication tokens in the URL hash. This typically happens due to:

1. **Site URL mismatch** in Supabase dashboard
2. **Email template configuration** issues
3. **Supabase project settings** problems

## 📋 Step-by-Step Fix

### Step 1: Check Supabase Site URL

1. Go to **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. **Site URL** should be: `https://fsas-frontend.vercel.app`
3. **Redirect URLs** should include: `https://fsas-frontend.vercel.app/reset-password`

### Step 2: Update Email Template

1. Go to **Supabase Dashboard** → **Authentication** → **Email Templates** → **Reset Password**

2. **Subject:** `Reset your FSAS password`

3. **HTML Body:** Use this template (WITHOUT hardcoded type parameter):

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - FSAS</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
        }
        .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 8px;
        }
        .subtitle {
            color: #6b7280;
            font-size: 14px;
            margin-bottom: 30px;
        }
        .title {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
            margin-bottom: 16px;
            text-align: center;
        }
        .message {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 30px;
            text-align: center;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #1d4ed8);
            color: white;
            padding: 16px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);
            transition: all 0.2s ease;
        }
        .reset-button:hover {
            background: linear-gradient(135deg, #2563eb, #1e40af);
            box-shadow: 0 6px 8px rgba(59, 130, 246, 0.4);
            transform: translateY(-1px);
        }
        .link-container {
            background-color: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .link-text {
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 12px;
            color: #6b7280;
            word-break: break-all;
            line-height: 1.4;
        }
        .important-section {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 20px 0;
            border-radius: 0 8px 8px 0;
        }
        .important-title {
            font-weight: bold;
            color: #92400e;
            margin-bottom: 8px;
        }
        .important-list {
            margin: 0;
            padding-left: 20px;
            color: #92400e;
        }
        .important-list li {
            margin-bottom: 4px;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .footer-logo {
            font-weight: bold;
            color: #3b82f6;
        }
        .security-note {
            background-color: #f0f9ff;
            border: 1px solid #bae6fd;
            border-radius: 8px;
            padding: 16px;
            margin: 20px 0;
        }
        .security-title {
            font-weight: bold;
            color: #0369a1;
            margin-bottom: 8px;
        }
        .security-text {
            color: #0369a1;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">FSAS</div>
            <div class="subtitle">Furman Smart Attendance System</div>
        </div>

        <h1 class="title">Reset Your Password</h1>
        
        <p class="message">
            Hello,<br><br>
            You requested to reset your password for your FSAS account. Click the button below to create a new password:
        </p>

        <div class="button-container">
            <a href="{{ .ConfirmationURL }}" class="reset-button">
                🔐 Reset Password
            </a>
        </div>

        <div class="link-container">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                <strong>Button not working?</strong> Copy and paste this link into your browser:
            </p>
            <div class="link-text">{{ .ConfirmationURL }}</div>
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

        <div class="security-note">
            <div class="security-title">🛡️ Security Tips:</div>
            <div class="security-text">
                • Choose a strong password with at least 8 characters<br>
                • Use a combination of letters, numbers, and symbols<br>
                • Don't reuse passwords from other accounts<br>
                • Consider using a password manager
            </div>
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

### Step 3: Test the Configuration

1. **Request password reset** from `/student/forgot-password`
2. **Check the email** - the link should look like:
   ```
   https://zdtxqzpgggolbebrsymp.supabase.co/auth/v1/verify?token=...&type=recovery&redirect_to=https%3A%2F%2Ffsas-frontend.vercel.app%2Freset-password
   ```
3. **Click the link** - it should redirect to:
   ```
   https://fsas-frontend.vercel.app/reset-password#access_token=...&refresh_token=...
   ```

## 🔍 Debugging

If the issue persists, check:

1. **Browser Console** - Look for the debug logs we added
2. **Supabase Logs** - Check Authentication logs in Supabase dashboard
3. **Network Tab** - See if the redirect is happening correctly

## 📝 Key Changes Made

1. **Enhanced token extraction** - Now checks both search params and hash
2. **Better debugging** - Added comprehensive logging
3. **Simplified email template** - Removed hardcoded type parameter
4. **Fallback handling** - Better error messages for missing tokens

The reset password page will now:
- Extract tokens from both URL locations
- Show detailed debug information
- Handle missing tokens gracefully
- Allow type selection if needed
