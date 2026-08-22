-- @better-auth/api-key 1.5.x inserts only reference_id (never user_id),
-- so fill user_id automatically from reference_id.
CREATE OR REPLACE FUNCTION apikey_fill_user_id() RETURNS trigger AS $$
BEGIN
	IF NEW.user_id IS NULL AND NEW.reference_id IS NOT NULL THEN
		NEW.user_id := NEW.reference_id::integer;
	END IF;
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_apikey_fill_user_id ON apikey;
CREATE TRIGGER trg_apikey_fill_user_id BEFORE INSERT ON apikey
FOR EACH ROW EXECUTE FUNCTION apikey_fill_user_id();
