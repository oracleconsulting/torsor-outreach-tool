-- Check PostgREST configuration
-- This will show if the outreach schema is accessible

-- Check current schema search path
SHOW search_path;

-- Check if outreach schema exists and is accessible
SELECT 
    nspname as schema_name,
    nspowner::regrole as owner
FROM pg_namespace 
WHERE nspname = 'outreach';

-- Check PostgREST configuration (if accessible)
-- Note: PostgREST config is usually in the Supabase dashboard, not in SQL
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'outreach'
ORDER BY tablename;

-- Try to verify if we can query the schema
SELECT COUNT(*) as director_count 
FROM outreach.directors;

