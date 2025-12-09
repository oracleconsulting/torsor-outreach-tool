-- Quick script to grant access to jhoward@rpgcc.co.uk
-- Run this in Supabase SQL Editor

-- First, let's find the user and practice
DO $$
DECLARE
  v_user_id UUID;
  v_practice_id UUID;
BEGIN
  -- Get user ID for jhoward@rpgcc.co.uk
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'jhoward@rpgcc.co.uk';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User jhoward@rpgcc.co.uk not found in auth.users';
  END IF;
  
  -- Get practice ID (assuming RPGCC is the practice)
  -- If you have multiple practices, you may need to specify which one
  SELECT id INTO v_practice_id
  FROM practices
  WHERE name ILIKE '%rpgcc%' OR name ILIKE '%rpg%'
  LIMIT 1;
  
  IF v_practice_id IS NULL THEN
    -- If no practice found, get the first practice
    SELECT id INTO v_practice_id
    FROM practices
    ORDER BY created_at
    LIMIT 1;
  END IF;
  
  IF v_practice_id IS NULL THEN
    RAISE EXCEPTION 'No practice found. Please create a practice first.';
  END IF;
  
  -- Check if user is already a member
  IF NOT EXISTS (
    SELECT 1 FROM practice_members 
    WHERE practice_id = v_practice_id AND user_id = v_user_id
  ) THEN
    -- Add user to practice_members
    INSERT INTO practice_members (practice_id, user_id, role)
    VALUES (v_practice_id, v_user_id, 'member');
  ELSE
    -- Update role if already exists
    UPDATE practice_members
    SET role = 'member'
    WHERE practice_id = v_practice_id AND user_id = v_user_id;
  END IF;
  
  RAISE NOTICE 'Access granted to jhoward@rpgcc.co.uk for practice %', v_practice_id;
END $$;

-- Verify the access was granted
SELECT 
  p.name as practice_name,
  u.email,
  pm.role,
  pm.created_at
FROM practice_members pm
JOIN practices p ON p.id = pm.practice_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'jhoward@rpgcc.co.uk';

