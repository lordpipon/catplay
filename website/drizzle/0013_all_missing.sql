-- From 0001
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "link" text;

-- From 0002
ALTER TABLE "coin" ADD COLUMN IF NOT EXISTS "trading_unlocks_at" timestamp;
ALTER TABLE "coin" ADD COLUMN IF NOT EXISTS "is_locked" boolean DEFAULT true NOT NULL;

-- From 0003
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gambling_losses" numeric(20, 8) DEFAULT '0.00000000' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gambling_wins" numeric(20, 8) DEFAULT '0.00000000' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "halloween_badge_2025" boolean DEFAULT false;

-- From 0004
CREATE TABLE IF NOT EXISTS "user_achievement" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "achievement_id" varchar(50) NOT NULL,
    "unlocked_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_achievement_unique" UNIQUE("user_id","achievement_id")
);
DO $$ BEGIN
    ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "user_achievement_user_id_idx" ON "user_achievement" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "user_achievement_achievement_id_idx" ON "user_achievement" USING btree ("achievement_id");
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_arcade_games_played" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "arcade_win_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "arcade_best_win_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "total_arcade_wagered" numeric(20, 8) DEFAULT '0.00000000' NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "crates_opened" integer DEFAULT 0 NOT NULL;

-- From 0006
CREATE TABLE IF NOT EXISTS "mention" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" integer NOT NULL,
    "mentioned_by_id" integer NOT NULL,
    "post_id" integer,
    "comment_id" integer,
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
DO $$ BEGIN
    ALTER TABLE "mention" ADD CONSTRAINT "mention_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "mention" ADD CONSTRAINT "mention_mentioned_by_id_user_id_fk" FOREIGN KEY ("mentioned_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "mention_user_id_idx" ON "mention" USING btree ("user_id");

-- From 0007
CREATE TABLE IF NOT EXISTS "user_block" (
    "id" serial PRIMARY KEY NOT NULL,
    "blocker_id" integer NOT NULL,
    "blocked_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "user_block_unique" UNIQUE("blocker_id","blocked_id")
);
DO $$ BEGIN
    ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocker_id_user_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "user_block" ADD CONSTRAINT "user_block_blocked_id_user_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
CREATE INDEX IF NOT EXISTS "user_block_blocker_id_idx" ON "user_block" USING btree ("blocker_id");
CREATE INDEX IF NOT EXISTS "user_block_blocked_id_idx" ON "user_block" USING btree ("blocked_id");

-- New Catplay columns
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "flags" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "disable_mentions" boolean DEFAULT false NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "gems" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "name_color" varchar(7);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "timezone" varchar(50) DEFAULT 'UTC';

-- Transfer note
ALTER TABLE "transaction" ADD COLUMN IF NOT EXISTS "note" varchar(500);
