# User Access Guide - Torsor Outreach Tool

## How Access Works

Access to the Torsor Outreach Tool is controlled by the **`practice_members`** table in Supabase. Users must:

1. Have an account in `auth.users` (Supabase Auth)
2. Be a member of a practice in `practice_members`
3. The practice must exist in the `practices` table

## Granting Access

### Option 1: Quick Script (Recommended)

Run the script `scripts/grant-access-jhoward.sql` in Supabase SQL Editor. This will:
- Find the user `jhoward@rpgcc.co.uk`
- Find the RPGCC practice (or first practice if not found)
- Add the user to `practice_members`

### Option 2: Manual SQL

1. **Find the user ID:**
```sql
SELECT id, email 
FROM auth.users 
WHERE email = 'jhoward@rpgcc.co.uk';
```

2. **Find the practice ID:**
```sql
SELECT id, name 
FROM practices 
ORDER BY name;
```

3. **Grant access:**
```sql
INSERT INTO practice_members (practice_id, user_id, role)
VALUES (
  '<PRACTICE_ID>',  -- Replace with actual practice_id
  '<USER_ID>',      -- Replace with user_id from step 1
  'member'          -- or 'admin' for admin access
)
ON CONFLICT (practice_id, user_id) DO NOTHING;
```

4. **Verify:**
```sql
SELECT 
  p.name as practice_name,
  u.email,
  pm.role
FROM practice_members pm
JOIN practices p ON p.id = pm.practice_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'jhoward@rpgcc.co.uk';
```

## Adding More Users Later

To add additional users:

1. Make sure they have a Supabase Auth account (they can sign up or you can create one)
2. Run the same SQL but replace the email address
3. Or use the quick script and modify the email

## Removing Access

To remove access, delete from `practice_members`:

```sql
DELETE FROM practice_members
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
)
AND practice_id = '<PRACTICE_ID>';
```

## Current Setup

**Initial Access:**
- `jhoward@rpgcc.co.uk` - Member access

**To add more users:**
- Use the scripts above or modify the SQL queries
- All users must be in the same practice (or create separate practices if needed)

## Troubleshooting

**User can't log in:**
- Check they exist in `auth.users`
- Check they're in `practice_members` for the correct practice
- Check the practice exists in `practices` table

**"You do not have access" error:**
- User is not in `practice_members` table
- User's `practice_id` doesn't match any practice
- Run the verification query above to check

