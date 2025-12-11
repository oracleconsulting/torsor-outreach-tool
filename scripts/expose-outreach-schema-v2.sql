-- Expose the outreach schema in Supabase PostgREST API
-- Run this in the Supabase SQL Editor

-- Method 1: Change schema owner (may help with PostgREST exposure)
ALTER SCHEMA outreach OWNER TO postgres;

-- Method 2: Grant all necessary permissions
GRANT USAGE ON SCHEMA outreach TO postgres;
GRANT USAGE ON SCHEMA outreach TO authenticated;
GRANT USAGE ON SCHEMA outreach TO anon;
GRANT USAGE ON SCHEMA outreach TO service_role;

-- Grant permissions on all tables in the outreach schema
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'outreach') LOOP
        EXECUTE format('GRANT ALL ON outreach.%I TO postgres', r.tablename);
        EXECUTE format('GRANT ALL ON outreach.%I TO authenticated', r.tablename);
        EXECUTE format('GRANT ALL ON outreach.%I TO service_role', r.tablename);
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON outreach.%I TO anon', r.tablename);
    END LOOP;
END $$;

-- Verify the schema exists and is accessible
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname = 'outreach'
ORDER BY tablename;

