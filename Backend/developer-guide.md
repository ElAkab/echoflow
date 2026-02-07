# Echoflow - Developer Guide

**Author:** Winston (Architect)  
**Date:** 2026-02-01  
**Audience:** New developers joining the project

---

## 🎯 Purpose of This Guide

This document provides **practical, copy-paste examples** for implementing the Echoflow backend. It's designed so that any developer (including AI assistants) can understand and extend the system.

---

## 📋 Prerequisites

Before implementing backend features, ensure:

- [ ] Node.js 20+ installed
- [ ] pnpm 9+ installed
- [ ] Supabase CLI installed: `pnpm add -D supabase`
- [ ] Backend migrations reviewed (`Backend/migrations/`)
- [ ] Architecture docs read (`Backend/architecture.md`)

---

## 🚀 Quick Start: Testing Migrations Locally

### Step 1: Initialize Supabase

```bash
cd /path/to/echoflow
pnpm add -D supabase  # If not already installed
npx supabase init
```

**Output:**
```
✓ Generated supabase config.toml in ./supabase
✓ Generated .gitignore
```

---

### Step 2: Start Local Supabase

```bash
npx supabase start
```

**Output:**
```
Started supabase local development setup.

API URL: http://localhost:54321
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
```

**Save these URLs!** You'll need them for `.env.local`.

---

### Step 3: Apply Migrations

```bash
# Copy migrations to supabase folder
mkdir -p supabase/migrations
cp Backend/migrations/*.sql supabase/migrations/

# Apply migrations
npx supabase db reset
```

**Expected Output:**
```
✓ Applying migration 20260201000000_initial_schema.sql
✓ Applying migration 20260201000001_rls_policies.sql
✓ Applying migration 20260201000002_triggers.sql
✓ Applying migration 20260201000003_atomic_hint_credits.sql
✓ Applying migration 20260201000004_optimize_indexes.sql
```

---

### Step 4: Verify Database

```bash
# Open Supabase Studio
open http://localhost:54323

# Or use psql
psql postgresql://postgres:postgres@localhost:54322/postgres

-- Check tables
\dt public.*

-- Check policies
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Check functions
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public';
```

**Expected:**
- 4 tables: `profiles`, `categories`, `notes`, `usage_logs`
- 13 policies
- 3 functions: `handle_new_user`, `handle_updated_at`, `use_hint_credit`, `reset_hint_credits`

---

## 🔧 Implementation Examples

### 1. Supabase Client Setup

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}
```

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

---

### 2. TypeScript Types from Database

Generate types automatically:

```bash
npx supabase gen types typescript --local > src/lib/supabase/types.ts
```

**Result (`src/lib/supabase/types.ts`):**

```typescript
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          subscription_tier: 'FREE' | 'PRO' | 'ENTERPRISE';
          hint_credits: number;
          hint_credits_reset_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          // ... other fields
        };
        Update: {
          email?: string;
          // ... partial fields
        };
      };
      // ... other tables
    };
    Functions: {
      use_hint_credit: {
        Args: { user_uuid: string };
        Returns: number;
      };
      reset_hint_credits: {
        Args: Record<string, never>;
        Returns: void;
      };
    };
  };
}
```

---

### 3. API Route: Create Note

`src/app/api/notes/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CreateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  category_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const supabase = createClient();

  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Validate input
  const body = await request.json();
  const validation = CreateNoteSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { title, content, category_id } = validation.data;

  // Insert note (RLS automatically filters)
  const { data, error } = await supabase
    .from('notes')
    .insert({
      title,
      content,
      category_id,
      user_id: user.id, // Explicit user_id from JWT
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
```

---

### 4. API Route: Generate Quiz (Streaming)

`src/app/api/chat/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';

const openrouter = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { noteIds, message } = await request.json();

  // Fetch notes (RLS auto-filters to user's notes)
  const { data: notes, error } = await supabase
    .from('notes')
    .select('title, content')
    .in('id', noteIds);

  if (error || !notes) {
    return new Response('Notes not found', { status: 404 });
  }

  // Build context from notes
  const context = notes.map(n => `### ${n.title}\n${n.content}`).join('\n\n');

  // Call OpenRouter with streaming
  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    stream: true,
    messages: [
      {
        role: 'system',
        content: `You are a pedagogical assistant. Generate quiz questions based ONLY on the following notes. Do not use external knowledge.\n\n${context}`,
      },
      {
        role: 'user',
        content: message || 'Generate a quiz question from my notes.',
      },
    ],
  });

  // Stream response to client
  const stream = OpenAIStream(response, {
    async onCompletion(completion) {
      // Log usage after stream completes
      const tokens = completion.usage || { prompt_tokens: 0, completion_tokens: 0 };
      await supabase.from('usage_logs').insert({
        user_id: user.id,
        tokens_input: tokens.prompt_tokens,
        tokens_output: tokens.completion_tokens,
        model_used: 'gpt-4o-mini',
        action_type: 'QUIZ',
      });
    },
  });

  return new StreamingTextResponse(stream);
}
```

---

### 5. API Route: Request Hint (Quota-Limited)

`src/app/api/hints/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use atomic function to check and increment quota
  const { data, error } = await supabase.rpc('use_hint_credit', {
    user_uuid: user.id,
  });

  if (error) {
    // Quota exceeded
    if (error.message.includes('limit reached')) {
      return NextResponse.json(
        {
          error: 'Weekly hint limit reached',
          message: 'You have used all 3 hints this week. Upgrade to PRO for unlimited hints.',
        },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  const newHintCount = data; // Returns updated count

  // Generate hint (similar to quiz, but different prompt)
  const { context } = await request.json();

  const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const response = await openrouter.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Provide a subtle hint, not the direct answer. Encourage active recall.',
      },
      {
        role: 'user',
        content: `Context: ${context}\n\nGive me a hint to help me remember.`,
      },
    ],
  });

  const hint = response.choices[0].message.content;

  // Log usage
  await supabase.from('usage_logs').insert({
    user_id: user.id,
    tokens_input: response.usage?.prompt_tokens || 0,
    tokens_output: response.usage?.completion_tokens || 0,
    model_used: 'gpt-4o-mini',
    action_type: 'HINT',
  });

  return NextResponse.json({
    hint,
    remainingHints: 3 - newHintCount,
  });
}
```

---

### 6. API Route: Get Quota Status

`src/app/api/quota/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get profile with quota info
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_tier, hint_credits, hint_credits_reset_at')
    .eq('id', user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Check if reset is due (application-level fallback)
  const resetDate = new Date(profile.hint_credits_reset_at);
  const now = new Date();

  if (resetDate <= now) {
    // Reset is overdue, update now
    const newResetDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    await supabase
      .from('profiles')
      .update({
        hint_credits: 0,
        hint_credits_reset_at: newResetDate.toISOString(),
      })
      .eq('id', user.id);

    profile.hint_credits = 0;
    profile.hint_credits_reset_at = newResetDate.toISOString();
  }

  return NextResponse.json({
    tier: profile.subscription_tier,
    hints: {
      used: profile.hint_credits,
      limit: profile.subscription_tier === 'FREE' ? 3 : null, // PRO = unlimited
      resetsAt: profile.hint_credits_reset_at,
    },
  });
}
```

---

### 7. Cron Job: Weekly Hint Reset

`src/app/api/cron/reset-hints/route.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron sends this header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use service role key (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Call reset function
  const { error } = await supabase.rpc('reset_hint_credits');

  if (error) {
    console.error('Cron error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Hints reset successfully' });
}
```

**Configure in `vercel.json`:**

```json
{
  "crons": [{
    "path": "/api/cron/reset-hints",
    "schedule": "0 0 * * *"
  }]
}
```

---

## 🧪 Testing Guide

### Unit Test: Quota Logic

`src/lib/quota.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('Quota Logic', () => {
  it('should allow hint if under limit', () => {
    const profile = {
      subscription_tier: 'FREE',
      hint_credits: 2,
    };

    const canUseHint = profile.subscription_tier === 'PRO' || profile.hint_credits < 3;
    expect(canUseHint).toBe(true);
  });

  it('should block hint if at limit', () => {
    const profile = {
      subscription_tier: 'FREE',
      hint_credits: 3,
    };

    const canUseHint = profile.subscription_tier === 'PRO' || profile.hint_credits < 3;
    expect(canUseHint).toBe(false);
  });

  it('should allow PRO users unlimited hints', () => {
    const profile = {
      subscription_tier: 'PRO',
      hint_credits: 100,
    };

    const canUseHint = profile.subscription_tier === 'PRO' || profile.hint_credits < 3;
    expect(canUseHint).toBe(true);
  });
});
```

---

### Integration Test: Note Creation

`tests/notes.spec.ts` (Playwright):

```typescript
import { test, expect } from '@playwright/test';

test('authenticated user can create note', async ({ page }) => {
  // Login (use test account)
  await page.goto('/login');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button:has-text("Sign in")');

  // Create category first
  await page.goto('/dashboard');
  await page.click('button:has-text("New Category")');
  await page.fill('[name="name"]', 'Test Category');
  await page.click('button:has-text("Save")');

  // Create note
  await page.click('button:has-text("New Note")');
  await page.fill('[name="title"]', 'My First Note');
  await page.fill('[name="content"]', 'This is test content');
  await page.click('button:has-text("Save")');

  // Verify note appears
  await expect(page.locator('text=My First Note')).toBeVisible();
});
```

---

## 📊 Monitoring Queries

### Cost This Month

```sql
SELECT 
  DATE_TRUNC('day', created_at) as day,
  SUM(tokens_input + tokens_output) as total_tokens,
  (SUM(tokens_input) * 0.15 / 1000000.0 + 
   SUM(tokens_output) * 0.60 / 1000000.0) as estimated_cost_usd
FROM usage_logs
WHERE created_at > DATE_TRUNC('month', NOW())
GROUP BY day
ORDER BY day;
```

### Hint Usage Patterns

```sql
SELECT 
  subscription_tier,
  AVG(hint_credits) as avg_hints_used,
  COUNT(*) FILTER (WHERE hint_credits >= 3) as users_at_limit,
  COUNT(*) as total_users
FROM profiles
GROUP BY subscription_tier;
```

---

## 🛡️ Security Checklist

Before deploying:

- [ ] RLS policies tested (try accessing others' data)
- [ ] Service role key NOT in client code
- [ ] All API inputs validated with Zod
- [ ] Rate limiting configured (Vercel settings)
- [ ] CORS configured (only your domain)
- [ ] Environment variables set in Vercel dashboard
- [ ] Database backups enabled (Supabase auto-backups)

---

## 🚀 Deployment Checklist

- [ ] Migrations applied to production Supabase
- [ ] Environment variables set on Vercel
- [ ] Cron job configured and tested
- [ ] Monitoring alerts set up
- [ ] Error tracking configured (Sentry)
- [ ] Analytics dashboard created
- [ ] Documentation updated

---

**Next Steps:**
1. Test migrations locally (Option A from architecture review)
2. Implement first API route (/api/notes)
3. Add E2E test for note creation
4. Deploy to Vercel staging environment

**Questions?** See `Backend/api-sequence-diagrams.md` for visual flows  
**Updated:** 2026-02-01 by Winston (Architect)
