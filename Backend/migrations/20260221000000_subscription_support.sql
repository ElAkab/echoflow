-- Migration: Subscription support + audit log resource_type bug fix
-- Date: 2026-02-21
-- Author: Claude (Dev via BMad Orchestrator)
--
-- Changes:
--   1. BUG FIX: 'PROFILES' → 'PROFILE' in consume_credit/add_credits RPCs
--      Root cause: audit_logs.resource_type CHECK constraint only allows 'PROFILE'
--      (singular), but both RPCs were inserting 'PROFILES' (plural). This caused
--      a CHECK violation that rolled back the ENTIRE credit transaction — credits
--      were never consumed OR added after purchase.
--
--   2. FEATURE: subscription_status + stripe_subscription_id columns on profiles
--      Enables the Pro monthly subscription plan (€7/month, unlimited premium access).

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Add subscription columns to profiles
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive'
        CHECK (subscription_status IN ('inactive', 'active', 'cancelled', 'past_due')),
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN public.profiles.subscription_status IS
    'Stripe subscription state: inactive | active | cancelled | past_due. Set by webhook.';
COMMENT ON COLUMN public.profiles.stripe_subscription_id IS
    'Stripe subscription ID (sub_...). Used to link subscription events to users.';

-- Index for subscription lookups (webhook needs to find user by subscription ID)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id
    ON public.profiles(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Fix consume_credit() — 'PROFILES' → 'PROFILE' in audit log INSERT
--
-- The previous version used resource_type = 'PROFILES' which is not in the
-- audit_logs CHECK constraint, causing every credit consumption to fail.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.consume_credit(
    p_user_id UUID,
    p_is_premium_request BOOLEAN DEFAULT TRUE
) RETURNS TABLE (
    success         BOOLEAN,
    new_balance     INTEGER,
    new_free_used   INTEGER,
    used_premium    BOOLEAN,
    message         TEXT
) AS $$
DECLARE
    v_record    RECORD;
    v_free_limit INTEGER := 20;
BEGIN
    -- Lock profile row for atomic operation
    SELECT credits, free_used_today, free_reset_at, subscription_status
    INTO v_record
    FROM public.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 0, FALSE, 'User not found'::TEXT;
        RETURN;
    END IF;

    -- Active subscribers bypass credit deduction entirely
    IF v_record.subscription_status = 'active' THEN
        RETURN QUERY SELECT
            TRUE,
            COALESCE(v_record.credits, 0),
            v_record.free_used_today,
            TRUE,
            'Pro subscriber — no credits consumed'::TEXT;
        RETURN;
    END IF;

    -- Reset free counter if new day (handle NULL explicitly to fix existing records)
    IF v_record.free_reset_at IS NULL
       OR v_record.free_reset_at < DATE_TRUNC('day', NOW()) THEN
        v_record.free_used_today := 0;
        v_record.free_reset_at   := NOW();
    END IF;

    -- ── Priority 1: purchased credits (if premium request) ──────────────────
    IF p_is_premium_request AND COALESCE(v_record.credits, 0) > 0 THEN
        UPDATE public.profiles SET
            credits         = credits - 1,
            free_used_today = v_record.free_used_today,
            free_reset_at   = v_record.free_reset_at
        WHERE id = p_user_id;

        -- FIX: was 'PROFILES' (violated CHECK constraint) — now 'PROFILE'
        INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
        VALUES (p_user_id, 'CREDITS_CONSUMED', 'PROFILE', jsonb_build_object(
            'type', 'purchased',
            'new_balance', v_record.credits - 1
        ));

        RETURN QUERY SELECT
            TRUE,
            v_record.credits - 1,
            v_record.free_used_today,
            TRUE,
            'Credit consumed (purchased)'::TEXT;
        RETURN;
    END IF;

    -- ── Priority 2: free daily quota ────────────────────────────────────────
    IF v_record.free_used_today < v_free_limit THEN
        UPDATE public.profiles SET
            free_used_today = v_record.free_used_today + 1,
            free_reset_at   = v_record.free_reset_at
        WHERE id = p_user_id;

        RETURN QUERY SELECT
            TRUE,
            COALESCE(v_record.credits, 0),
            v_record.free_used_today + 1,
            FALSE,
            'Free quota used'::TEXT;
        RETURN;
    END IF;

    -- ── No credits available ─────────────────────────────────────────────────
    RETURN QUERY SELECT
        FALSE,
        COALESCE(v_record.credits, 0),
        v_record.free_used_today,
        FALSE,
        'No credits available'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Fix add_credits() — 'PROFILES' → 'PROFILE' in audit log INSERT
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id  UUID,
    p_amount   INTEGER,
    p_metadata JSONB DEFAULT '{}'
) RETURNS TABLE (
    success     BOOLEAN,
    new_balance INTEGER,
    message     TEXT
) AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    UPDATE public.profiles
    SET credits = COALESCE(credits, 0) + p_amount
    WHERE id = p_user_id
    RETURNING credits INTO v_balance;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0, 'User not found'::TEXT;
        RETURN;
    END IF;

    -- FIX: was 'PROFILES' (violated CHECK constraint) — now 'PROFILE'
    INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
    VALUES (p_user_id, 'CREDITS_PURCHASED', 'PROFILE', jsonb_build_object(
        'amount',      p_amount,
        'new_balance', v_balance,
        'stripe_data', p_metadata
    ));

    RETURN QUERY SELECT TRUE, v_balance, 'Credits added successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: Helper function to update subscription status from webhook
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_subscription_status(
    p_user_id            UUID,
    p_subscription_id    TEXT,
    p_subscription_status TEXT  -- 'active' | 'inactive' | 'cancelled' | 'past_due'
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles
    SET
        subscription_status    = p_subscription_status,
        stripe_subscription_id = p_subscription_id
    WHERE id = p_user_id;

    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_subscription_status(UUID, TEXT, TEXT) IS
    'Called exclusively by the Stripe webhook handler (service role) to sync subscription state.';
