-- Expose the outreach schema in Supabase PostgREST API
-- This allows the schema to be accessed via the REST API
-- Run this in the Supabase SQL Editor

-- Note: In Supabase, schemas are exposed via the API settings
-- This script ensures the schema exists and has proper permissions
-- You may also need to add 'outreach' to the exposed schemas in:
-- Supabase Dashboard > Settings > API > Exposed Schemas

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA outreach TO authenticated;
GRANT USAGE ON SCHEMA outreach TO anon;
GRANT USAGE ON SCHEMA outreach TO service_role;

-- Ensure all tables in outreach schema are accessible
-- (Tables should already have RLS policies, but we ensure grants are in place)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'outreach') LOOP
        EXECUTE format('GRANT ALL ON outreach.%I TO authenticated', r.tablename);
        EXECUTE format('GRANT ALL ON outreach.%I TO service_role', r.tablename);
    END LOOP;
END $$;

