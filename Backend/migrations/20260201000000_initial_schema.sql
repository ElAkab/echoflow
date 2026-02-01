-- =============================================
-- Brain Loop - Initial Database Schema
-- =============================================
-- Migration: 20260201000000_initial_schema.sql
-- Author: Winston (Architect)
-- Date: 2026-02-01
-- Description: Creates core tables for Brain Loop MVP
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE: profiles
-- =============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'FREE' CHECK (subscription_tier IN ('FREE', 'PRO', 'ENTERPRISE')),
  energy_credits INTEGER DEFAULT 0,
  hint_credits INTEGER DEFAULT 0 CHECK (hint_credits >= 0),
  hint_credits_reset_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 week'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_subscription_tier ON public.profiles(subscription_tier);

COMMENT ON TABLE public.profiles IS 'User profiles with subscription and quota tracking';

-- =============================================
-- TABLE: categories
-- =============================================
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  ai_model TEXT DEFAULT 'openai/gpt-4o-mini',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_categories_user_id ON public.categories(user_id);

COMMENT ON TABLE public.categories IS 'User-defined knowledge categories with custom AI configuration';

-- =============================================
-- TABLE: notes
-- =============================================
CREATE TABLE public.notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON public.notes(user_id);
CREATE INDEX idx_notes_category_id ON public.notes(category_id);
CREATE INDEX idx_notes_created_at ON public.notes(created_at DESC);

COMMENT ON TABLE public.notes IS 'User notes used as source material for AI-generated quizzes';

-- =============================================
-- TABLE: usage_logs
-- =============================================
CREATE TABLE public.usage_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  model_used TEXT NOT NULL,
  action_type TEXT CHECK (action_type IN ('QUIZ', 'HINT', 'CHAT')),
  energy_cost INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_usage_logs_user_id ON public.usage_logs(user_id);
CREATE INDEX idx_usage_logs_created_at ON public.usage_logs(created_at DESC);

COMMENT ON TABLE public.usage_logs IS 'Audit trail of all AI API calls for cost tracking and analytics';
