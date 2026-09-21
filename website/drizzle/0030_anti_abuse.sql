-- Anti-alt / anti-abuse: track signup IP and flag possible alt accounts.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "signup_ip" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "alt_warning" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_signup_ip_idx" ON "user" USING btree ("signup_ip");