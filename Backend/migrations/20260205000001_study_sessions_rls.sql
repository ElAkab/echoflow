-- =============================================
-- Echoflow - RLS Policies for Study Sessions
-- =============================================
-- Migration: 20260205000001_study_sessions_rls.sql
-- Author: Dev (BMade)
-- Date: 2026-02-05
-- Description: Row Level Security policies for study_sessions table
-- =============================================

-- Enable RLS
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own study sessions
CREATE POLICY "Users can view own study sessions"
ON public.study_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can only create their own study sessions
CREATE POLICY "Users can create own study sessions"
ON public.study_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own study sessions (for adding feedback later)
CREATE POLICY "Users can update own study sessions"
ON public.study_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own study sessions
CREATE POLICY "Users can delete own study sessions"
ON public.study_sessions
FOR DELETE
USING (auth.uid() = user_id);

COMMENT ON POLICY "Users can view own study sessions" ON public.study_sessions IS 'Allows users to view only their own study history';
COMMENT ON POLICY "Users can create own study sessions" ON public.study_sessions IS 'Allows users to create study sessions for themselves';
COMMENT ON POLICY "Users can update own study sessions" ON public.study_sessions IS 'Allows users to update their own sessions (e.g., add feedback)';
COMMENT ON POLICY "Users can delete own study sessions" ON public.study_sessions IS 'Allows users to delete their own study history';
