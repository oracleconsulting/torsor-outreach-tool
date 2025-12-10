-- Set Password Directly for jhoward@rpgcc.co.uk
-- This bypasses the need for email access
-- 
-- IMPORTANT: Replace 'YOUR_NEW_PASSWORD_HERE' with your actual password
-- Use the same password as your other Torsor accounts

-- Update password using PostgreSQL's crypt function
UPDATE auth.users
SET 
  encrypted_password = crypt('YOUR_NEW_PASSWORD_HERE', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'jhoward@rpgcc.co.uk';

-- Verify the update
SELECT 
  email,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password,
  length(encrypted_password) as password_hash_length,
  updated_at
FROM auth.users 
WHERE email = 'jhoward@rpgcc.co.uk';

-- ============================================
-- INSTRUCTIONS:
-- ============================================
-- 1. Replace 'YOUR_NEW_PASSWORD_HERE' above with your actual password
-- 2. Run this script in Supabase SQL Editor
-- 3. Try logging in with the new password
-- ============================================

