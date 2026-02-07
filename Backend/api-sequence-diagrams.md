# Echoflow - API Sequence Diagrams

**Author:** Winston (Architect)  
**Date:** 2026-02-01  
**Purpose:** Visual documentation of system flows for developers

---

## 1️⃣ User Signup Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Supabase Auth
    participant Database
    participant Trigger

    User->>Browser: Click "Sign in with Google"
    Browser->>Supabase Auth: OAuth request
    Supabase Auth->>User: Redirect to Google consent
    User->>Supabase Auth: Approve & authenticate
    Supabase Auth->>Database: INSERT into auth.users
    Database->>Trigger: on_auth_user_created fires
    Trigger->>Database: INSERT into public.profiles<br/>(hint_credits=0, tier='FREE')
    Database-->>Supabase Auth: Profile created
    Supabase Auth-->>Browser: JWT token + session
    Browser-->>User: Redirect to /dashboard
```

**Key Points:**
- Profile creation is automatic (via trigger)
- User starts with FREE tier, 0/3 hints used
- Reset date set to 7 days from signup

---

## 2️⃣ Create Note Flow

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant Next.js API
    participant Supabase
    participant RLS Policy

    User->>Browser: Create note in category
    Browser->>Next.js API: POST /api/notes<br/>{title, content, category_id}
    Next.js API->>Supabase: INSERT into notes<br/>(user_id from JWT)
    Supabase->>RLS Policy: Check "Users can insert own notes"
    RLS Policy->>RLS Policy: Verify auth.uid() = user_id
    RLS Policy-->>Supabase: ✅ Allowed
    Supabase-->>Next.js API: Note created {id, ...}
    Next.js API-->>Browser: 201 Created
    Browser-->>User: Note saved!
```

**Key Points:**
- `user_id` extracted from JWT (not client input)
- RLS policy prevents users from creating notes for others
- Automatic `created_at` and `updated_at` timestamps

---

## 3️⃣ Quiz Generation Flow (Core Feature)

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant API Route
    participant Supabase
    participant OpenRouter
    participant DB Logger

    User->>Browser: Select notes + click "Interroge-moi"
    Browser->>API Route: POST /api/chat<br/>{noteIds: [id1, id2]}
    
    API Route->>Supabase: SELECT * FROM notes<br/>WHERE id IN (noteIds)
    Supabase-->>API Route: [note1, note2] (RLS filtered)
    
    API Route->>API Route: Build prompt<br/>(system + note content)
    
    API Route->>OpenRouter: POST /chat/completions<br/>(model: gpt-4o-mini, stream: true)
    
    loop Stream Response
        OpenRouter-->>API Route: Token chunk
        API Route-->>Browser: SSE event {delta: "..."}
        Browser-->>User: Display text progressively
    end
    
    OpenRouter-->>API Route: Stream complete {usage}
    
    API Route->>DB Logger: INSERT usage_logs<br/>(tokens, model, action: QUIZ)
    DB Logger-->>API Route: Logged
    
    API Route-->>Browser: Stream closed
```

**Key Points:**
- RLS automatically filters notes to user's only
- Streaming provides real-time UX
- Usage logged for cost tracking
- No quota deduction (core feature is unlimited)

---

## 4️⃣ Hint Request Flow (Quota-Limited Feature)

```mermaid
sequenceDiagram
    actor User
    participant Browser
    participant API Route
    participant Supabase
    participant use_hint_credit()
    participant OpenRouter

    User->>Browser: Click "Demander un indice"
    Browser->>API Route: POST /api/hints<br/>{context}
    
    API Route->>Supabase: rpc('use_hint_credit', {user_uuid})
    
    Supabase->>use_hint_credit(): BEGIN TRANSACTION
    use_hint_credit()->>use_hint_credit(): SELECT ... FOR UPDATE<br/>(lock row)
    use_hint_credit()->>use_hint_credit(): Check tier='FREE'<br/>AND credits < 3
    
    alt Quota exceeded
        use_hint_credit()-->>Supabase: RAISE EXCEPTION
        Supabase-->>API Route: Error: quota exceeded
        API Route-->>Browser: 429 Too Many Requests
        Browser-->>User: "Limite atteinte.<br/>Recharge le [date]"
    else Quota OK
        use_hint_credit()->>use_hint_credit(): UPDATE hint_credits + 1
        use_hint_credit()-->>Supabase: COMMIT (new credits: 1)
        Supabase-->>API Route: Success {hint_credits: 1}
        
        API Route->>OpenRouter: Generate hint (streaming)
        OpenRouter-->>API Route: Hint text
        
        API Route->>Supabase: INSERT usage_logs<br/>(action: HINT)
        
        API Route-->>Browser: 200 OK {hint, remaining: 2}
        Browser-->>User: Display hint
    end
```

**Key Points:**
- **Atomic operation** prevents race conditions
- `FOR UPDATE` locks row during transaction
- PRO tier users bypass quota check
- Remaining hints displayed to user

---

## 5️⃣ Weekly Hint Reset Flow

```mermaid
sequenceDiagram
    participant Cron Job
    participant Supabase
    participant Database
    participant reset_hint_credits()

    Cron Job->>Supabase: Daily trigger (00:00 UTC)
    Supabase->>reset_hint_credits(): CALL function
    
    reset_hint_credits()->>Database: SELECT users<br/>WHERE reset_at <= NOW()
    Database-->>reset_hint_credits(): [user1, user2, ...]
    
    loop For each user
        reset_hint_credits()->>Database: UPDATE profiles SET<br/>hint_credits=0,<br/>reset_at=NOW()+'1 week'
    end
    
    reset_hint_credits()-->>Supabase: Rows updated: N
    Supabase-->>Cron Job: Success
    
    Note over Cron Job: Send email to users<br/>"Your hints refreshed!"
```

**Alternative: Application-Level Fallback**

```mermaid
sequenceDiagram
    participant User
    participant API Route
    participant Supabase
    participant Database

    User->>API Route: GET /api/quota
    API Route->>Supabase: SELECT profile
    Supabase-->>API Route: {hint_credits: 3,<br/>reset_at: '2026-01-28'}
    
    API Route->>API Route: Check if reset_at <= NOW()
    
    alt Reset is due
        API Route->>Supabase: UPDATE profile SET<br/>hint_credits=0,<br/>reset_at=NOW()+'1 week'
        Supabase-->>API Route: Updated
        API Route-->>User: {hints: 0/3, reset: 'Feb 4'}
    else Reset not due
        API Route-->>User: {hints: 3/3, reset: 'Feb 4'}
    end
```

**Key Points:**
- Cron is primary method (runs daily)
- Application checks on every quota request (fallback)
- **Defense in depth** ensures hints always reset

---

## 6️⃣ RLS Policy Enforcement Flow

```mermaid
sequenceDiagram
    participant Client
    participant Next.js API
    participant Supabase Client
    participant PostgreSQL
    participant RLS Engine

    Client->>Next.js API: GET /api/notes?category_id=123
    Next.js API->>Supabase Client: from('notes').select()<br/>.eq('category_id', 123)
    
    Supabase Client->>PostgreSQL: SELECT * FROM notes<br/>WHERE category_id='123'<br/><JWT token attached>
    
    PostgreSQL->>RLS Engine: Evaluate policies
    RLS Engine->>RLS Engine: Extract auth.uid() from JWT
    RLS Engine->>RLS Engine: Apply policy:<br/>WHERE user_id = auth.uid()
    
    RLS Engine->>PostgreSQL: Rewrite query:<br/>SELECT * FROM notes<br/>WHERE category_id='123'<br/>AND user_id='<uid>'
    
    PostgreSQL-->>Supabase Client: [note1, note2]<br/>(only user's notes)
    Supabase Client-->>Next.js API: Data
    Next.js API-->>Client: JSON response
```

**Key Points:**
- RLS is automatic (developer can't forget it)
- JWT token carries user identity
- Query is rewritten before execution
- **Even service role can't bypass RLS** (unless explicitly using service key)

---

## 7️⃣ Cost Tracking & Analytics Flow

```mermaid
sequenceDiagram
    participant Admin
    participant Dashboard
    participant Supabase
    participant usage_logs

    Admin->>Dashboard: Open analytics page
    Dashboard->>Supabase: Query total costs
    
    Supabase->>usage_logs: SELECT <br/>SUM(tokens_input),<br/>SUM(tokens_output),<br/>model_used<br/>GROUP BY model
    
    usage_logs-->>Supabase: [{model: gpt-4o-mini,<br/>input: 10M, output: 5M}]
    
    Supabase->>Supabase: Calculate costs<br/>gpt-4o-mini:<br/>10M*$0.15 + 5M*$0.60
    
    Supabase-->>Dashboard: {total_cost: $4.50,<br/>per_user: $0.045}
    
    Dashboard-->>Admin: Display chart +<br/>cost alerts
```

**Monitoring Queries:**

```sql
-- This week's costs
SELECT 
  model_used,
  COUNT(*) as calls,
  SUM(tokens_input) as input_tokens,
  SUM(tokens_output) as output_tokens,
  -- Cost estimation (gpt-4o-mini pricing)
  (SUM(tokens_input) * 0.15 / 1000000.0 + 
   SUM(tokens_output) * 0.60 / 1000000.0) as estimated_cost
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY model_used;

-- Top 10 users by usage
SELECT 
  user_id,
  COUNT(*) as total_calls,
  SUM(tokens_input + tokens_output) as total_tokens
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_tokens DESC
LIMIT 10;
```

---

## 8️⃣ Error Handling Flows

### OpenRouter API Timeout

```mermaid
sequenceDiagram
    participant User
    participant API Route
    participant OpenRouter

    User->>API Route: Request quiz
    API Route->>OpenRouter: POST /chat (timeout: 30s)
    
    alt Response within 30s
        OpenRouter-->>API Route: Stream response
        API Route-->>User: Quiz generated
    else Timeout
        OpenRouter--xAPI Route: No response
        API Route->>API Route: Retry with cheaper model<br/>(gpt-3.5-turbo)
        
        alt Retry succeeds
            OpenRouter-->>API Route: Response
            API Route-->>User: Quiz generated<br/>(fallback model)
        else Retry fails
            API Route-->>User: 503 Service Unavailable<br/>"AI temporarily unavailable"
        end
    end
```

### Quota Exceeded (Soft Landing)

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant API

    User->>Browser: Click "Hint"
    Browser->>API: POST /api/hints
    API-->>Browser: 429 Quota Exceeded
    
    Browser->>Browser: Show modal:<br/>"You've used 3/3 hints this week"
    Browser->>User: Display:<br/>- Resets in X days<br/>- Upgrade to PRO button<br/>- Continue without hint
    
    alt User clicks "Upgrade"
        User->>Browser: Navigate to /pricing
    else User clicks "Continue"
        User->>Browser: Continue quiz<br/>(no hint)
    end
```

---

## 🎓 Developer Notes

### When to Use Each Flow

1. **Quiz Generation** - Most common (90% of API calls)
2. **Hint Request** - Occasional (10% of API calls)
3. **Note CRUD** - Frequent but simple (client-side RLS handles security)
4. **Quota Check** - On every hint + displayed in UI header
5. **Reset** - Automated daily cron

### Performance Considerations

- **Streaming**: Essential for UX (don't buffer entire response)
- **RLS overhead**: ~10ms per query (acceptable)
- **Atomic functions**: Add locking overhead but prevent bugs
- **Indexing**: Composite indexes speed up common queries 20-30%

### Security Checklist

- ✅ Never trust client input for `user_id` (always use JWT)
- ✅ Always enable RLS on new tables
- ✅ Use `FOR UPDATE` in atomic operations
- ✅ Validate API inputs with Zod schemas
- ✅ Rate limit API endpoints (Vercel Edge Config)

---

**Next:** See `Backend/developer-guide.md` for implementation examples  
**Updated:** 2026-02-01 by Winston (Architect)
