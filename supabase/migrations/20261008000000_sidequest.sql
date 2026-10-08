BEGIN;
CREATE SCHEMA IF NOT EXISTS sidequest;
REVOKE ALL ON SCHEMA sidequest FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='sidequest_app') THEN
    CREATE ROLE sidequest_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS sidequest.profiles (
  address text PRIMARY KEY, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sidequest.drafts (
  reference text PRIMARY KEY, creator text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sidequest.quests (
  id text PRIMARY KEY, data jsonb NOT NULL, chain_version numeric(20,0) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sidequest.challenges (
  nonce text PRIMARY KEY, address text NOT NULL, message text NOT NULL, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sidequest.sessions (
  token text PRIMARY KEY, address text NOT NULL, expires bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sidequest.rate_limits (
  key text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS challenges_expiry ON sidequest.challenges (expires);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sidequest.sessions (expires);
CREATE INDEX IF NOT EXISTS rate_limits_expiry ON sidequest.rate_limits (expires);
REVOKE ALL ON ALL TABLES IN SCHEMA sidequest FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA sidequest TO sidequest_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sidequest TO sidequest_app;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','drafts','quests','challenges','sessions','rate_limits'] LOOP
    EXECUTE format('ALTER TABLE sidequest.%I ENABLE ROW LEVEL SECURITY', table_name);
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='sidequest' AND tablename=table_name AND policyname='sidequest_runtime') THEN
      EXECUTE format('CREATE POLICY sidequest_runtime ON sidequest.%I TO sidequest_app USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
