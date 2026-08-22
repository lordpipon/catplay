-- =============================================
-- COMPLETE SCHEMA SYNC - runs safely on existing DB
-- =============================================

-- Enums
DO $$ BEGIN CREATE TYPE "shop_item_type" AS ENUM('namecolor'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "promo_reward_type" AS ENUM('BASE_CURRENCY', 'GEMS'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "lottery_status" AS ENUM('ACTIVE', 'DRAWN', 'ROLLED_OVER'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN ALTER TYPE "admin_action" ADD VALUE 'TOGGLE_ADMIN'; EXCEPTION WHEN duplicate_object THEN null; END $$;

-- User columns
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "flags" bigint NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disable_mentions" boolean NOT NULL DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gems" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name_color" text;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" integer DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gambling_losses" numeric(30, 8) NOT NULL DEFAULT '0.00000000';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gambling_wins" numeric(30, 8) NOT NULL DEFAULT '0.00000000';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "halloween_badge_2025" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_arcade_games_played" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "arcade_win_streak" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "arcade_best_win_streak" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_arcade_wagered" numeric(30, 8) NOT NULL DEFAULT '0.00000000';
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "crates_opened" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "prestige_level" integer DEFAULT 0;

-- Coin columns
ALTER TABLE "coin" ADD COLUMN IF NOT EXISTS "trading_unlocks_at" timestamp;
ALTER TABLE "coin" ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT true;

-- Notification columns
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "link" text;

-- Transaction columns
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "note" varchar(500);
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "recipient_user_id" integer REFERENCES "user"("id") ON DELETE SET NULL;
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "sender_user_id" integer REFERENCES "user"("id") ON DELETE SET NULL;

-- apikey table
CREATE TABLE IF NOT EXISTS "apikey" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" text,
    "start" text,
    "prefix" text,
    "key" text NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
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
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "polar_order_id" varchar(100) NOT NULL UNIQUE,
    "gems_amount" integer NOT NULL,
    "usd_amount" integer NOT NULL,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "gem_transactions_user_id_idx" ON "gem_transactions" ("user_id");

-- user_inventory table
CREATE TABLE IF NOT EXISTS "user_inventory" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "item_type" "shop_item_type" NOT NULL,
    "item_key" varchar(100) NOT NULL,
    "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "user_inventory_unique" UNIQUE("user_id", "item_type", "item_key")
);
CREATE INDEX IF NOT EXISTS "user_inventory_user_id_idx" ON "user_inventory" ("user_id");

-- user_achievement table (drop and recreate if missing claimed column)
CREATE TABLE IF NOT EXISTS "user_achievement" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "achievement_id" varchar(50) NOT NULL,
    "unlocked_at" timestamp with time zone NOT NULL DEFAULT now(),
    "claimed" boolean NOT NULL DEFAULT false,
    CONSTRAINT "user_achievement_unique" UNIQUE("user_id", "achievement_id")
);
ALTER TABLE "user_achievement" ADD COLUMN IF NOT EXISTS "claimed" boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "user_achievement_user_id_idx" ON "user_achievement" ("user_id");
CREATE INDEX IF NOT EXISTS "user_achievement_achievement_id_idx" ON "user_achievement" ("achievement_id");

-- user_block table
CREATE TABLE IF NOT EXISTS "user_block" (
    "id" serial PRIMARY KEY NOT NULL,
    "blocker_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "blocked_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "user_block_unique" UNIQUE("blocker_id", "blocked_id"),
    CONSTRAINT "no_self_block" CHECK (blocker_id != blocked_id)
);
CREATE INDEX IF NOT EXISTS "user_block_blocker_id_idx" ON "user_block" ("blocker_id");
CREATE INDEX IF NOT EXISTS "user_block_blocked_id_idx" ON "user_block" ("blocked_id");

-- mention table
CREATE TABLE IF NOT EXISTS "mention" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "mentioned_by_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "post_id" integer,
    "comment_id" integer,
    "read" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "mention_user_id_idx" ON "mention" ("user_id");

-- promo_code table
CREATE TABLE IF NOT EXISTS "promo_code" (
    "id" serial PRIMARY KEY NOT NULL,
    "code" varchar(50) NOT NULL UNIQUE,
    "description" text,
    "reward_amount" numeric(30, 8) NOT NULL,
    "reward_type" "promo_reward_type" NOT NULL DEFAULT 'BASE_CURRENCY',
    "max_uses" integer,
    "is_active" boolean NOT NULL DEFAULT true,
    "is_secret" boolean NOT NULL DEFAULT false,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "user"("id") ON DELETE SET NULL
);

-- promo_code_redemption table
CREATE TABLE IF NOT EXISTS "promo_code_redemption" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer REFERENCES "user"("id") ON DELETE cascade,
    "promo_code_id" integer NOT NULL REFERENCES "promo_code"("id"),
    "reward_amount" numeric(30, 8) NOT NULL,
    "reward_type" "promo_reward_type" NOT NULL DEFAULT 'BASE_CURRENCY',
    "redeemed_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "user_promo_unique" UNIQUE("user_id", "promo_code_id")
);

-- admin_log table
DO $$ BEGIN CREATE TYPE "admin_action" AS ENUM('BAN', 'UNBAN', 'PROMO_CREATE', 'PROMO_DELETE', 'TOGGLE_ADMIN'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "admin_log" (
    "id" serial PRIMARY KEY NOT NULL,
    "admin_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "action" "admin_action" NOT NULL,
    "target_user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "details" text,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "admin_log_admin_id_idx" ON "admin_log" ("admin_id");
CREATE INDEX IF NOT EXISTS "admin_log_action_idx" ON "admin_log" ("action");
CREATE INDEX IF NOT EXISTS "admin_log_created_at_idx" ON "admin_log" ("created_at");

-- groups tables
CREATE TABLE IF NOT EXISTS "groups" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(50) NOT NULL UNIQUE,
    "description" varchar(500),
    "icon" text,
    "owner_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "is_public" boolean NOT NULL DEFAULT true,
    "treasury_balance" numeric(30, 8) NOT NULL DEFAULT '0.00000000',
    "member_count" integer NOT NULL DEFAULT 1,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "groups_owner_id_idx" ON "groups" ("owner_id");
CREATE INDEX IF NOT EXISTS "groups_name_idx" ON "groups" ("name");

CREATE TABLE IF NOT EXISTS "group_member" (
    "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE cascade,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "role" varchar(20) NOT NULL DEFAULT 'member',
    "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "group_member_pk" PRIMARY KEY("group_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "group_member_group_id_idx" ON "group_member" ("group_id");
CREATE INDEX IF NOT EXISTS "group_member_user_id_idx" ON "group_member" ("user_id");

CREATE TABLE IF NOT EXISTS "group_join_request" (
    "id" serial PRIMARY KEY NOT NULL,
    "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE cascade,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "group_join_request_unique" UNIQUE("group_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "group_join_request_group_id_idx" ON "group_join_request" ("group_id");

CREATE TABLE IF NOT EXISTS "group_wall_post" (
    "id" serial PRIMARY KEY NOT NULL,
    "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE cascade,
    "user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "content" varchar(500) NOT NULL,
    "is_deleted" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_wall_post_group_id_idx" ON "group_wall_post" ("group_id");

CREATE TABLE IF NOT EXISTS "group_treasury_tx" (
    "id" serial PRIMARY KEY NOT NULL,
    "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE cascade,
    "user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "type" varchar(20) NOT NULL,
    "amount" numeric(30, 8) NOT NULL,
    "note" varchar(200),
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "group_treasury_tx_group_id_idx" ON "group_treasury_tx" ("group_id");

-- lottery tables
CREATE TABLE IF NOT EXISTS "lottery_draw" (
    "id" serial PRIMARY KEY NOT NULL,
    "draw_date" timestamp with time zone NOT NULL,
    "prize_pool" numeric(30, 8) NOT NULL DEFAULT '0',
    "ticket_revenue" numeric(30, 8) NOT NULL DEFAULT '0',
    "bank_contribution" numeric(30, 8) NOT NULL DEFAULT '0',
    "donations" numeric(30, 8) NOT NULL DEFAULT '0',
    "rollover_amount" numeric(30, 8) NOT NULL DEFAULT '0',
    "total_tickets" integer NOT NULL DEFAULT 0,
    "status" "lottery_status" NOT NULL DEFAULT 'ACTIVE',
    "winner_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
    "winner_prize" numeric(30, 8),
    "draw_chance" numeric(10, 8) NOT NULL DEFAULT '0.00100000',
    "drawn_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "lottery_draw_status_idx" ON "lottery_draw" ("status");
CREATE INDEX IF NOT EXISTS "lottery_draw_date_idx" ON "lottery_draw" ("draw_date");

CREATE TABLE IF NOT EXISTS "lottery_ticket" (
    "id" serial PRIMARY KEY NOT NULL,
    "draw_id" integer NOT NULL REFERENCES "lottery_draw"("id") ON DELETE cascade,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "quantity" integer NOT NULL DEFAULT 1,
    "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "lottery_ticket_draw_user_unique" UNIQUE("draw_id", "user_id")
);
CREATE INDEX IF NOT EXISTS "lottery_ticket_draw_id_idx" ON "lottery_ticket" ("draw_id");
CREATE INDEX IF NOT EXISTS "lottery_ticket_user_id_idx" ON "lottery_ticket" ("user_id");

CREATE TABLE IF NOT EXISTS "weekly_lottery_draw" (
    "id" serial PRIMARY KEY NOT NULL,
    "draw_date" timestamp with time zone NOT NULL,
    "prize_pool" numeric(30, 8) NOT NULL DEFAULT '0',
    "ticket_revenue" numeric(30, 8) NOT NULL DEFAULT '0',
    "donations" numeric(30, 8) NOT NULL DEFAULT '0',
    "rollover_amount" numeric(30, 8) NOT NULL DEFAULT '0',
    "total_tickets" integer NOT NULL DEFAULT 0,
    "status" "lottery_status" NOT NULL DEFAULT 'ACTIVE',
    "drawn_numbers" varchar(50),
    "jackpot_winners_count" integer,
    "match5_winners_count" integer,
    "match4_winners_count" integer,
    "drawn_at" timestamp with time zone,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "weekly_lottery_draw_status_idx" ON "weekly_lottery_draw" ("status");
CREATE INDEX IF NOT EXISTS "weekly_lottery_draw_date_idx" ON "weekly_lottery_draw" ("draw_date");

CREATE TABLE IF NOT EXISTS "weekly_lottery_ticket" (
    "id" serial PRIMARY KEY NOT NULL,
    "draw_id" integer NOT NULL REFERENCES "weekly_lottery_draw"("id") ON DELETE cascade,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
    "numbers" varchar(50) NOT NULL,
    "match_count" integer,
    "winnings" numeric(30, 8),
    "purchased_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "weekly_lottery_ticket_draw_id_idx" ON "weekly_lottery_ticket" ("draw_id");
CREATE INDEX IF NOT EXISTS "weekly_lottery_ticket_user_id_idx" ON "weekly_lottery_ticket" ("user_id");

-- account_deletion_request table
CREATE TABLE IF NOT EXISTS "account_deletion_request" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE cascade,
    "requested_at" timestamp with time zone NOT NULL DEFAULT now(),
    "scheduled_deletion_at" timestamp with time zone NOT NULL,
    "reason" text,
    "is_processed" boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "account_deletion_request_user_id_idx" ON "account_deletion_request" ("user_id");
CREATE INDEX IF NOT EXISTS "account_deletion_request_scheduled_deletion_idx" ON "account_deletion_request" ("scheduled_deletion_at");

-- BURN enum value
DO $$ BEGIN ALTER TYPE "transaction_type" ADD VALUE 'BURN'; EXCEPTION WHEN duplicate_object THEN null; END $$;
