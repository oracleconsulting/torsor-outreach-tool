# Password Reset for jhoward@rpgcc.co.uk

The user exists in auth.users and practice_members, but login is failing. This suggests a password mismatch.

## Solution: Reset Password via Supabase Dashboard

Since you can see the user in the Supabase Dashboard:

1. **In the right sidebar** (where you see the user details):
   - Look for the **"Reset password"** section
   - Click the button to **"Send password recovery email"**

2. **OR manually reset:**
   - Click on the user in the list
   - In the right sidebar, find **"Reset password"**
   - Click **"Send password recovery email"**
   - Check your email for the reset link
   - Set a new password (use the same one as your other Torsor accounts)

## Alternative: Set Password Directly (if you have admin access)

If you need to set the password directly without email:

1. In Supabase Dashboard → Authentication → Users
2. Click on `jhoward@rpgcc.co.uk`
3. Look for password management options
4. You may need to use the Supabase CLI or API to set password directly

## Why This Might Happen

- The password might have been set differently when the user was created
- Password might have been changed in one project but not synced
- There could be a password hash mismatch

## After Resetting

1. Try logging in with the new password
2. If it still doesn't work, check the browser console for any error messages
3. Verify the Supabase URL in the outreach app matches the project you're looking at

