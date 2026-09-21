-- Group chat management: track group creator/owner, DM notification type.

ALTER TABLE "chat_channel" ADD COLUMN IF NOT EXISTS "owner_id" integer
	REFERENCES "user"("id") ON DELETE CASCADE;
--> statement-breakpoint
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'DM';