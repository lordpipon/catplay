-- Add Discord message id to changelog entries for webhook sync deduplication
ALTER TABLE changelog_entry ADD COLUMN IF NOT EXISTS discord_message_id varchar(255);

CREATE UNIQUE INDEX IF NOT EXISTS changelog_entry_discord_message_id_ux
	ON changelog_entry (discord_message_id)
	WHERE discord_message_id IS NOT NULL;