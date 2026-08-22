-- @better-auth/api-key 1.5.x expects a referenceId column on apikey
-- (it queries by referenceId = userId instead of userId directly)
ALTER TABLE "apikey" ADD COLUMN IF NOT EXISTS "reference_id" text;
UPDATE "apikey" SET "reference_id" = "user_id"::text WHERE "reference_id" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_apikey_reference" ON "apikey" ("reference_id");
