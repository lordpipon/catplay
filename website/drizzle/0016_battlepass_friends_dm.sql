-- VIP flag is handled via user.flags bit (1n << 9n), no new column needed

-- Battlepass seasons
CREATE TABLE IF NOT EXISTS "battlepass_season" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "description" text,
    "starts_at" timestamp with time zone NOT NULL,
    "ends_at" timestamp with time zone NOT NULL,
    "is_active" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Battlepass tiers (tasks/rewards per level)
CREATE TABLE IF NOT EXISTS "battlepass_tier" (
    "id" serial PRIMARY KEY NOT NULL,
    "season_id" integer NOT NULL REFERENCES "battlepass_season"("id") ON DELETE CASCADE,
    "level" integer NOT NULL,
    "tier" varchar(10) NOT NULL DEFAULT 'free',
    "task_description" varchar(200) NOT NULL,
    "task_type" varchar(50) NOT NULL,
    "task_target" integer NOT NULL DEFAULT 1,
    "reward_type" varchar(20) NOT NULL,
    "reward_amount" numeric(30,8) NOT NULL DEFAULT 0,
    "reward_label" varchar(100),
    CONSTRAINT "battlepass_tier_season_level_tier_unique" UNIQUE("season_id","level","tier")
);

-- User battlepass progress
CREATE TABLE IF NOT EXISTS "battlepass_progress" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "season_id" integer NOT NULL REFERENCES "battlepass_season"("id") ON DELETE CASCADE,
    "level" integer NOT NULL DEFAULT 0,
    "xp" integer NOT NULL DEFAULT 0,
    "claimed_tiers" text NOT NULL DEFAULT '[]',
    CONSTRAINT "battlepass_progress_unique" UNIQUE("user_id","season_id")
);

CREATE INDEX IF NOT EXISTS "battlepass_progress_user_id_idx" ON "battlepass_progress" ("user_id");
CREATE INDEX IF NOT EXISTS "battlepass_progress_season_id_idx" ON "battlepass_progress" ("season_id");

-- Friends
CREATE TABLE IF NOT EXISTS "friendship" (
    "id" serial PRIMARY KEY NOT NULL,
    "requester_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "addressee_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "status" varchar(20) NOT NULL DEFAULT 'pending',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "friendship_unique" UNIQUE("requester_id","addressee_id"),
    CONSTRAINT "no_self_friend" CHECK (requester_id != addressee_id)
);

CREATE INDEX IF NOT EXISTS "friendship_requester_idx" ON "friendship" ("requester_id");
CREATE INDEX IF NOT EXISTS "friendship_addressee_idx" ON "friendship" ("addressee_id");
CREATE INDEX IF NOT EXISTS "friendship_status_idx" ON "friendship" ("status");

-- Direct messages
CREATE TABLE IF NOT EXISTS "direct_message" (
    "id" serial PRIMARY KEY NOT NULL,
    "sender_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "recipient_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
    "content" varchar(1000) NOT NULL,
    "is_read" boolean NOT NULL DEFAULT false,
    "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "dm_sender_idx" ON "direct_message" ("sender_id");
CREATE INDEX IF NOT EXISTS "dm_recipient_idx" ON "direct_message" ("recipient_id");
CREATE INDEX IF NOT EXISTS "dm_conversation_idx" ON "direct_message" ("sender_id","recipient_id");
CREATE INDEX IF NOT EXISTS "dm_created_at_idx" ON "direct_message" ("created_at");
