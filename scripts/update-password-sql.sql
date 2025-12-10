-- Update Password for jhoward@rpgcc.co.uk
-- 
-- NOTE: Supabase doesn't allow direct password updates via SQL for security reasons.
-- You need to use one of these methods:
--
-- 1. Supabase CLI (recommended):
--    supabase db execute --sql "SELECT auth.update_user_password('0f73ff7e-cafc-4241-8719-8194f66581ab'::uuid, 'new_password');"
--
-- 2. Management API (see reset-password-via-api.sh)
--
-- 3. Dashboard → Authentication → Users → Select user → Update password (if available)
--
-- 4. Password reset email (if email is configured properly)

-- This function exists in Supabase but requires proper permissions:
-- SELECT auth.update_user_password(
--   '0f73ff7e-cafc-4241-8719-8194f66581ab'::uuid,
--   'your_new_password_here'
-- );

-- Alternative: Check if you can use the auth schema functions
-- You might need to enable the auth schema functions first
-- This typically requires superuser access or specific grants

-- If you have access to run functions, try:
DO $$
BEGIN
  -- This will only work if you have the right permissions
  PERFORM auth.update_user_password(
    '0f73ff7e-cafc-4241-8719-8194f66581ab'::uuid,
    'your_new_password_here'
  );
  RAISE NOTICE 'Password updated successfully';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error: %. You may need to use Supabase CLI or Management API instead.', SQLERRM;
END $$;

