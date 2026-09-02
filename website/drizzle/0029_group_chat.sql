-- Group chat memberships. GROUP channels use this table; DIRECT channels keep user1_id/user2_id.

CREATE TABLE "chat_channel_member" (
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_channel_member_pk" PRIMARY KEY("channel_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_channel_id_chat_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."chat_channel"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_channel_member" ADD CONSTRAINT "chat_channel_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_channel_member_channel_idx" ON "chat_channel_member" USING btree ("channel_id");
--> statement-breakpoint
CREATE INDEX "chat_channel_member_user_idx" ON "chat_channel_member" USING btree ("user_id");