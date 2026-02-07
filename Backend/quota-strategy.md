# Echoflow - Quota Strategy (Freemium-First)

**Author:** Winston (Architect)  
**Date:** 2026-02-01  
**Version:** 1.0

---

## Philosophy: Maximum Generosity for Core Features

Echoflow adopts a **truly freemium model** where the main value proposition (AI-powered learning via quizzes) remains **completely free and unlimited**. Monetization focuses on **premium enhancements**, not core functionality.

---

## FREE Tier (Default for All Users)

### ✅ Unlimited Features

- **Quiz Generation**: Unlimited AI-generated questions from notes
- **Chat/Conversation**: Unlimited back-and-forth with AI for clarification
- **Notes**: Unlimited number of notes
- **Categories**: Unlimited categories
- **Storage**: Unlimited content storage
- **Models**: Access to cost-effective models (gpt-4o-mini, claude-3-haiku, llama-3)

### 🔒 Limited Features

- **Hints**: 3 hints per week
  - Counter: `hint_credits` (0-3)
  - Resets: Weekly (every 7 days)
  - Enforced: Application-level check before AI call
  - **Important**: Hints don't consume more tokens, just checked via code logic

### ⚙️ Technical Implementation

```typescript
// Pseudo-code for hint request validation
async function requestHint(userId: string) {
	const profile = await getProfile(userId);

	// Check subscription tier
	if (profile.subscription_tier === "FREE") {
		// Check weekly limit
		if (profile.hint_credits >= 3) {
			throw new Error(
				"Weekly hint limit reached. Resets on " + profile.hint_credits_reset_at,
			);
		}

		// Increment counter (application logic, not token deduction)
		await incrementHintCounter(userId);
	}

	// Call OpenRouter API for hint (same token cost as regular message)
	return await generateHint(context);
}
```

---

## PRO Tier (Future Monetization)

### 💎 Premium Features

- **Unlimited Hints**: No weekly restriction
- **Premium Models**: Access to GPT-4, Claude Opus, etc.
- **Analytics Dashboard**: Detailed learning progress tracking
- **Export**: Download notes and quiz history
- **Priority Support**: Faster response times
- **Custom Branding**: Remove "Powered by Echoflow" footer

### 💰 Pricing (Suggested)

- $5/month or $50/year (save 17%)

---

## Quota Enforcement Strategy

### Database Structure

```sql
-- profiles table columns
subscription_tier TEXT DEFAULT 'FREE' -- 'FREE' | 'PRO' | 'ENTERPRISE' (not sure for ENTERPRISE yet)
hint_credits INTEGER DEFAULT 0        -- Counter: used hints this week (0-3 for FREE)
hint_credits_reset_at TIMESTAMP       -- Next reset date (weekly)
```

### Weekly Reset Mechanism

**Option 1: Supabase Cron Job** (Recommended)

```sql
-- Run every day at midnight UTC
SELECT cron.schedule(
  'reset-weekly-hint-credits',
  '0 0 * * *', -- Daily check
  $$
  SELECT public.reset_hint_credits();
  $$
);
```

**Option 2: Edge Function Trigger**

- Check on each hint request
- Reset if `hint_credits_reset_at <= NOW()`

---

## Cost Modeling (Backend Economics)

### Assumptions

- Average quiz session: ~500 tokens input + 300 tokens output = 800 tokens
- Average hint: ~200 tokens input + 150 tokens output = 350 tokens
- Model: `gpt-4o-mini` at $0.15/$0.60 per 1M tokens (input/output)

### FREE User Cost Per Month

```
Scenario: Active user (20 quiz sessions/month, 3 hints/week = 12 hints/month)

Quiz sessions: 20 * 800 tokens = 16,000 tokens
Hints: 12 * 350 tokens = 4,200 tokens
Total: 20,200 tokens/month

Cost calculation (assuming 50/50 input/output split):
- Input: 10,100 tokens * $0.15 / 1M = $0.0015
- Output: 10,100 tokens * $0.60 / 1M = $0.0061
Total: ~$0.0076 per active user/month (~0.76 cents)
```

### Sustainability

- Target: 1,000 active FREE users = ~$7.60/month cost
- Break-even: ~150 PRO users at $5/month = $750/month
- Ratio: 1 PRO user subsidizes ~100 FREE users

---

## RLS Policies Explanation (For Developers)

**RLS (Row Level Security)** = Database-level access control enforced by PostgreSQL.

### Why RLS?

- **Security at the source**: Even if application code has a bug, users can't access others' data
- **Zero Trust**: Database validates every query against user identity
- **Supabase Integration**: Works seamlessly with `auth.uid()` from JWT tokens

### Example Policy

```sql
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);
```

**Translation**: "A user can SELECT rows from `notes` table ONLY if the `user_id` column matches their authenticated user ID."

### Full Coverage

All tables have policies for:

- `SELECT` (read)
- `INSERT` (create)
- `UPDATE` (modify)
- `DELETE` (remove)

**Exception**: `usage_logs` is read-only (users can view but not modify audit trail).

---

## Migration Strategy

### Phase 1: MVP (Current)

- Implement FREE tier only
- No payment gateway
- Focus on product-market fit

### Phase 2: Monetization (3-6 months)

- Add Stripe integration
- Implement PRO tier
- Build analytics dashboard
- Add model selection UI

### Phase 3: Enterprise (12+ months)

- Team workspaces
- SSO (Single Sign-On)
- Custom deployments
- White-label options

---

## Key Decisions Summary

| Decision                       | Rationale                                                     |
| ------------------------------ | ------------------------------------------------------------- |
| **Core features free**         | Maximize user acquisition, reduce barrier to entry            |
| **Weekly hint limit (3)**      | Encourages active recall without frustrating users            |
| **Code-based enforcement**     | Simpler than token-based deduction, transparent to users      |
| **Weekly reset (not monthly)** | Shorter cycle = less user frustration if they hit limit early |
| **Low default model**          | gpt-4o-mini balances quality and cost                         |
| **RLS at DB level**            | Security defense-in-depth, prevents data leaks                |

---

## Next Steps (For Architect)

1. ✅ Finalize database schema
2. ✅ Document RLS policies
3. 🔜 Create migration files (`supabase/migrations/`)
4. 🔜 Define API routes structure
5. 🔜 Design hint request flow diagram

---

**Updated:** 2026-02-01 by Winston (Architect)
