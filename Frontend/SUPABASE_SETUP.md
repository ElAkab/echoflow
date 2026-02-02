# Supabase Authentication Setup Guide

## 🔧 Required Configuration in Supabase Dashboard

### 1. Enable Google OAuth Provider

1. Go to: **Authentication** → **Providers** → **Google**
2. Toggle **Enable Sign in with Google**
3. Add OAuth Credentials:
   - **Client ID**: From Google Cloud Console
   - **Client Secret**: From Google Cloud Console

**How to get Google OAuth credentials:**
1. Go to https://console.cloud.google.com/
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Add Authorized redirect URIs:
   ```
   https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback
   ```
7. Copy **Client ID** and **Client Secret** to Supabase

---

### 2. Configure Redirect URLs

Go to: **Authentication** → **URL Configuration**

Add these URLs:

**Site URL:**
```
http://localhost:3000
```

**Redirect URLs:**
```
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

For production, add:
```
https://your-domain.com/auth/callback
```

---

### 3. Email Templates (Magic Link)

Go to: **Authentication** → **Email Templates**

Verify the **Magic Link** template is enabled:
- Subject: `Your Magic Link`
- Confirm URL: Should include `/auth/callback`

---

## ✅ Testing Authentication

### Test Google OAuth:
1. Go to http://localhost:3000/auth/login
2. Click "Continue with Google"
3. Select Google account
4. Should redirect to /dashboard

### Test Magic Link:
1. Go to http://localhost:3000/auth/login
2. Enter email
3. Click "Send Magic Link"
4. Check email inbox
5. Click link
6. Should redirect to /dashboard

### Test Logout:
1. On /dashboard, click "Logout"
2. Should redirect to /auth/login

### Test Protected Routes:
1. Try accessing http://localhost:3000/dashboard without login
2. Should redirect to /auth/login

---

## 🐛 Troubleshooting

### "Invalid redirect URL"
- Check Redirect URLs in Supabase dashboard
- Make sure localhost:3000 and localhost:3001 are both added

### "Google OAuth not working"
- Verify Client ID/Secret in Supabase
- Check Authorized redirect URIs in Google Console

### "Magic Link not received"
- Check spam folder
- Verify email template is enabled
- Check Supabase logs (Authentication → Logs)

### "Redirect loop after login"
- Clear browser cookies
- Check middleware.ts is not blocking /dashboard

---

## 📊 Verify Setup

Run these checks in Supabase SQL Editor:

```sql
-- Check if profile was auto-created after first login
SELECT * FROM profiles ORDER BY created_at DESC LIMIT 5;

-- Verify RLS is working
SET ROLE anon;
SELECT * FROM profiles; -- Should return 0 rows
RESET ROLE;
```

---

**Next Step:** Test authentication flow end-to-end!
