# Supabase Email Confirmation Fix Guide

## Issue: Email confirmation links redirect to localhost

The email confirmation links from Supabase are still pointing to localhost instead of your production domain.

## Solution: Configure Supabase Email Templates

### Step 1: Go to Supabase Dashboard
1. Visit [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `zdtxqzpgggolbebrsymp`

### Step 2: Navigate to Email Templates
1. Go to **Authentication** → **Email Templates**
2. Find the **"Confirm signup"** template

### Step 3: Update the Redirect URL
In the email template, look for the confirmation link and change it from:
```
{{ .ConfirmationURL }}
```
to:
```
https://fsas-frontend.vercel.app/auth/confirm?type={{ .UserRole }}
```

### Step 4: Alternative - Update Site URL
1. Go to **Authentication** → **Settings**
2. Find **"Site URL"** setting
3. Change it from `http://localhost:3000` to `https://fsas-frontend.vercel.app`
4. Save the settings

### Step 5: Test the Fix
1. Register a new user
2. Check the confirmation email
3. The link should now point to your production domain

## Debugging Steps

If the issue persists:

1. **Check browser console** when visiting the confirmation page
2. **Look for error messages** in the confirmation page
3. **Verify the token** is being passed correctly in the URL

## Current Status
- ✅ Code is updated to use production URL
- ⚠️ Supabase email templates need manual configuration
- 🔧 Confirmation page has better debugging

## Test Command
Run this to test the current setup:
```bash
node test-email-redirect.js
```
