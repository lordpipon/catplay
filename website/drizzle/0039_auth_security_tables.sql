CREATE TABLE IF NOT EXISTS "passkey" (
	"id" serial PRIMARY KEY,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"credential_id" text NOT NULL UNIQUE,
	"counter" integer NOT NULL DEFAULT 0,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL DEFAULT false,
	"transports" text,
	"aaguid" text,
	"created_at" timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "passkey_user_id_idx" ON "passkey" ("user_id");
CREATE INDEX IF NOT EXISTS "passkey_credential_id_idx" ON "passkey" ("credential_id");

CREATE TABLE IF NOT EXISTS "two_factor" (
	"id" serial PRIMARY KEY,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"user_id" integer NOT NULL REFERENCES "user"("id") ON DELETE cascade,
	"verified" boolean NOT NULL DEFAULT true,
	"failed_verification_count" integer NOT NULL DEFAULT 0,
	"locked_until" timestamp with time zone
);
CREATE INDEX IF NOT EXISTS "two_factor_secret_idx" ON "two_factor" ("secret");
CREATE INDEX IF NOT EXISTS "two_factor_user_id_idx" ON "two_factor" ("user_id");
