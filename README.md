# Echoflow — AI-Powered Active Recall

<div align="center">
  <img src="Frontend/public/images/echoflow_logo.png" alt="Echoflow" height="120" />
  <br/>
  <strong>Transform your notes into knowledge — one question at a time.</strong>
  <br/><br/>
  <a href="https://echoflow-app.com">Live Demo</a> · <a href="#getting-started">Get Started</a>
  <br/><br/>
  <img src="https://img.shields.io/badge/status-active%20development-brightgreen" alt="Active Development" />
</div>

---

## Why I built this

I had a bad habit I couldn't shake: re-reading my notes over and over, feeling like I understood everything — and then blanking when it actually mattered.

Turns out there's a name for that feeling: the **illusion of competence**. Passive review gives you the sensation of learning without building the neural pathways that make knowledge stick. The research is clear — what actually works is **active recall**: forcing your brain to retrieve information rather than just recognise it.

I wanted a tool that would take my notes and turn them into a real challenge. Not generic flashcards. Not a quiz generator that ignores context. An AI that reads _my_ notes, asks _me_ the hard questions, and remembers where I struggled last time.

So I built it.

---

## How it was built

I won't pretend this was written entirely by hand. I had access to some of the best AI development tools available — and I used them intentionally.

The real work was knowing _what_ to build, _how_ to structure it, and _when_ the AI was wrong. The tools amplified what I already knew; they didn't replace the thinking. That's the only honest way to describe it: the best instruments I could find, multiplied by whatever I bring to the table.

The result is a production-ready app — auth, payments, AI streaming, credit system, subscriptions — built by one person in a few weeks.

---

## Features

### Category Creation

Create custom categories with icons and colors to visually organize your knowledge base.

### Markdown Notes

Write rich notes with full Markdown support (code blocks, lists, headers) — structure that the AI reads and respects when generating questions.

### LLM-Powered Interactive Quizzes

Launch quizzes in a chat-based format powered by an LLM, dynamically generated from your own notes. Not generic. Not random. Yours.

### Multi-Note Selection

Combine multiple notes to give the AI broader context — ideal for subjects where everything connects.

### Intelligent Session Tracking

The model remembers your previous sessions: what you struggled with, what you got right, and how to push you further next time.

---

## Workflow

### BMad Methodology

Every feature in this project followed the same loop:

```
Brief    → Define the problem and acceptance criteria clearly
Model    → Design the data model and component architecture
Act      → Implement with tests in mind
Deploy   → Push to staging, verify in production
Evaluate → Review, measure, iterate
```

No feature was built without first writing down what "done" means. This kept scope tight and made AI assistance far more effective — an AI given a clear brief produces dramatically better output than one given a vague request.

### GitHub Copilot as Co-Developer

The [`.github/copilot-instructions.md`](.github/copilot-instructions.md) file is the backbone of how AI assistance works in this project. It defines:

- **Hard constraints**: `pnpm` only, strict TypeScript, no `any`, Server Components by default
- **Patterns**: BFF API routes, Zod validation everywhere, RLS on every table
- **Quality gates**: E2E tests first (Playwright), conventional commits, no cutting corners on security
- **Naming and structure**: so every AI suggestion fits naturally into the codebase

The result: every piece of AI-generated code follows the same standards as hand-written code, because the AI was told exactly what those standards are.

---

## Tech Stack

| Layer           | Technology                                    |
| --------------- | --------------------------------------------- |
| Framework       | Next.js 16 (App Router)                       |
| Language        | TypeScript 5 (strict)                         |
| Styling         | Tailwind CSS 4.0 + shadcn/ui                  |
| Animations      | Framer Motion                                 |
| State           | Zustand                                       |
| Auth            | Supabase Auth (Google OAuth + Magic Link)     |
| Database        | Supabase (PostgreSQL + RLS)                   |
| AI Gateway      | OpenRouter (streaming, premium-first routing) |
| Payments        | Stripe (credits + subscriptions)              |
| Email           | Resend                                        |
| Rate Limiting   | Upstash Redis                                 |
| Hosting         | Vercel                                        |
| Package Manager | pnpm                                          |

---

## Architecture

### AI Routing Strategy

The app uses a **premium-first** model routing strategy:

```
Platform key (GPT-4o-mini / Mistral-7B paid)
  └─ Daily request cap reached?
       └─ User BYOK key (encrypted, stored per-user)
            └─ No BYOK?
                 └─ Free tier fallback (LLaMA 3.3, Qwen, Gemma)
```

This keeps costs controlled while giving paid users a consistently better experience.

### Credit System

- **Free tier**: 20 quiz sessions/day, auto-reset at midnight
- **Top-up**: one-time credit purchases via Stripe
- **Pro subscription**: unlimited daily sessions via Stripe subscription

### Database Schema (simplified)

```
profiles ──< categories ──< notes
                               └── study_sessions (conversation_history, ai_feedback)

user_credits    (daily_credits, paid_credits, last_reset)
user_ai_keys    (encrypted BYOK key per user)
feedback        (rating, comment — anonymous)
```

All tables use Row-Level Security. Users can only ever read and write their own data.

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project
- OpenRouter API key

### Installation

```bash
git clone https://github.com/ElAkab/echoflow.git
cd echoflow/Frontend
pnpm install
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenRouter
OPENROUTER_API_KEY=
OPENROUTER_PREMIUM_MODELS=openai/gpt-4o-mini:paid,mistralai/mistral-7b-instruct:paid
OPENROUTER_FALLBACK_MODELS=meta-llama/llama-3.3-70b-instruct:free,qwen/qwen-3-235b-a22b:free

# BYOK encryption
BYOK_ENCRYPTION_SECRET=

# Payments
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database

Run migrations in order from `Backend/migrations/` via the Supabase SQL Editor, then:

```bash
pnpm dev
```

---

## Deployment

**Vercel** (recommended):

- Root directory: `Frontend`
- Build command: `pnpm build`
- Install command: `pnpm install`
- Add all env vars in the Vercel dashboard

Pushes to `main` deploy automatically.

---

## Roadmap

This project is in active development. The foundation is solid — auth, payments, AI, data model — and the next phase is about making the learning engine smarter, drawing from well-established research in cognitive science and educational psychology.

**Shipped**

- [x] Auth (Google OAuth + Magic Link)
- [x] Notes + Categories (Markdown, CRUD)
- [x] Single-note and multi-note AI quiz
- [x] Study session tracking + AI feedback
- [x] Credit system (free tier + paid top-up)
- [x] Stripe subscriptions (Pro plan)
- [x] BYOK (Bring Your Own OpenRouter Key)
- [x] Anonymous user feedback
- [x] Email system (welcome, receipts, contact)
- [x] Page transitions + skeleton loading states

**In Progress**

- [ ] Session history — view past quizzes, scores, AI feedback per note
- [ ] Weak-area dashboard — which topics consistently trip you up

**Planned — Learning Science**

- [ ] **Spaced repetition** (SM-2 / FSRS algorithm) — schedule notes for review at the optimal moment before forgetting
- [ ] **Interleaving** — mix questions across categories in a single session to strengthen discrimination between concepts
- [ ] **Desirable difficulty** — dynamically increase question complexity as performance improves
- [ ] **Metacognitive summary** — end-of-session report: confidence vs. actual performance, blind spots identified

**Planned — Product**

- [ ] Note import (Markdown files, Notion export)
- [ ] Mobile-optimised review mode

---

The App : [Echoflow](https://echoflow-app.com)

[![GitHub](https://img.shields.io/badge/GitHub-ElAkab-181717?logo=github)](https://github.com/ElAkab)
[![Twitter](https://img.shields.io/badge/Twitter-@El_Akab-1DA1F2?logo=twitter)](https://twitter.com/El_Akab)
