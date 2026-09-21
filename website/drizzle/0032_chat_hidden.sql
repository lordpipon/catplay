-- Group chat "delete from history": users can hide a group they belong to
-- while remaining a member. Owner-delete (for everyone) is unchanged.

CREATE TABLE IF NOT EXISTS "chat_channel_hidden" (
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_channel_hidden_channel_id_user_id_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_channel_hidden" ADD CONSTRAINT "chat_channel_hidden_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "chat_channel_hidden" ADD CONSTRAINT "chat_channel_hidden_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channel_hidden_user_idx" ON "chat_channel_hidden" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_channel_hidden_channel_idx" ON "chat_channel_hidden" ("channel_id");