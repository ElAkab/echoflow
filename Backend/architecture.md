# Brain Loop Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for Brain Loop, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project
N/A - Greenfield project.

### Change Log
| Date | Version | Description | Author |
| :--- | :--- | :--- | :--- |
| 2026-01-23 | 0.1 | Initial Architecture Draft | Winston (Architect) |
| 2026-02-01 | 0.2 | Finalized quota strategy, RLS policies, and migration structure | Winston (Architect) |

## High Level Architecture

### Technical Summary
Brain Loop adoptera une architecture **"Serverless Monolith"** modulaire, construite autour de **Next.js 14+ (App Router)**. Le frontend et l'API backend résideront dans le même dépôt (Monorepo) pour simplifier le partage de types TypeScript.

Pour le MVP, nous déploierons sur **Vercel** (Frontend/API) et **Supabase** (DB/Auth) pour profiter de leur tier gratuit. Cependant, l'application sera conçue pour être **"Docker-ready"**, permettant une migration facile vers un hébergement VPS (ex: Hetzner + Coolify) si les coûts Vercel deviennent prohibitifs à l'échelle.

L'intégration IA se fera via une passerelle interne (API Route) connectée à **OpenRouter**, assurant que les clés API ne sont jamais exposées au client (Pattern BFF).

### Platform and Infrastructure Choice
**Platform:** **Vercel + Supabase (avec stratégie de sortie Docker)**
**Key Services:**
- Frontend/API: Vercel (Edge Network)
- Database/Auth: Supabase (PostgreSQL, GoTrue)
- AI Gateway: OpenRouter
**Deployment Host and Regions:**
- Region: `us-east-1` (N. Virginia) pour minimiser la latence avec les API OpenRouter/OpenAI, même pour des utilisateurs européens.

### Repository Structure
**Structure:** Modular Monolith (Single Repo)
**Package Organization:**
- `src/app`: Routes Frontend & API (Next.js App Router)
- `src/components`: UI Components (React)
- `src/lib`: Shared Utilities, Database Clients, Types
- `src/core`: Business Logic (AI Prompt construction, Quota calculations) - *Agnostique du framework pour faciliter la migration*
- `supabase/`: SQL Migrations et configurations locales

### High Level Architecture Diagram
```mermaid
graph TD
    User[User (Browser)] -->|HTTPS| CDN[Vercel Edge Network]
    
    subgraph "Next.js Application (Serverless)"
        CDN -->|Static Assets| Static[Static Pages / Assets]
        CDN -->|Dynamic Requests| Server[Next.js Server / API Routes]
        
        Server -->|Auth & Data| DB_Client[Supabase Client]
        Server -->|AI Request| AI_Gateway[Internal AI Gateway]
    end
    
    subgraph "External Services"
        DB_Client -->|PostgreSQL Protocol| Supabase[Supabase (DB & Auth)]
        AI_Gateway -->|Streaming JSON| OpenRouter[OpenRouter API]
    end
    
    Supabase -->|Auth Callback| User
```

### Architectural Patterns
- **Server Components (RSC):** Utilisation massive des composants serveurs React pour le fetching de données directement depuis la DB, réduisant le JavaScript client.
- **BFF (Backend for Frontend):** Les API Routes (`/app/api/...`) agissent comme un proxy sécurisé pour les appels externes (OpenRouter), cachant les secrets.
- **Optimistic UI:** Pour les actions comme "Cocher une note", l'interface se met à jour immédiatement.
- **Streaming SSR:** Pour le chat IA, utilisation de `AI SDK` (Vercel) pour streamer la réponse token par token.

## Tech Stack

### Technology Stack Table
| Category | Technology | Version | Purpose | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Framework** | **Next.js** | 15.0+ (RC/Canary capable) | Fullstack React Framework | Standard actuel, offre Server Components et App Router natif. Support des dernières features React 19. |
| **Language** | **TypeScript** | 5.x | Type Safety | Indispensable pour la maintenance et la sécurité du code. |
| **Styling** | **Tailwind CSS** | 4.0 (Alpha/Beta) or 3.4+ | Utility-first CSS | Rapidité de développement, pas de CSS bloquant le rendu. Tailwind 4 offre un moteur Rust ultra-rapide. |
| **UI Components** | **Shadcn/UI** | Latest | Reusable Components | Basé sur Radix UI, code source copiable (pas de dépendance npm lourde), très flexible. |
| **Icons** | **Lucide React** | Latest | Iconography | Standard moderne, léger et cohérent. |
| **Database** | **PostgreSQL** | 15+ | Relational DB | Via Supabase. Robuste, supporte JSONB, et vector search (pgvector) pour le futur. |
| **Auth** | **Supabase Auth** | Latest | User Identity | Gratuit, sécurisé, gère le Magic Link et Google Auth sans code backend complexe. |
| **State Mgmt** | **Zustand** | Latest | Client State | Plus simple que Redux, parfait pour gérer la session de chat et les préférences. |
| **Form Mgmt** | **React Hook Form** | Latest | Form Validation | Performance optimale, validation facile avec Zod. |
| **Schema Validation** | **Zod** | Latest | Data Validation | Partagé entre Frontend (Form) et Backend (API input validation). |
| **AI SDK** | **Vercel AI SDK** | 4.x (Core) | AI Streaming | Nouvelle version "Core" plus légère et agnostique. Simplifie l'intégration de streams. |
| **Markdown** | **React Markdown** | Latest | Rendering | Pour afficher les réponses riches de l'IA. |
| **Editor** | **Tiptap** | 2.x | WYSIWYG Editor | Headless, très customisable pour la prise de notes. Version React bien supportée. |
| **Testing** | **Playwright** | Latest | E2E Testing | Tests fiables sur le vrai navigateur. |

## Data Models

### Profile (User)
**Purpose:** Extension de la table `auth.users` de Supabase pour stocker les infos publiques, préférences et plan d'abonnement.
**Key Attributes:**
- `id` (UUID): Primary Key, Foreign Key vers `auth.users`.
- `email` (String): Pour affichage et notifications.
- `full_name` (String): Nom d'affichage.
- `avatar_url` (String): URL image profil.
- `subscription_tier` (Enum): 'FREE', 'PRO', 'ENTERPRISE' - Détermine les limites applicables.
- `energy_credits` (Int): Le solde de "Points Neurone" - **Illimité pour FREE** (pas de déduction pour quiz/chat de base).
- `hint_credits` (Int): Compteur de hints utilisés cette semaine (FREE: max 3/semaine).
- `hint_credits_reset_at` (Timestamp): Date de prochain reset hebdomadaire.
- `created_at` (Timestamp): Date d'inscription.
- `updated_at` (Timestamp): Dernière modification.

**Quota Strategy (Freemium-First):**
- **FREE Tier:**
  - Quiz/Chat illimités (fonctionnalité core gratuite)
  - Hints: 3 par semaine (reset hebdomadaire)
  - Pas de limite de notes
  - Pas de limite de catégories
- **PRO Tier (Future):**
  - Hints illimités
  - Accès à des modèles premium (GPT-4, Claude Opus)
  - Analytics avancés
  - Export de données

### Category
**Purpose:** Organise les notes par sujet.
**Key Attributes:**
- `id` (UUID): Primary Key.
- `user_id` (UUID): Foreign Key vers Profile.
- `name` (String): Titre de la catégorie (ex: "Biologie").
- `description` (String): Sous-titre optionnel.
- `system_prompt` (Text): Description contextuelle pour l'IA (ex: "Tu es un expert en biologie").
- `ai_model` (String): ID du modèle OpenRouter sélectionné (ex: "anthropic/claude-3-haiku").
- `created_at` (Timestamp): Date de création.
- `updated_at` (Timestamp): Dernière modification.

### Note
**Purpose:** Le contenu brut de l'utilisateur (source de vérité).
**Key Attributes:**
- `id` (UUID): Primary Key.
- `category_id` (UUID): Foreign Key vers Category.
- `user_id` (UUID): Foreign Key vers Profile (Denormalization pour RLS performance).
- `title` (String): Titre de la note.
- `content` (Text): Contenu (Markdown/HTML).
- `content_embedding` (Vector): *Future-proofing* pour la recherche sémantique (pgvector).
- `is_archived` (Boolean): Pour masquer sans supprimer.
- `created_at` (Timestamp): Date de création.
- `updated_at` (Timestamp): Date de dernière modification.

### UsageLog
**Purpose:** Historique technique pour audit et calcul des coûts.
**Key Attributes:**
- `id` (UUID): Primary Key.
- `user_id` (UUID): Foreign Key vers Profile.
- `tokens_input` (Int): Nombre de tokens envoyés.
- `tokens_output` (Int): Nombre de tokens générés.
- `model_used` (String): Modèle utilisé.
- `action_type` (Enum): 'QUIZ', 'HINT', 'CHAT'.
- `energy_cost` (Int): Coût déduit en crédits.
- `created_at` (Timestamp): Date de l'action.

### StudySession (Story 3.1 - Progress Tracking)
**Purpose:** Track user study sessions with AI-generated feedback for personalized learning insights.
**Key Attributes:**
- `id` (UUID): Primary Key.
- `user_id` (UUID): Foreign Key vers Profile.
- `note_ids` (Array<UUID>): Notes utilisées pendant la session.
- `category_id` (UUID): Foreign Key vers Category (optionnel).
- `session_type` (Enum): 'SINGLE_NOTE' ou 'MULTI_NOTE'.
- `model_used` (String): Modèle AI utilisé pour la session.
- `conversation_history` (JSONB): Historique complet de la conversation.
- `ai_feedback` (JSONB): Feedback structuré généré par l'IA.
  ```json
  {
    "overall_understanding": "good" | "needs_work" | "excellent",
    "strengths": ["topic1", "topic2"],
    "weaknesses": ["topic3", "topic4"],
    "suggestions": "l'utilisateur a encore un peu de mal à comprendre 'x sujet' en 'x catégorie'. Il faut encore travailler dessus",
    "topics_mastered": ["topic1"],
    "topics_struggling": ["topic2"]
  }
  ```
- `questions_asked` (Int): Nombre de questions posées par l'IA.
- `duration_seconds` (Int): Durée de la session (optionnel, pour analytics futures).
- `created_at` (Timestamp): Date de la session.
- `updated_at` (Timestamp): Dernière modification.

### QuizHistory (Optional MVP+)
**Purpose:** Garder une trace des sessions pour l'utilisateur.
**Key Attributes:**
- `id` (UUID): Primary Key.
- `user_id` (UUID): FK.
- `note_ids` (Array<UUID>): Notes utilisées.
- `conversation_json` (JSONB): Le log du chat complet.

### Schema Design
```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- CREATE EXTENSION IF NOT EXISTS "vector"; -- MVP+ for embeddings

-- 1. PROFILES (Extension of auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
  energy_credits INTEGER DEFAULT 0, -- Not used for FREE tier (unlimited core features)
  hint_credits INTEGER DEFAULT 0 CHECK (hint_credits >= 0), -- Counter: used hints this week
  hint_credits_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 week'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CATEGORIES
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT, -- Custom AI persona per category
  ai_model TEXT DEFAULT 'openai/gpt-4o-mini', -- Cost-effective default
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster user category lookups
CREATE INDEX idx_categories_user_id ON public.categories(user_id);

-- 3. NOTES
CREATE TABLE public.notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL, -- Denormalized for RLS efficiency
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_category_id ON public.notes(category_id);
CREATE INDEX idx_notes_created_at ON public.notes(created_at DESC); -- For "recent notes" queries

-- 4. USAGE LOGS (Technical Audit)
CREATE TABLE public.usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Keep logs anonymous if user deletes account
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  model_used TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('QUIZ', 'HINT', 'CHAT')),
  energy_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES (Security Examples)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can view and update only their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- CATEGORIES: Full CRUD for own categories
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON public.categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE USING (auth.uid() = user_id);

-- NOTES: Full CRUD for own notes
CREATE POLICY "Users can view own notes" ON public.notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON public.notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON public.notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON public.notes
  FOR DELETE USING (auth.uid() = user_id);

-- USAGE_LOGS: Read-only access to own logs (for analytics)
CREATE POLICY "Users can view own usage logs" ON public.usage_logs
  FOR SELECT USING (auth.uid() = user_id);

-- TRIGGER for Profile Creation
CREATE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Auto-update updated_at timestamp
CREATE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_category_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TRIGGER on_note_updated
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Weekly hint credits reset function (to be called by Supabase cron or edge function)
CREATE FUNCTION public.reset_hint_credits()
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET 
    hint_credits = 0, -- Reset counter to 0 (allows 3 more hints for FREE tier)
    hint_credits_reset_at = NOW() + INTERVAL '1 week'
  WHERE hint_credits_reset_at <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Unified Project Structure

```text
brain-loop/
├── .github/                    # CI/CD workflows (Tests, Lint)
├── tests/                      # E2E Tests (Playwright)
├── src/
│   ├── app/                    # Next.js App Router (Routes & Pages)
│   │   ├── (auth)/             # Route Group: Login, Signup (Public)
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/        # Route Group: Protected App (Require Auth)
│   │   │   ├── dashboard/
│   │   │   ├── category/[id]/
│   │   │   ├── settings/
│   │   │   └── layout.tsx      # App Shell (Sidebar, Header)
│   │   ├── api/                # API Routes (BFF)
│   │   │   ├── chat/           # OpenRouter Proxy
│   │   │   └── webhooks/       # Stripe/Supabase hooks
│   │   ├── layout.tsx          # Root Layout
│   │   └── page.tsx            # Landing Page
│   ├── components/             # React Components (Colocate unit tests here: *.test.tsx)
│   │   ├── ui/                 # Shadcn Atoms (Button, Input)
│   │   ├── auth/               # Auth Forms
│   │   ├── notes/              # Editor, NoteCard
│   │   └── chat/               # ChatInterface, MessageBubble
│   ├── lib/                    # Shared Logic
│   │   ├── supabase/           # DB Client (Server & Client versions)
│   │   ├── ai/                 # OpenRouter helpers, Prompts
│   │   ├── utils.ts            # CN helper, formatters
│   │   └── types.ts            # Shared TypeScript interfaces
│   ├── hooks/                  # Custom React Hooks (use-chat, use-notes)
│   └── stores/                 # Zustand Stores (use-app-store)
├── supabase/                   # Supabase Config
│   ├── migrations/             # SQL Files
│   └── config.toml
├── public/                     # Static Assets
├── .env.example                # Template for env vars
├── next.config.mjs             # Next.js Config
├── tailwind.config.ts          # Tailwind Theme
└── package.json                # Dependencies
```

## Checklist Results Report

