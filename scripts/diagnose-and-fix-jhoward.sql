-- Diagnostic and Fix Script for jhoward@rpgcc.co.uk
-- Run this in Supabase SQL Editor to diagnose and fix login issues

-- ============================================================================
-- STEP 1: Check if user exists in auth.users
-- ============================================================================
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at,
  confirmed_at
FROM auth.users
WHERE email = 'jhoward@rpgcc.co.uk';

-- ============================================================================
-- STEP 2: Check if user is in practice_members
-- ============================================================================
SELECT 
  pm.id,
  pm.practice_id,
  pm.user_id,
  pm.role,
  pm.created_at,
  p.name as practice_name
FROM practice_members pm
JOIN practices p ON p.id = pm.practice_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'jhoward@rpgcc.co.uk';

-- ============================================================================
-- STEP 3: Check all practices available
-- ============================================================================
SELECT id, name, created_at FROM practices ORDER BY created_at;

-- ============================================================================
-- STEP 4: Fix - Grant access (run this if user exists but not in practice_members)
-- ============================================================================
DO $$
DECLARE
  v_user_id UUID;
  v_practice_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'jhoward@rpgcc.co.uk';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jhoward@rpgcc.co.uk not found in auth.users. User needs to be created first via Supabase Auth or signup flow.';
  END IF;
  
  -- Get practice ID (try to find RPGCC practice, otherwise use first practice)
  SELECT id INTO v_practice_id
  FROM practices
  WHERE name ILIKE '%rpgcc%' OR name ILIKE '%rpg%'
  LIMIT 1;
  
  IF v_practice_id IS NULL THEN
    SELECT id INTO v_practice_id
    FROM practices
    ORDER BY created_at
    LIMIT 1;
  END IF;
  
  IF v_practice_id IS NULL THEN
    RAISE EXCEPTION 'No practice found. Please create a practice first.';
  END IF;
  
  -- Insert or update practice_members
  INSERT INTO practice_members (practice_id, user_id, role)
  VALUES (v_practice_id, v_user_id, 'member')
  ON CONFLICT (practice_id, user_id) 
  DO UPDATE SET role = 'member';
  
  RAISE NOTICE 'Access granted to jhoward@rpgcc.co.uk for practice %', v_practice_id;
END $$;

-- ============================================================================
-- STEP 5: Verify fix
-- ============================================================================
SELECT 
  u.email,
  p.name as practice_name,
  pm.role,
  pm.created_at as access_granted_at
FROM practice_members pm
JOIN practices p ON p.id = pm.practice_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'jhoward@rpgcc.co.uk';

