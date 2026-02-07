# 🚀 Quick Start: .env.local Setup

**Time:** 5 minutes  
**Purpose:** Configure your local environment to connect to Supabase

---

## 📋 What You Need

Go to your Supabase Dashboard: https://supabase.com/dashboard/project/YOUR-PROJECT-ID

---

## Step 1: Get Supabase Credentials

### Navigate to: **Project Settings** (⚙️ icon) → **API**

You'll see a page with these sections:

### **1. Project URL** 
Copy the URL that looks like:
```
https://abcdefghijklmnop.supabase.co
```

### **2. API Keys**

You'll see two keys:

#### **anon / public**
- Label says: `anon` `public`
- Starts with: `eyJhbGc...`
- **Safe to use in client code** ✅
- This is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### **service_role / secret**  
- Label says: `service_role` `secret`
- Starts with: `eyJhbGc...` (different from anon)
- **NEVER expose in client code!** 🔒
- This is your `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Create .env.local File

In your project root (`/home/adam5/dev/projects/echoflow/`), create file `.env.local`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi... (paste anon key here)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi... (paste service_role key here)

# OpenRouter (leave empty for now, will configure later)
OPENROUTER_API_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Cron Secret (generate with command below)
CRON_SECRET=
```

---

## Step 3: Generate CRON_SECRET

Run this command to generate a secure random string:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output (long hex string) and paste it as `CRON_SECRET` value.

**Example output:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

Paste this into `.env.local`:
```bash
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## Step 4: Verify .env.local

Your final `.env.local` should look like:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNj...

# OpenRouter (empty for now)
OPENROUTER_API_KEY=

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Cron Secret
CRON_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

---

## ✅ Verification Checklist

- [ ] `.env.local` file created in project root
- [ ] `NEXT_PUBLIC_SUPABASE_URL` filled (starts with https://)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` filled (long JWT token)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` filled (different JWT token)
- [ ] `CRON_SECRET` generated and filled
- [ ] File saved

---

## 🔒 Security Check

### ✅ DO:
- Keep `.env.local` in `.gitignore` (already done)
- Use `NEXT_PUBLIC_*` variables in client code
- Use `SUPABASE_SERVICE_ROLE_KEY` only in API routes

### ❌ DON'T:
- Commit `.env.local` to git
- Expose `SUPABASE_SERVICE_ROLE_KEY` in browser
- Share service role key publicly

---

## 🧪 Test Your Configuration

After creating `.env.local`, run these verification queries in Supabase Dashboard → SQL Editor:

See `Backend/supabase-verification.md` for complete verification guide.

**Quick test:**
```sql
-- Should return 4 table names
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected: `categories`, `notes`, `profiles`, `usage_logs`

---

## 🎉 Next Steps

Once `.env.local` is configured:

1. ✅ Run verification queries (Backend/supabase-verification.md)
2. ✅ Verify all 5 migrations applied successfully
3. 🔜 Initialize Next.js frontend
4. 🔜 Create Supabase client utilities
5. 🔜 Build first UI component

---

**Created:** 2026-02-01 18:45 UTC  
**Estimated Time:** 5 minutes  
**Author:** Winston (Architect)
