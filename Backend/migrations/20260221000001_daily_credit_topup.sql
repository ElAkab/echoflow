-- Migration: Daily Credit Top-Up
-- Date: 2026-02-21
-- Description:
--   Adds a daily minimum credit guarantee: at the start of each new calendar day,
--   if a user's credit balance is below 20, it is automatically set to 20.
--   This replaces the separate free_used_today quota enforcement with a unified
--   credit model where all users receive at least 20 credits per day.
--
--   The top-up is evaluated lazily inside consume_credit() — no cron job needed.
--   free_used_today is retained as a counter for display/analytics purposes.

-- ─────────────────────────────────────────────────────────────────────────────
-- Rewrite consume_credit() with daily top-up logic
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
    v_record     RECORD;
    v_daily_min  INTEGER := 20;
    v_topped_up  BOOLEAN := FALSE;
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

    -- ── Daily top-up: new calendar day → ensure minimum 20 credits ───────────
    IF v_record.free_reset_at IS NULL
       OR v_record.free_reset_at < DATE_TRUNC('day', NOW()) THEN
        v_record.free_used_today := 0;
        v_record.free_reset_at   := NOW();
        -- Top up to daily minimum if credit balance is below threshold
        IF COALESCE(v_record.credits, 0) < v_daily_min THEN
            v_record.credits := v_daily_min;
            v_topped_up := TRUE;
        END IF;
    END IF;

    -- ── Deduct one credit ─────────────────────────────────────────────────────
    IF COALESCE(v_record.credits, 0) > 0 THEN
        UPDATE public.profiles SET
            credits         = v_record.credits - 1,
            free_used_today = v_record.free_used_today + 1,
            free_reset_at   = v_record.free_reset_at
        WHERE id = p_user_id;

        INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
        VALUES (p_user_id, 'CREDITS_CONSUMED', 'PROFILE', jsonb_build_object(
            'type', CASE WHEN v_topped_up THEN 'daily_free' ELSE 'purchased' END,
            'new_balance', v_record.credits - 1
        ));

        RETURN QUERY SELECT
            TRUE,
            v_record.credits - 1,
            v_record.free_used_today + 1,
            -- used_premium = true only for purchased credits (not daily free top-up)
            (NOT v_topped_up AND p_is_premium_request)::BOOLEAN,
            'Credit consumed'::TEXT;
        RETURN;
    END IF;

    -- ── No credits available ──────────────────────────────────────────────────
    RETURN QUERY SELECT
        FALSE,
        0,
        v_record.free_used_today,
        FALSE,
        'No credits available'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.consume_credit(UUID, BOOLEAN) IS
    'Atomically consumes a credit with daily top-up: if new day and credits < 20, sets credits = 20 before deduction. Pro subscribers bypass entirely. Thread-safe via FOR UPDATE.';
