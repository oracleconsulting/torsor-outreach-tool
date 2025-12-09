#!/bin/bash

# Deploy Edge Functions to Supabase
# Usage: ./deploy-functions.sh

PROJECT_REF="mvdejlkiqslwrbarwxkw"

echo "🚀 Deploying Edge Functions to Supabase..."
echo ""

echo "📦 Deploying companies-house function..."
supabase functions deploy companies-house --project-ref $PROJECT_REF

echo ""
echo "📦 Deploying address-discovery function..."
supabase functions deploy address-discovery --project-ref $PROJECT_REF

echo ""
echo "✅ Deployment complete!"
echo ""
echo "⚠️  Don't forget to set the Companies House API key:"
echo "   supabase secrets set COMPANIES_HOUSE_API_KEY=your_key --project-ref $PROJECT_REF"

