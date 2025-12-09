# Torsor Outreach Tool - Deployment Status

**Last Updated:** December 9, 2025

## ✅ Completed

- [x] Project structure initialized
- [x] Database migration script created
- [x] Edge Functions deployed
  - [x] `companies-house`
  - [x] `address-discovery`
- [x] Frontend services layer
- [x] React Query hooks
- [x] UI components and pages

## ⏳ Next Steps

### 1. Set Companies House API Key Secret
```bash
supabase secrets set COMPANIES_HOUSE_API_KEY=your_key_here --project-ref mvdejlkiqslwrbarwxkw
```

### 2. Run Database Migration
- Open Supabase SQL Editor
- Run `scripts/20251209_create_outreach_schema.sql`
- Verify tables are created in `outreach.*` schema

### 3. Test Edge Functions
Test the deployed functions:

```bash
# Test companies-house function
curl -X POST https://mvdejlkiqslwrbarwxkw.supabase.co/functions/v1/companies-house \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "getCompany", "params": {"companyNumber": "12345678"}}'

# Test address-discovery function
curl -X POST https://mvdejlkiqslwrbarwxkw.supabase.co/functions/v1/address-discovery \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action": "discoverFirmClients", "params": {"firmNumber": "12345678"}}'
```

### 4. Local Development Setup
```bash
cd torsor-outreach-tool
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### 5. Railway Deployment
- Connect GitHub repo to Railway
- Set environment variables:
  - `VITE_SUPABASE_URL=https://mvdejlkiqslwrbarwxkw.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=your_anon_key`
- Configure custom domain: `outreach.torsor.co.uk`

## 🔍 Verification Checklist

- [ ] Companies House API key secret set
- [ ] Database migration executed successfully
- [ ] Edge functions responding to test requests
- [ ] Local dev server running without errors
- [ ] Can authenticate with Supabase
- [ ] Can fetch practice ID from `practice_members` table
- [ ] Railway deployment configured
- [ ] Custom domain configured

## 📝 Notes

- Edge Functions are deployed and ready
- Make sure to set the `COMPANIES_HOUSE_API_KEY` secret before testing
- Database migration must be run before the app can function
- Frontend expects `practice_members` table to exist (from main Torsor schema)

