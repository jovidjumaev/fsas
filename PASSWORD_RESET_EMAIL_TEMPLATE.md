# Password Reset Email Template Configuration

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
<h2>Reset Your Password</h2>
<p>Hello,</p>
<p>You requested to reset your password for your FSAS account.</p>
<p>Click the button below to reset your password:</p>
<div style="text-align: center; margin: 30px 0;">
  <a href="{{ .ConfirmationURL }}" 
     style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
    Reset Password
  </a>
</div>
<p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
<p style="word-break: break-all; background-color: #f3f4f6; padding: 10px; border-radius: 4px; font-family: monospace;">
  {{ .ConfirmationURL }}
</p>
<p><strong>Important:</strong></p>
<ul>
  <li>This link will expire in 24 hours</li>
  <li>If you didn't request this password reset, please ignore this email</li>
  <li>For security reasons, this link can only be used once</li>
</ul>
<p>Best regards,<br>FSAS Team</p>
<hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
<p style="font-size: 12px; color: #6b7280;">
  This email was sent from Furman Smart Attendance System (FSAS).<br>
  If you have any questions, please contact your system administrator.
</p>
```

#### Email Body (Plain Text):
```
Reset Your Password

Hello,

You requested to reset your password for your FSAS account.

Click the link below to reset your password:
{{ .ConfirmationURL }}

Important:
- This link will expire in 24 hours
- If you didn't request this password reset, please ignore this email
- For security reasons, this link can only be used once

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
