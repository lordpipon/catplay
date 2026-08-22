-- Add missing promo code columns (reward_type, is_secret) for databases
-- created before these columns existed; 0014's CREATE TABLE IF NOT EXISTS skipped them.
ALTER TABLE "promo_code" ADD COLUMN IF NOT EXISTS "reward_type" "promo_reward_type" NOT NULL DEFAULT 'BASE_CURRENCY';
ALTER TABLE "promo_code" ADD COLUMN IF NOT EXISTS "is_secret" boolean NOT NULL DEFAULT false;
ALTER TABLE "promo_code_redemption" ADD COLUMN IF NOT EXISTS "reward_type" "promo_reward_type" NOT NULL DEFAULT 'BASE_CURRENCY';
