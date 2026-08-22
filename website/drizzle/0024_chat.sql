-- Chat channels (DMs, global public chat, admin chats) and their messages
DO $$ BEGIN
	CREATE TYPE "chat_channel_type" AS ENUM('DIRECT', 'ADMIN_GLOBAL', 'HEAD_ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "chat_channel" (
	"id" serial PRIMARY KEY,
	"type" varchar(20) NOT NULL DEFAULT 'DIRECT',
	"user1_id" integer REFERENCES "user"("id") ON DELETE CASCADE,
	"user2_id" integer REFERENCES "user"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "chat_message" (
	"id" serial PRIMARY KEY,
	"channel_id" integer NOT NULL REFERENCES "chat_channel"("id") ON DELETE CASCADE,
	"sender_id" integer NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
	"content" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "chat_channel_type_idx" ON "chat_channel" ("type");
CREATE INDEX IF NOT EXISTS "chat_channel_users_idx" ON "chat_channel" ("user1_id", "user2_id");
CREATE INDEX IF NOT EXISTS "chat_message_channel_created_idx" ON "chat_message" ("channel_id", "created_at");
