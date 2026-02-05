-- =============================================
-- Brain Loop - Study Sessions Tracking
-- =============================================
-- Migration: 20260205000000_study_sessions.sql
-- Author: Dev (BMade)
-- Date: 2026-02-05
-- Description: Creates study_sessions table to track user learning progress
--              and AI-generated feedback for Story 3.1
-- =============================================

-- =============================================
-- TABLE: study_sessions
-- =============================================
CREATE TABLE public.study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  note_ids UUID[] NOT NULL, -- Array of notes quizzed in this session
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  
  -- Session metadata
  session_type TEXT CHECK (session_type IN ('SINGLE_NOTE', 'MULTI_NOTE')) NOT NULL,
  model_used TEXT NOT NULL,
  
  -- Conversation data (stored as JSON)
  conversation_history JSONB DEFAULT '[]'::jsonb,
  
  -- AI-generated feedback (JSON structure)
  ai_feedback JSONB,
  -- Example structure:
  -- {
  --   "overall_understanding": "good" | "needs_work" | "excellent",
  --   "strengths": ["topic1", "topic2"],
  --   "weaknesses": ["topic3", "topic4"],
  --   "suggestions": "l'utilisateur a encore un peu de mal à comprendre 'x sujet' en 'x catégorie'. Il faut encore travailler dessus",
  --   "topics_mastered": ["topic1"],
  --   "topics_struggling": ["topic2"]
  -- }
  
  -- Session stats
  questions_asked INTEGER DEFAULT 0,
  duration_seconds INTEGER, -- Optional: for future analytics
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_study_sessions_user_id ON public.study_sessions(user_id);
CREATE INDEX idx_study_sessions_category_id ON public.study_sessions(category_id);
CREATE INDEX idx_study_sessions_created_at ON public.study_sessions(created_at DESC);

-- GIN index for JSONB queries (to search within ai_feedback)
CREATE INDEX idx_study_sessions_ai_feedback ON public.study_sessions USING GIN (ai_feedback);

COMMENT ON TABLE public.study_sessions IS 'Tracks user study sessions with AI-generated feedback and progress insights (Story 3.1)';
COMMENT ON COLUMN public.study_sessions.note_ids IS 'Array of UUIDs representing notes used in this study session';
COMMENT ON COLUMN public.study_sessions.ai_feedback IS 'JSON structure containing AI-generated learning insights and recommendations';
COMMENT ON COLUMN public.study_sessions.conversation_history IS 'Complete conversation log between user and AI during the session';
