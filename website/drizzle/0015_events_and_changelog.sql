-- Global settings table (key-value store for things like event multiplier)
CREATE TABLE IF NOT EXISTS "global_setting" (
    "key" varchar(100) PRIMARY KEY NOT NULL,
    "value" text NOT NULL,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    "updated_by" integer REFERENCES "user"("id") ON DELETE SET NULL
);

-- Seed default settings
INSERT INTO "global_setting" ("key", "value") VALUES
    ('arcade_multiplier', '1'),
    ('arcade_multiplier_label', 'Normal'),
    ('arcade_multiplier_active', 'false'),
    ('arcade_event_ends_at', '')
ON CONFLICT ("key") DO NOTHING;

-- Changelog/updates table
CREATE TABLE IF NOT EXISTS "changelog_entry" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar(200) NOT NULL,
    "content" text NOT NULL,
    "tag" varchar(50) DEFAULT 'update',
    "created_at" timestamp with time zone NOT NULL DEFAULT now(),
    "created_by" integer REFERENCES "user"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "changelog_entry_created_at_idx" ON "changelog_entry" ("created_at");
