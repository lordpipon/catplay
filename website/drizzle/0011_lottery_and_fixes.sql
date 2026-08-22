-- Lottery status enum
DO $$ BEGIN
  CREATE TYPE "lottery_status" AS ENUM('ACTIVE', 'DRAWN', 'ROLLED_OVER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Lottery draw table
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

-- Lottery ticket table
CREATE TABLE IF NOT EXISTS "lottery_ticket" (
  "id" serial PRIMARY KEY NOT NULL,
  "draw_id" integer NOT NULL REFERENCES "lottery_draw"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "quantity" integer NOT NULL DEFAULT 1,
  "purchased_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "lottery_ticket_draw_user_unique" UNIQUE("draw_id", "user_id")
);

-- Weekly lottery draw table
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

-- Weekly lottery ticket table
CREATE TABLE IF NOT EXISTS "weekly_lottery_ticket" (
  "id" serial PRIMARY KEY NOT NULL,
  "draw_id" integer NOT NULL REFERENCES "weekly_lottery_draw"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "numbers" varchar(50) NOT NULL,
  "match_count" integer,
  "winnings" numeric(30, 8),
  "purchased_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS "lottery_draw_status_idx" ON "lottery_draw" ("status");
CREATE INDEX IF NOT EXISTS "lottery_draw_date_idx" ON "lottery_draw" ("draw_date");
CREATE INDEX IF NOT EXISTS "lottery_ticket_draw_id_idx" ON "lottery_ticket" ("draw_id");
CREATE INDEX IF NOT EXISTS "lottery_ticket_user_id_idx" ON "lottery_ticket" ("user_id");
CREATE INDEX IF NOT EXISTS "weekly_lottery_draw_status_idx" ON "weekly_lottery_draw" ("status");
CREATE INDEX IF NOT EXISTS "weekly_lottery_draw_date_idx" ON "weekly_lottery_draw" ("draw_date");
CREATE INDEX IF NOT EXISTS "weekly_lottery_ticket_draw_id_idx" ON "weekly_lottery_ticket" ("draw_id");
CREATE INDEX IF NOT EXISTS "weekly_lottery_ticket_user_id_idx" ON "weekly_lottery_ticket" ("user_id");

-- Add TOGGLE_ADMIN to admin_action enum (needed by Catplay head admin panel)
DO $$ BEGIN
  ALTER TYPE "admin_action" ADD VALUE 'TOGGLE_ADMIN';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Groups tables (in case 0010 wasn't applied yet)
CREATE TABLE IF NOT EXISTS "groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(50) NOT NULL,
  "description" varchar(500),
  "icon" text,
  "owner_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
  "is_public" boolean NOT NULL DEFAULT true,
  "treasury_balance" numeric(30, 8) NOT NULL DEFAULT '0.00000000',
  "member_count" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "groups_name_unique" UNIQUE("name")
);

CREATE TABLE IF NOT EXISTS "group_member" (
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'member',
  "joined_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "group_member_pk" PRIMARY KEY("group_id","user_id")
);

CREATE TABLE IF NOT EXISTS "group_join_request" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "group_join_request_unique" UNIQUE("group_id","user_id")
);

CREATE TABLE IF NOT EXISTS "group_wall_post" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
  "content" varchar(500) NOT NULL,
  "is_deleted" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "group_treasury_tx" (
  "id" serial PRIMARY KEY NOT NULL,
  "group_id" integer NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
  "type" varchar(20) NOT NULL,
  "amount" numeric(30, 8) NOT NULL,
  "note" varchar(200),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "groups_owner_id_idx" ON "groups" ("owner_id");
CREATE INDEX IF NOT EXISTS "groups_name_idx" ON "groups" ("name");
CREATE INDEX IF NOT EXISTS "group_member_group_id_idx" ON "group_member" ("group_id");
CREATE INDEX IF NOT EXISTS "group_member_user_id_idx" ON "group_member" ("user_id");
CREATE INDEX IF NOT EXISTS "group_join_request_group_id_idx" ON "group_join_request" ("group_id");
CREATE INDEX IF NOT EXISTS "group_wall_post_group_id_idx" ON "group_wall_post" ("group_id");
CREATE INDEX IF NOT EXISTS "group_treasury_tx_group_id_idx" ON "group_treasury_tx" ("group_id");

-- Admin log table (in case 0009 wasn't applied yet)
DO $$ BEGIN
  CREATE TYPE "admin_action_base" AS ENUM('BAN', 'UNBAN', 'PROMO_CREATE', 'PROMO_DELETE', 'TOGGLE_ADMIN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "admin_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "admin_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "action" "admin_action" NOT NULL,
  "target_user_id" integer REFERENCES "user"("id") ON DELETE SET NULL,
  "details" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "admin_log_admin_id_idx" ON "admin_log" ("admin_id");
CREATE INDEX IF NOT EXISTS "admin_log_action_idx" ON "admin_log" ("action");
CREATE INDEX IF NOT EXISTS "admin_log_created_at_idx" ON "admin_log" ("created_at");

-- Transfer note column (in case 0008 wasn't applied)
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "note" varchar(500);
