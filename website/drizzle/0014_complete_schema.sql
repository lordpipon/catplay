-- Fix column types that differ from schema
ALTER TABLE "user" ALTER COLUMN "flags" TYPE bigint USING flags::bigint;
ALTER TABLE "user" ALTER COLUMN "timezone" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "timezone" TYPE integer USING 0;
ALTER TABLE "user" ALTER COLUMN "timezone" SET DEFAULT 0;
ALTER TABLE "user" ALTER COLUMN "name_color" TYPE text;

-- Add claimed column to user_achievement if missing
ALTER TABLE "user_achievement" ADD COLUMN IF NOT EXISTS "claimed" boolean NOT NULL DEFAULT false;

-- price_history table
CREATE TABLE IF NOT EXISTS "price_history" (
    "id" serial PRIMARY KEY NOT NULL,
    "coin_id" integer NOT NULL REFERENCES "coin"("id") ON DELETE CASCADE,
    "price" numeric(30, 8) NOT NULL,
    "timestamp" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "price_history_coin_id_idx" ON "price_history" ("coin_id");
CREATE INDEX IF NOT EXISTS "price_history_timestamp_idx" ON "price_history" ("timestamp");

-- apikey table
CREATE TABLE IF NOT EXISTS "apikey" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text,
    "start" text,
    "prefix" text,
    "key" text NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "refill_interval" integer,
    "refill_amount" integer,
    "last_refill_at" timestamp,
    "enabled" boolean,
    "rate_limit_enabled" boolean,
    "rate_limit_time_window" integer,
    "rate_limit_max" integer,
    "request_count" integer,
    "remaining" integer,
    "last_request" timestamp,
    "expires_at" timestamp,
    "created_at" timestamp NOT NULL,
    "updated_at" timestamp NOT NULL,
    "permissions" text,
    "metadata" text
);
CREATE INDEX IF NOT EXISTS "idx_apikey_user" ON "apikey" ("user_id");

-- gem_transactions table
CREATE TABLE IF NOT EXISTS "gem_transactions" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "polar_order_id" varchar(100) NOT NULL UNIQUE,
    "gems_amount" integer NOT NULL,
    "usd_amount" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gem_transactions_user_id_idx" ON "gem_transactions" ("user_id");

-- user_inventory table
DO $$ BEGIN
    CREATE TYPE "shop_item_type" AS ENUM('namecolor');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "user_inventory" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "item_type" shop_item_type NOT NULL,
    "item_key" varchar(100) NOT NULL,
    "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "user_inventory_unique" UNIQUE("user_id", "item_type", "item_key")
);
CREATE INDEX IF NOT EXISTS "user_inventory_user_id_idx" ON "user_inventory" ("user_id");

-- promo_code tables
DO $$ BEGIN
    CREATE TYPE "promo_reward_type" AS ENUM('BASE_CURRENCY', 'GEMS');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "promo_code" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(50) NOT NULL UNIQUE,
    "description" text,
    "reward_amount" numeric(30, 8) NOT NULL,
    "reward_type" promo_reward_type NOT NULL DEFAULT 'BASE_CURRENCY',
    "max_uses" integer,
    "is_active" boolean NOT NULL DEFAULT true,
    "is_secret" boolean NOT NULL DEFAULT false,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS "promo_code_redemption" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer REFERENCES "user"("id") ON DELETE CASCADE,
    "promo_code_id" integer NOT NULL REFERENCES "promo_code"("id"),
    "reward_amount" numeric(30, 8) NOT NULL,
    "reward_type" promo_reward_type NOT NULL DEFAULT 'BASE_CURRENCY',
    "redeemed_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "promo_code_redemption_user_promo_unique" UNIQUE("user_id", "promo_code_id")
);

-- prediction market tables
DO $$ BEGIN
    CREATE TYPE "prediction_market_status" AS ENUM('ACTIVE', 'RESOLVED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "prediction_question" (
    "id" serial PRIMARY KEY NOT NULL,
    "creator_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "question" varchar(200) NOT NULL,
    "status" prediction_market_status NOT NULL DEFAULT 'ACTIVE',
    "resolution_date" timestamp with time zone NOT NULL,
    "ai_resolution" boolean,
    "total_yes_amount" numeric(30, 8) NOT NULL DEFAULT '0.00000000',
    "total_no_amount" numeric(30, 8) NOT NULL DEFAULT '0.00000000',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "resolved_at" timestamp with time zone,
    "requires_web_search" boolean NOT NULL DEFAULT false,
    "validation_reason" text
);
CREATE INDEX IF NOT EXISTS "prediction_question_creator_id_idx" ON "prediction_question" ("creator_id");
CREATE INDEX IF NOT EXISTS "prediction_question_status_idx" ON "prediction_question" ("status");
CREATE INDEX IF NOT EXISTS "prediction_question_resolution_date_idx" ON "prediction_question" ("resolution_date");

CREATE TABLE IF NOT EXISTS "prediction_bet" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "question_id" integer NOT NULL REFERENCES "prediction_question"("id") ON DELETE CASCADE,
    "side" boolean NOT NULL,
    "amount" numeric(30, 8) NOT NULL,
    "actual_winnings" numeric(30, 8),
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "settled_at" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "prediction_bet_user_id_idx" ON "prediction_bet" ("user_id");
CREATE INDEX IF NOT EXISTS "prediction_bet_question_id_idx" ON "prediction_bet" ("question_id");

-- account_deletion_request table
CREATE TABLE IF NOT EXISTS "account_deletion_request" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
    "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
    "scheduled_deletion_at" timestamp with time zone NOT NULL,
    "reason" text,
    "is_processed" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "account_deletion_request_user_id_idx" ON "account_deletion_request" ("user_id");
CREATE INDEX IF NOT EXISTS "account_deletion_request_scheduled_deletion_idx" ON "account_deletion_request" ("scheduled_deletion_at");
