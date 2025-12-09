-- Grant access to Torsor Outreach Tool
-- Access is controlled by the practice_members table
-- Users must be in practice_members to access the tool

-- Step 1: Find the user_id for jhoward@rpgcc.co.uk
-- Run this first to get the user ID:
SELECT id, email 
FROM auth.users 
WHERE email = 'jhoward@rpgcc.co.uk';

-- Step 2: Find the practice_id (usually RPGCC practice)
-- Run this to see available practices:
SELECT id, name 
FROM practices 
ORDER BY name;

-- Step 3: Grant access by adding user to practice_members
-- Replace <USER_ID> and <PRACTICE_ID> with actual values from steps 1 and 2
-- Example:
/*
INSERT INTO practice_members (practice_id, user_id, role)
VALUES (
  '<PRACTICE_ID>',  -- Replace with actual practice_id
  '<USER_ID>',      -- Replace with user_id from step 1
  'member'          -- or 'admin' if they should have admin access
)
ON CONFLICT (practice_id, user_id) DO NOTHING;
*/

-- Step 4: Verify access was granted
-- Run this to check:
SELECT 
  pm.id,
  p.name as practice_name,
  u.email,
  pm.role,
  pm.created_at
FROM practice_members pm
JOIN practices p ON p.id = pm.practice_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'jhoward@rpgcc.co.uk';

-- To add more users later, repeat steps 1-3 with different email addresses

