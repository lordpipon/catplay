ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "signup_device_id" text;
CREATE INDEX IF NOT EXISTS "user_signup_device_idx" ON "user" ("signup_device_id");
