# Supabase Setup Verification Guide

**Date:** 2026-02-01  
**Purpose:** Verify database schema and configure environment variables

---

## ✅ Step 1: Verify Database Schema

### Run These Queries in Supabase SQL Editor

Copy each query below and run it in your Supabase Dashboard → SQL Editor:

#### **Query 1: Check Tables**
```sql
-- Should return 4 tables: profiles, categories, notes, usage_logs
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**Expected Result:**
```
categories
notes
profiles
usage_logs
```

---

#### **Query 2: Check RLS Policies**
```sql
-- Should return 13 policies
SELECT 
  tablename, 
  policyname,
  cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Expected Result (13 rows):**
```
categories | Users can delete own categories | DELETE
categories | Users can insert own categories | INSERT
categories | Users can update own categories | UPDATE
categories | Users can view own categories   | SELECT
notes      | Users can delete own notes      | DELETE
notes      | Users can insert own notes      | INSERT
notes      | Users can update own notes      | UPDATE
notes      | Users can view own notes        | SELECT
profiles   | Users can update own profile    | UPDATE
profiles   | Users can view own profile      | SELECT
usage_logs | Users can view own usage logs   | SELECT
```

---

#### **Query 3: Check Triggers**
```sql
-- Should return 4 triggers
SELECT 
  trigger_name, 
  event_object_table as table_name
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

**Expected Result:**
```
on_category_updated  | categories
on_note_updated      | notes
on_profile_updated   | profiles
on_auth_user_created | users (in auth schema)
```

---

#### **Query 4: Check Functions**
```sql
-- Should return 4 functions
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

**Expected Result:**
```
handle_new_user
handle_updated_at
reset_hint_credits
use_hint_credit
```

---

#### **Query 5: Check Indexes**
```sql
-- Should return optimized indexes
SELECT 
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Expected Result (should include):**
```
notes      | idx_notes_category_active
notes      | idx_notes_user_recent
categories | idx_categories_user_id
usage_logs | idx_usage_logs_user_date
profiles   | idx_profiles_subscription_tier
```

---

#### **Query 6: Test RLS (Security Check)**
```sql
-- This should work (creating test profile manually)
-- Run as service_role or in SQL Editor

-- First, check if RLS is enabled
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

**Expected Result:** All tables should have `rowsecurity = true`

---

## 🔑 Step 2: Get Your Environment Variables

### Navigate to Project Settings → API

You'll need **3 values**:

### **1. Project URL**
Location: Project Settings → API → Project URL
```
Format: https://xxxxxxxxxxxxx.supabase.co
```

### **2. Anon (Public) Key**
Location: Project Settings → API → Project API keys → `anon` `public`
```
Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6I...
```
⚠️ **This is safe to use in client-side code** (it's public)

### **3. Service Role Key**
Location: Project Settings → API → Project API keys → `service_role` `secret`
```
Format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6I...
```
🔒 **NEVER expose this in client code!** (server-side only)

---

## 📝 Step 3: Create .env.local

Create file at project root: `/home/adam5/dev/projects/echoflow/.env.local`

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl...

# Server-only (NEVER commit this!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl...

# OpenRouter (will be needed later)
OPENROUTER_API_KEY=sk-or-v1-xxxxx

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Cron Secret (for weekly hint reset, generate random string)
CRON_SECRET=your-random-secret-string-here
```

### Generate CRON_SECRET:
```bash
# Run this to generate random secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ Step 4: Verify Environment Variables

Create test file: `scripts/test-supabase-connection.js`

```javascript
// Test Supabase connection
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testConnection() {
  console.log('Testing Supabase connection...\n');

  // Test 1: Check if we can connect
  const { data, error } = await supabase.from('profiles').select('count');
  
  if (error) {
    console.error('❌ Connection failed:', error.message);
    return;
  }

  console.log('✅ Connection successful!\n');

  // Test 2: Check tables
  const tables = ['profiles', 'categories', 'notes', 'usage_logs'];
  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`❌ Table ${table}: ${error.message}`);
    } else {
      console.log(`✅ Table ${table}: ${count} rows`);
    }
  }

  console.log('\n✅ All tests passed!');
}

testConnection();
```

**Run test:**
```bash
node scripts/test-supabase-connection.js
```

---

## 🛡️ Step 5: Verify Row Level Security

### Test RLS with SQL Editor

```sql
-- Switch to 'anon' role (simulates unauthenticated user)
SET ROLE anon;

-- This should return 0 rows (RLS blocks unauthenticated access)
SELECT * FROM profiles;

-- Reset to authenticated role
RESET ROLE;
```

**Expected:** First query returns 0 rows (RLS working!)

---

## 🧪 Step 6: Test Auth Trigger

### Create a test user via Supabase Dashboard

1. Go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: `test@echoflow.dev`
4. Password: `TestPassword123!`
5. Click "Create user"

### Verify profile auto-created

```sql
-- Check if profile was created automatically
SELECT 
  id,
  email,
  subscription_tier,
  hint_credits,
  created_at
FROM profiles
WHERE email = 'test@echoflow.dev';
```

**Expected Result:**
```
id: <uuid>
email: test@echoflow.dev
subscription_tier: FREE
hint_credits: 0
created_at: 2026-02-01 18:xx:xx
```

If this works, your `handle_new_user()` trigger is working! ✅

---

## 📊 Step 7: Generate TypeScript Types

### Option A: Supabase CLI (if available)
```bash
npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
```

### Option B: Manual Copy from Dashboard
1. Go to Project Settings → API → API Docs
2. Scroll to "TypeScript"
3. Copy the entire interface
4. Paste into `src/lib/supabase/types.ts`

---

## ✅ Checklist: Database Setup Complete

Before proceeding to frontend, verify:

- [ ] 4 tables exist (profiles, categories, notes, usage_logs)
- [ ] 13 RLS policies active
- [ ] 4 triggers working
- [ ] 4 functions created
- [ ] Indexes optimized (composite indexes exist)
- [ ] `.env.local` created with 3 Supabase keys
- [ ] Test connection successful
- [ ] RLS blocks unauthorized access
- [ ] Auth trigger auto-creates profiles
- [ ] TypeScript types generated

---

## 🚨 Troubleshooting

### Issue: "relation 'auth.users' does not exist"
**Solution:** Migration 20260201000002 (triggers) expects auth schema. Ensure you ran migrations in order.

### Issue: RLS policies not working
**Solution:** Verify RLS is enabled:
```sql
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### Issue: Trigger not firing
**Solution:** Check trigger exists:
```sql
SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
```

### Issue: Function missing
**Solution:** Re-run migration 20260201000002 and 20260201000003

---

## 🎉 Success Criteria

When all checks pass, you'll see:
```
✅ Database schema matches architecture
✅ Security policies active
✅ Environment variables configured
✅ Connection test successful
✅ Ready for frontend development
```

---

**Next Step:** Initialize Next.js 15 Frontend

**Created:** 2026-02-01 18:40 UTC  
**Author:** Winston (Architect)
