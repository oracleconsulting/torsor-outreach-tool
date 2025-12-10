# Password Reset Instructions for jhoward@rpgcc.co.uk

If the user exists in Supabase but can't log in, you can reset their password:

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to Supabase Dashboard → Authentication → Users
2. Search for `jhoward@rpgcc.co.uk`
3. Click on the user
4. Click "Send password reset email" or "Reset password"
5. User will receive an email to reset their password

## Option 2: Via SQL (Admin Only)

If you need to manually reset the password, you can use Supabase's admin API or the dashboard.

**Note:** Supabase stores passwords as hashed values, so you cannot directly set a password via SQL. You must use:
- Supabase Dashboard → Authentication → Users → Reset Password
- Supabase Management API
- Password reset email flow

## Option 3: Create New User (If user doesn't exist)

If the user doesn't exist in `auth.users`, you can:

1. **Via Supabase Dashboard:**
   - Go to Authentication → Users → Add User
   - Enter email: `jhoward@rpgcc.co.uk`
   - Set a temporary password
   - User will need to change it on first login

2. **Then run the grant-access script:**
   - Run `scripts/diagnose-and-fix-jhoward.sql` to grant access to the practice

## Troubleshooting

### Error: "Invalid login credentials"
- User doesn't exist in `auth.users` → Create user via dashboard
- Wrong password → Reset password via dashboard
- User exists but not in `practice_members` → Run `diagnose-and-fix-jhoward.sql`

### Error: "You do not have access to this application"
- User exists in `auth.users` but not in `practice_members`
- Run `diagnose-and-fix-jhoward.sql` to grant access

### User exists but email not confirmed
- Check `email_confirmed_at` in `auth.users`
- User may need to confirm email first
- Or manually confirm via Supabase Dashboard

