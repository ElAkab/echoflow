# Echoflow - Backend Architecture Summary

**Architect:** Winston  
**Date:** 2026-02-01  
**Status:** ✅ Finalized for MVP Implementation

---

## 🎯 Architecture Overview

**Pattern:** Serverless Monolith (Next.js 15 + Supabase)  
**Philosophy:** Freemium-first with unlimited core features  
**Security:** Database-level RLS (Row Level Security)

---

## 📊 Database Schema

### Tables (4 core + 1 optional)

#### 1️⃣ `profiles` - User Management

```
- id (UUID, PK, FK → auth.users)
- email (TEXT, unique)
- full_name (TEXT, nullable)
- avatar_url (TEXT, nullable)
- subscription_tier (ENUM: FREE/PRO/ENTERPRISE, default: FREE)
- hint_credits (INT, default: 0) ← Counter of hints used this week
- hint_credits_reset_at (TIMESTAMP) ← Next weekly reset
- created_at, updated_at
```

#### 2️⃣ `categories` - Knowledge Organization

```
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- name (TEXT) ← Ex: "JavaScript", "Biology"
- description (TEXT, nullable)
- system_prompt (TEXT, nullable) ← Custom AI persona
- color (TEXT, default: "#34C759") ← UI tag color
-icon (TEXT, nullable) ← Optional icon name
- ai_model (TEXT, default: gpt-4o-mini)
- created_at, updated_at

INDEX: user_id (faster lookups)
```

#### 3️⃣ `notes` - User Content

```
- id (UUID, PK)
- user_id (UUID, FK → profiles) ← Denormalized for RLS performance
- category_id (UUID, FK → categories)
- title (TEXT)
- content (TEXT) ← Markdown/HTML
- is_archived (BOOLEAN, default: false)
- created_at, updated_at

INDEXES: user_id, category_id, created_at DESC
```

#### 4️⃣ `usage_logs` - AI Usage Tracking

```
- id (UUID, PK)
- user_id (UUID, FK → profiles, nullable on delete)
- tokens_input (INT)
- tokens_output (INT)
- model_used (TEXT)
- action_type (ENUM: QUIZ/HINT/CHAT)
- energy_cost (INT) ← For future premium models
- created_at
```

#### 5️⃣ `quiz_history` - Session Archive (MVP+)

```
- id (UUID, PK)
- user_id (UUID, FK → profiles)
- note_ids (UUID[]) ← Array of notes used
- conversation_json (JSONB) ← Full chat log
- created_at
```

---

## 🔒 Security: RLS Policies

**Enabled on all tables.** Users can ONLY access their own data.

### Profiles

- `SELECT`: Self only (`auth.uid() = id`)
- `UPDATE`: Self only

### Categories

- `SELECT/INSERT/UPDATE/DELETE`: Own categories only (`auth.uid() = user_id`)

### Notes

- `SELECT/INSERT/UPDATE/DELETE`: Own notes only (`auth.uid() = user_id`)

### Usage Logs

- `SELECT`: Read-only access to own logs (no modification allowed)

**Why RLS?**

- Security at database level (code bugs can't leak data)
- Supabase automatically enforces based on JWT token
- Zero-trust architecture

---

## 💰 Quota Strategy (Freemium-First)

### FREE Tier (Default)

✅ **Unlimited:**

- Quiz generation
- AI chat/conversation
- Notes & Categories
- Storage

🔒 **Limited:**

- Hints: **3 per week** (resets weekly, not monthly)

### Implementation

```typescript
// Application-level check (NOT token consumption)
if (user.subscription_tier === "FREE" && user.hint_credits >= 3) {
	throw new QuotaExceededError();
}
```

**Key Point:** Hints don't cost more tokens, limit is **code-enforced** for fairness.

---

## 🔄 Automation: Triggers & Functions

### 1. Auto-create Profile on Signup

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

→ New user gets profile with default 0 hint_credits automatically.

### 2. Auto-update `updated_at` Timestamps

```sql
CREATE TRIGGER on_note_updated
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE PROCEDURE handle_updated_at();
```

→ Applies to profiles, categories, notes.

### 3. Weekly Hint Credits Reset

```sql
CREATE FUNCTION reset_hint_credits() ...
```

→ To be called by Supabase Cron (daily check) or Edge Function.

---

## 📁 Project Structure (Backend)

```
src/
├── app/api/              # Next.js API Routes (Backend)
│   ├── chat/
│   │   └── route.ts      # POST - AI quiz/chat streaming
│   ├── hints/
│   │   └── route.ts      # POST - Request hint (quota check)
│   ├── notes/
│   │   └── route.ts      # CRUD notes
│   ├── categories/
│   │   └── route.ts      # CRUD categories
│   ├── quota/
│   │   └── route.ts      # GET - Current quota status
│   └── webhooks/
│       └── stripe/
│           └── route.ts  # POST - Stripe payment events
├── lib/
│   ├── supabase/
│   │   ├── server.ts     # Server-side Supabase client
│   │   ├── client.ts     # Browser Supabase client
│   │   └── types.ts      # Auto-generated DB types
│   ├── ai/
│   │   ├── openrouter.ts # OpenRouter API wrapper
│   │   ├── prompts.ts    # Prompt templates
│   │   └── quota.ts      # Quota validation logic
│   └── utils/
│       └── errors.ts     # Custom error classes
supabase/
├── migrations/
│   ├── 20260201000000_initial_schema.sql
│   ├── 20260201000001_rls_policies.sql
│   └── 20260201000002_triggers.sql
└── config.toml
```

---

## 🔌 API Routes Design

### `/api/chat` (POST) - Main Quiz Engine

**Input:**

```json
{
	"noteIds": ["uuid1", "uuid2"],
	"categoryId": "uuid",
	"message": "User question"
}
```

**Process:**

1. Validate user auth (Supabase JWT)
2. Fetch notes from DB (RLS auto-filters to user's notes)
3. Construct prompt (system_prompt + note content + user message)
4. Call OpenRouter with streaming
5. Log usage to `usage_logs`
6. Return stream to client

**Output:** Server-Sent Events (SSE) stream

---

### `/api/hints` (POST) - Hint Request

**Input:**

```json
{
	"sessionContext": "Current conversation state"
}
```

**Process:**

1. **Check quota:** `hint_credits < 3` for FREE tier
2. If OK: Increment `hint_credits`
3. Generate hint via OpenRouter (same cost as regular message)
4. Log as `action_type: HINT`
5. Return hint text

**Output:**

```json
{
	"hint": "Try thinking about...",
	"remainingHints": 2
}
```

---

### `/api/quota` (GET) - Quota Status

**Input:** None (auth from cookies)

**Output:**

```json
{
	"tier": "FREE",
	"hints": {
		"used": 1,
		"limit": 3,
		"resetsAt": "2026-02-08T00:00:00Z"
	}
}
```

---

## 🚀 Next Steps (Implementation Order)

### Phase 1: Database Setup ✅ (Architecture Done)

- [x] Schema designed
- [x] RLS policies defined
- [x] Triggers/functions specified
- [ ] Create migration files
- [ ] Test migrations locally

### Phase 2: Supabase Client Configuration

- [ ] Install Supabase CLI
- [ ] Initialize Supabase project locally
- [ ] Create `lib/supabase/server.ts` and `client.ts`
- [ ] Generate TypeScript types from schema

### Phase 3: API Routes Implementation

- [ ] Implement `/api/chat` with OpenRouter streaming
- [ ] Implement `/api/hints` with quota validation
- [ ] Implement `/api/quota` status endpoint
- [ ] Add error handling and logging

### Phase 4: Testing

- [ ] Write integration tests for quota logic
- [ ] Test RLS policies (verify users can't access others' data)
- [ ] Load test OpenRouter streaming

---

## 🤔 Architectural Decisions & Rationale

| Decision                                   | Why?                                                         |
| ------------------------------------------ | ------------------------------------------------------------ |
| **Supabase (not plain PostgreSQL)**        | Free Auth + RLS + Realtime, saves 100+ hours of backend code |
| **Weekly hint reset (not monthly)**        | Less frustrating for users who hit limit early               |
| **Denormalized `user_id` in notes**        | RLS performance (avoids JOIN on every query)                 |
| **Code-based quota (not token deduction)** | Transparent, fair, simpler to explain                        |
| **gpt-4o-mini default**                    | Best cost/quality ratio ($0.15/1M input tokens)              |
| **Serverless Monolith**                    | Simpler than microservices for solo dev, scales via Vercel   |

---

## 📝 Important Notes

### RLS Policy Explanation

**RLS = Row Level Security**

Think of it as "database-level firewall":

- Every query is filtered by `auth.uid()` (user ID from JWT token)
- Even if frontend code is compromised, users can't access others' data
- Policies are checked **before** query execution

**Example:**

```sql
-- Policy: Users can only SELECT their own notes
CREATE POLICY "Users can view own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);
```

When user makes query:

```sql
SELECT * FROM notes WHERE category_id = 'xyz';
```

Supabase automatically transforms it to:

```sql
SELECT * FROM notes
WHERE category_id = 'xyz'
  AND user_id = auth.uid(); -- Added by RLS!
```

---

## 💡 Cost Analysis (Sustainability)

**Scenario:** 1,000 active FREE users

- Avg 20 quiz sessions/month + 12 hints/month
- Total: ~$7.60/month in OpenRouter costs

**Break-even:** ~150 PRO users ($5/month) = $750/month  
**Ratio:** 1 PRO user subsidizes 100 FREE users

**Conclusion:** Freemium model is **sustainable** with 15% conversion rate.

---

**Status:** Ready for implementation 🚀  
**Updated:** 2026-02-01 by Winston (Architect)
