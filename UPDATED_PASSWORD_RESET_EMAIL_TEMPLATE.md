# Updated Password Reset Email Template for Supabase

## Supabase Dashboard Configuration

### 1. Site URL Update
Go to **Authentication > URL Configuration** in your Supabase dashboard and update:
- **Site URL**: `https://fsas-frontend.vercel.app`

### 2. Password Reset Email Template
Go to **Authentication > Email Templates** and update the **Reset Password** template:

#### Subject Line:
```
Reset your FSAS password
```

#### Email Body (HTML):
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

#### Email Body (Plain Text):
```
Reset Your Password - FSAS

Hello,

You requested to reset your password for your FSAS account.

Click the link below to create a new password:
{{ .ConfirmationURL }}

IMPORTANT SECURITY INFORMATION:
- This link will expire in 24 hours
- If you didn't request this password reset, please ignore this email
- For security reasons, this link can only be used once
- After resetting, you'll be signed out of all devices

SECURITY TIPS:
- Choose a strong password with at least 8 characters
- Use a combination of letters, numbers, and symbols
- Don't reuse passwords from other accounts
- Consider using a password manager

Best regards,
FSAS Team

---
This email was sent from Furman Smart Attendance System (FSAS).
If you have any questions, please contact your system administrator.
```

## How It Works

1. **User requests password reset** → Enters email on forgot password page
2. **System validates email** → Checks if user exists with correct role
3. **Supabase sends email** → Uses the template above with `{{ .ConfirmationURL }}`
4. **User clicks link** → Redirects to `/reset-password?token_hash=...&type=student/professor`
5. **System processes token** → Verifies token and allows password update
6. **Password updated** → User can now sign in with new password

## URL Parameters

The reset password link will contain:
- `token_hash`: The password reset token from Supabase
- `type`: Either `student` or `professor` to determine the correct login page

## Key Features

### 🎨 **Modern Design:**
- Clean, professional layout with FSAS branding
- Responsive design that works on all devices
- Gradient buttons and modern styling
- Consistent with confirmation email template

### 🔒 **Security Focused:**
- Clear security warnings and tips
- Prominent expiration notice (24 hours)
- One-time use warning
- Security best practices included

### 📱 **User-Friendly:**
- Large, clickable reset button
- Fallback text link for accessibility
- Clear instructions and expectations
- Professional footer with contact info

### 🎯 **Branded Experience:**
- FSAS logo and branding
- Consistent color scheme (blue gradient)
- Professional tone and messaging
- Trust-building security information

## Testing

To test the password reset flow:
1. Go to `/student/forgot-password` or `/professor/forgot-password`
2. Enter a valid email address
3. Check your email for the reset link
4. Click the link and set a new password
5. Try signing in with the new password

## Troubleshooting

### Common Issues:
1. **Link redirects to localhost**: Update Site URL in Supabase dashboard
2. **Invalid token error**: Check that `token_hash` parameter is being used
3. **Email not received**: Check spam folder, verify email address is correct
4. **Token expired**: Request a new password reset (tokens expire in 24 hours)

### Debug Information:
- Check browser console for detailed error messages
- Verify Supabase dashboard settings match the configuration above
- Ensure `NEXT_PUBLIC_FRONTEND_URL` environment variable is set correctly
