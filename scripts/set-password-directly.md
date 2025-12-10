# Set Password Directly for jhoward@rpgcc.co.uk

Since password reset emails aren't arriving, here are ways to set the password directly:

## Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link to your project**:
   ```bash
   supabase link --project-ref mvdejlkiqslwrbarwxkw
   ```

4. **Update user password**:
   ```bash
   supabase db execute --sql "
   SELECT auth.update_user_password(
     '0f73ff7e-cafc-4241-8719-8194f66581ab'::uuid,
     'your_new_password_here'
   );
   "
   ```

## Option 2: Using Supabase Management API

You can use the Supabase Management API to update the password. You'll need:
- Your Supabase Access Token (get from Supabase Dashboard → Account → Access Tokens)
- The user's UUID: `0f73ff7e-cafc-4241-8719-8194f66581ab`

**Using curl:**
```bash
curl -X PUT 'https://api.supabase.com/v1/projects/mvdejlkiqslwrbarwxkw/auth/users/0f73ff7e-cafc-4241-8719-8194f66581ab' \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "password": "your_new_password_here"
  }'
```

## Option 3: Create a Temporary Admin Function

Create a temporary Edge Function or use SQL to update the password hash directly (less secure, but works):

```sql
-- WARNING: This requires knowing the password hash format
-- Better to use Option 1 or 2 above
```

## Option 4: Check Email Configuration

The emails might not be arriving because:
1. **Email provider not configured** - Go to Supabase Dashboard → Authentication → Email Templates
2. **SMTP not set up** - Go to Project Settings → Auth → SMTP Settings
3. **Emails going to spam** - Check spam folder
4. **Email rate limiting** - Supabase has rate limits on emails

## Quick Fix: Use Supabase Dashboard Password Update

If you have admin access:
1. Go to Supabase Dashboard → Authentication → Users
2. Click on `jhoward@rpgcc.co.uk`
3. Look for "Update user" or "Edit user" option
4. Some Supabase versions allow direct password update in the UI

## Recommended: Use Supabase CLI (Option 1)

The CLI method is the most reliable. If you don't have the CLI installed, I can help you set it up.

