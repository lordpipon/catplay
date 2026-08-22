-- New user columns added in Catplay that have no migration yet
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "flags" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disable_mentions" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gems" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name_color" varchar(7);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) DEFAULT 'UTC';

-- halloween_badge_2025 was added in 0003 but may be missing if that migration partially failed
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "halloween_badge_2025" boolean DEFAULT false;
