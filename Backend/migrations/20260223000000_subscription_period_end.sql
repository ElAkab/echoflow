-- Migration: Track subscription period end for graceful cancellation
-- Date: 2026-02-23
--
-- Changes:
--   1. Add subscription_period_end to profiles
--      Tracks when the current billing period ends so features stay
--      active until that date even after cancellation.
--
--   2. Add stripe_customer_id to profiles (idempotent, may already exist)
--      Needed to link customers across top-up and subscription flows.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

COMMENT ON COLUMN public.profiles.subscription_period_end IS
    'End of current billing period. Access remains active until this date even when subscription_status = ''cancelled''.';

COMMENT ON COLUMN public.profiles.stripe_customer_id IS
    'Stripe customer ID (cus_...). Populated on first checkout and reused for subsequent purchases.';

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
    ON public.profiles(stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;
