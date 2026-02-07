-- =============================================
-- Echoflow - Atomic Hint Credits
-- =============================================
-- Migration: 20260201000003_atomic_hint_credits.sql
-- Author: Winston (Architect)
-- Date: 2026-02-01
-- Description: Prevents race conditions when using hint credits
-- =============================================

-- Atomic function to safely use a hint credit
-- Prevents race condition where multiple requests increment counter simultaneously
CREATE OR REPLACE FUNCTION public.use_hint_credit(user_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  current_credits INTEGER;
  tier TEXT;
BEGIN
  -- Lock row for this transaction (prevents concurrent modifications)
  SELECT hint_credits, subscription_tier INTO current_credits, tier
  FROM profiles 
  WHERE id = user_uuid 
  FOR UPDATE;
  
  -- Check quota (FREE tier only)
  IF tier = 'FREE' AND current_credits >= 3 THEN
    RAISE EXCEPTION 'Weekly hint limit reached. Upgrade to PRO for unlimited hints.';
  END IF;
  
  -- Increment counter atomically
  UPDATE profiles 
  SET hint_credits = hint_credits + 1 
  WHERE id = user_uuid;
  
  -- Return new count
  RETURN current_credits + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.use_hint_credit IS 'Atomically increments hint_credits and enforces quota. Call from API before generating hint.';

-- =============================================
-- Usage Example (from API route):
-- =============================================
-- const { data, error } = await supabase.rpc('use_hint_credit', { user_uuid: userId });
-- if (error) throw new QuotaExceededError(error.message);
-- // Proceed with AI hint generation
-- =============================================
