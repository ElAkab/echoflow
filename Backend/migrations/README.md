# Backend Migrations - Usage Guide

**Author:** Winston (Architect)  
**Date:** 2026-02-01

## 📁 Migration Files

### Order of Execution
1. **20260201000000_initial_schema.sql** - Creates tables and indexes
2. **20260201000001_rls_policies.sql** - Applies Row Level Security
3. **20260201000002_triggers.sql** - Sets up triggers and functions

## 🚀 How to Apply

### Supabase CLI (Recommended)
```bash
supabase db push
```

### Supabase Dashboard (Manual)
1. Go to SQL Editor
2. Execute each migration in order

## ✅ Verification

```sql
-- Check tables
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS enabled
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public';

-- Check policies (should be 13)
SELECT COUNT(*) FROM pg_policies 
WHERE schemaname = 'public';

-- Check triggers (should be 4)
SELECT COUNT(*) FROM information_schema.triggers 
WHERE trigger_schema = 'public';
```

## 🔄 Rollback

See Backend/architecture.md for rollback instructions.
