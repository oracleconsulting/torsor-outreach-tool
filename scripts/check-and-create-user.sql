-- Check if user exists in auth.users and create if needed
-- This script checks if jhoward@rpgcc.co.uk exists in auth.users
-- If not, you'll need to create them via Supabase Dashboard

-- ============================================================================
-- STEP 1: Check if user exists in auth.users
-- ============================================================================
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN 'Email NOT confirmed'
    ELSE 'Email confirmed'
  END as email_status
FROM auth.users
WHERE email = 'jhoward@rpgcc.co.uk';

-- ============================================================================
-- STEP 2: If user doesn't exist, you need to create them via Supabase Dashboard
-- ============================================================================
-- Go to: Supabase Dashboard → Authentication → Users → Add User
-- Enter:
--   - Email: jhoward@rpgcc.co.uk
--   - Password: (use the same password as your other Torsor accounts)
--   - Auto Confirm User: ✅ (check this box)
--   - Send invitation email: ❌ (uncheck if you don't want to send email)
--
-- After creating the user, run the diagnose-and-fix-jhoward.sql script
-- to ensure they're in practice_members

-- ============================================================================
-- STEP 3: If user exists but email is not confirmed, you can manually confirm
-- ============================================================================
-- Run this ONLY if the user exists but email_confirmed_at is NULL:
/*
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email = 'jhoward@rpgcc.co.uk';
*/

-- ============================================================================
-- STEP 4: Verify everything is set up correctly
-- ============================================================================
SELECT 
  'User in auth.users' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'jhoward@rpgcc.co.uk'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
  'User in practice_members' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM practice_members pm
    JOIN auth.users u ON u.id = pm.user_id
    WHERE u.email = 'jhoward@rpgcc.co.uk'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
UNION ALL
SELECT 
  'Email confirmed' as check_type,
  CASE WHEN EXISTS (
    SELECT 1 FROM auth.users 
    WHERE email = 'jhoward@rpgcc.co.uk' 
    AND email_confirmed_at IS NOT NULL
  ) THEN '✅ CONFIRMED' ELSE '❌ NOT CONFIRMED' END as status;

