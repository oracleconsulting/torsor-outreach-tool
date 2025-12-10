#!/bin/bash

# Script to reset password for jhoward@rpgcc.co.uk using Supabase Management API
# 
# Prerequisites:
# 1. Get your Supabase Access Token from: https://supabase.com/dashboard/account/tokens
# 2. Set it as an environment variable: export SUPABASE_ACCESS_TOKEN="your_token_here"
# 3. Or replace YOUR_ACCESS_TOKEN below with your actual token

USER_ID="0f73ff7e-cafc-4241-8719-8194f66581ab"
PROJECT_REF="mvdejlkiqslwrbarwxkw"
ACCESS_TOKEN="${SUPABASE_ACCESS_TOKEN:-YOUR_ACCESS_TOKEN}"

# Prompt for new password
echo "Enter new password for jhoward@rpgcc.co.uk:"
read -s NEW_PASSWORD

# Update password via Management API
curl -X PUT "https://api.supabase.com/v1/projects/${PROJECT_REF}/auth/users/${USER_ID}" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"password\": \"${NEW_PASSWORD}\"
  }"

echo ""
echo "Password updated. Try logging in now."

