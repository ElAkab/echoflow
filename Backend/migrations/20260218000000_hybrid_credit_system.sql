-- Migration: Hybrid Credit System - Subscription + Top-up
-- Date: 2026-02-18
-- Description: Refactor user_credits for hybrid model (subscription + credits)

-- Step 1: Add new columns to user_credits
ALTER TABLE public.user_credits 
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive' CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'inactive')),
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS free_used_today INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS free_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS monthly_credits_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_credits_limit INTEGER DEFAULT 200;

-- Step 2: Rename balance to premium_balance for clarity
ALTER TABLE public.user_credits 
RENAME COLUMN balance TO premium_balance;

-- Step 3: Create subscription_plans table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_price_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'eur',
    credits_included INTEGER DEFAULT 200,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default plans
INSERT INTO public.subscription_plans (stripe_price_id, name, amount_cents, credits_included)
VALUES 
    ('price_pro_monthly', 'Pro Monthly', 700, 200),
    ('price_credits_topup', 'Credits Top-Up', 300, 30)
ON CONFLICT (stripe_price_id) DO NOTHING;

-- Step 4: Drop old functions
DROP FUNCTION IF EXISTS public.add_credits(UUID, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.consume_credit(UUID);
DROP FUNCTION IF EXISTS public.get_credit_balance(UUID);

-- Step 5: Create new function to check premium access
CREATE OR REPLACE FUNCTION can_use_premium_models(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_status TEXT;
    v_balance INTEGER;
    v_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT subscription_status, premium_balance, current_period_end
    INTO v_status, v_balance, v_period_end
    FROM public.user_credits
    WHERE user_id = p_user_id;
    
    -- Active subscription (check period not expired)
    IF v_status = 'active' AND (v_period_end IS NULL OR v_period_end > NOW()) THEN
        RETURN TRUE;
    END IF;
    
    -- Has purchased credits
    IF COALESCE(v_balance, 0) > 0 THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create new consume_credit function
CREATE OR REPLACE FUNCTION consume_credit(
    p_user_id UUID,
    p_is_premium_request BOOLEAN DEFAULT false
) RETURNS TABLE (
    success BOOLEAN,
    new_premium_balance INTEGER,
    new_free_used INTEGER,
    used_premium BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_record RECORD;
    v_free_limit INTEGER := 20;
    v_monthly_limit INTEGER := 200;
BEGIN
    -- Lock user record for atomic operation
    SELECT * INTO v_record
    FROM public.user_credits
    WHERE user_id = p_user_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
        -- Create record for new user
        INSERT INTO public.user_credits (user_id, premium_balance, subscription_tier, subscription_status)
        VALUES (p_user_id, 0, 'free', 'inactive')
        RETURNING * INTO v_record;
    END IF;
    
    -- Reset free counter if new day
    IF v_record.free_reset_at < DATE_TRUNC('day', NOW()) THEN
        v_record.free_used_today := 0;
        v_record.free_reset_at := NOW();
    END IF;
    
    -- Try premium if requested and available
    IF p_is_premium_request THEN
        -- Check subscription first
        IF v_record.subscription_status = 'active' 
           AND (v_record.current_period_end IS NULL OR v_record.current_period_end > NOW()) THEN
            -- Pro subscriber with active subscription
            IF v_record.monthly_credits_used < v_monthly_limit THEN
                UPDATE public.user_credits SET
                    monthly_credits_used = monthly_credits_used + 1,
                    total_consumed = total_consumed + 1,
                    free_used_today = v_record.free_used_today,
                    free_reset_at = v_record.free_reset_at,
                    updated_at = NOW()
                WHERE user_id = p_user_id;
                
                RETURN QUERY SELECT TRUE, v_record.premium_balance, v_record.free_used_today, TRUE, 
                    'Premium credit consumed (subscription)'::TEXT;
                RETURN;
            END IF;
        END IF;
        
        -- Check purchased credits
        IF COALESCE(v_record.premium_balance, 0) > 0 THEN
            UPDATE public.user_credits SET
                premium_balance = premium_balance - 1,
                total_consumed = total_consumed + 1,
                free_used_today = v_record.free_used_today,
                free_reset_at = v_record.free_reset_at,
                updated_at = NOW()
            WHERE user_id = p_user_id;
            
            RETURN QUERY SELECT TRUE, v_record.premium_balance - 1, v_record.free_used_today, TRUE,
                'Premium credit consumed (purchased)'::TEXT;
            RETURN;
        END IF;
    END IF;
    
    -- Fall back to free tier
    IF v_record.free_used_today < v_free_limit THEN
        UPDATE public.user_credits SET
            free_used_today = v_record.free_used_today + 1,
            total_consumed = total_consumed + 1,
            free_reset_at = v_record.free_reset_at,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        
        RETURN QUERY SELECT TRUE, v_record.premium_balance, v_record.free_used_today + 1, FALSE,
            'Free quota used'::TEXT;
        RETURN;
    END IF;
    
    -- No credits available
    RETURN QUERY SELECT FALSE, v_record.premium_balance, v_record.free_used_today, FALSE,
        'No credits available'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: Create function to add credits (for Stripe webhooks)
CREATE OR REPLACE FUNCTION add_credits(
    p_user_id UUID,
    p_amount INTEGER,
    p_metadata JSONB DEFAULT '{}'
) RETURNS TABLE (
    success BOOLEAN,
    new_balance INTEGER,
    message TEXT
) AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    INSERT INTO public.user_credits (
        user_id, 
        premium_balance, 
        total_purchased,
        subscription_tier,
        subscription_status
    )
    VALUES (p_user_id, p_amount, p_amount, 'free', 'inactive')
    ON CONFLICT (user_id) 
    DO UPDATE SET
        premium_balance = user_credits.premium_balance + p_amount,
        total_purchased = user_credits.total_purchased + p_amount,
        updated_at = NOW()
    RETURNING user_credits.premium_balance INTO v_balance;
    
    -- Log audit
    INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
    VALUES (p_user_id, 'CREDITS_PURCHASED', 'USER_CREDITS', jsonb_build_object(
        'amount', p_amount,
        'new_balance', v_balance,
        'stripe_data', p_metadata
    ));
    
    RETURN QUERY SELECT TRUE, v_balance, 'Credits added successfully'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Create function to update subscription status
CREATE OR REPLACE FUNCTION update_subscription(
    p_user_id UUID,
    p_stripe_customer_id TEXT,
    p_stripe_subscription_id TEXT,
    p_status TEXT,
    p_current_period_end TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.user_credits SET
        stripe_customer_id = p_stripe_customer_id,
        stripe_subscription_id = p_stripe_subscription_id,
        subscription_status = p_status,
        subscription_tier = CASE WHEN p_status = 'active' THEN 'pro' ELSE 'free' END,
        current_period_end = p_current_period_end,
        monthly_credits_used = CASE WHEN p_status = 'active' THEN 0 ELSE monthly_credits_used END,
        updated_at = NOW()
    WHERE user_id = p_user_id;
    
    -- Log audit
    INSERT INTO public.audit_logs (user_id, action, resource_type, metadata)
    VALUES (p_user_id, 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION', jsonb_build_object(
        'status', p_status,
        'stripe_customer_id', p_stripe_customer_id,
        'stripe_subscription_id', p_stripe_subscription_id
    ));
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 9: Create function to reset monthly credits (call via cron)
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.user_credits
    SET monthly_credits_used = 0,
        updated_at = NOW()
    WHERE subscription_status = 'active'
      AND (current_period_end IS NULL OR current_period_end > NOW());
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_credits_subscription 
ON public.user_credits(subscription_status, current_period_end);

CREATE INDEX IF NOT EXISTS idx_user_credits_stripe_customer 
ON public.user_credits(stripe_customer_id);

-- Comments
COMMENT ON TABLE public.user_credits IS 'User credits and subscription status for hybrid billing model';
COMMENT ON COLUMN public.user_credits.premium_balance IS 'Purchased credits that never expire';
COMMENT ON COLUMN public.user_credits.monthly_credits_used IS 'Credits used this month (for Pro subscribers)';
COMMENT ON COLUMN public.user_credits.free_used_today IS 'Free tier usage today (resets at midnight)';
