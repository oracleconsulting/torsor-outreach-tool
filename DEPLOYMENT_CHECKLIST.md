# Deployment Checklist

## ✅ Completed
- [x] Edge functions created and deployed
- [x] Client-side services updated
- [x] UI components created
- [x] Routes configured

## 📋 Your Action Items

### 1. Database Migrations
Run these SQL scripts in order in your Supabase SQL Editor:

1. **`scripts/20251209_create_outreach_schema.sql`** (if not already run)
   - Creates base outreach schema and tables

2. **`scripts/20251209_add_enrichment_schema.sql`** (if not already run)
   - Adds enrichment tables

3. **`scripts/20251209_phase3_intelligence_layer.sql`** (if not already run)
   - Adds director networks and fit matching tables

4. **`scripts/20251209_add_events_tables.sql`** ⚠️ **NEW - REQUIRED**
   - Creates `watchlist` and `triggered_events` tables for event detection

5. **`scripts/20251209_add_outreach_drafts_table.sql`** ⚠️ **NEW - REQUIRED**
   - Creates `outreach_drafts` table for storing generated outreach

### 2. Edge Function Environment Variables
Verify these are set in Supabase Dashboard → Project Settings → Edge Functions → Secrets:

- ✅ `COMPANIES_HOUSE_API_KEY` (already set)
- ✅ `OPENROUTER_API_KEY` (already set for address-enrichment)
- ⚠️ Verify `OPENROUTER_API_KEY` is also available for `generate-outreach` function

### 3. CRON Job Setup (Tomorrow)
Set up a daily CRON job to run `detect-events`:

**In Supabase Dashboard → Database → Cron Jobs:**

```sql
-- Run daily at 9am UTC
SELECT cron.schedule(
  'detect-events-daily',
  '0 9 * * *', -- 9am UTC daily
  $$
  SELECT
    net.http_post(
      url := 'https://mvdejlkiqslwrbarwxkw.supabase.co/functions/v1/detect-events',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'practiceId', p.id
      )
    )
  FROM practices p
  $$
);
```

**OR** use the Supabase Dashboard UI:
- Go to Database → Cron Jobs
- Create new job
- Name: `detect-events-daily`
- Schedule: `0 9 * * *` (9am UTC daily)
- SQL: Call the edge function for each practice

### 4. Testing Checklist

#### Events Feature
- [ ] Add a company to watchlist (via CompanyModal or SearchResults)
- [ ] Manually trigger event detection (Events page → "Detect Events Now")
- [ ] Verify events appear in Events page
- [ ] Generate outreach draft from an event
- [ ] Verify draft is saved

#### Network Feature
- [ ] Open a client company in CompanyModal
- [ ] Click "Build Network" button
- [ ] Check Network page for opportunities
- [ ] Verify director connections are shown

#### Outreach Generation
- [ ] Go to Events page
- [ ] Click "Draft" on an event
- [ ] Select format and tone
- [ ] Generate draft
- [ ] Verify draft appears with personalization points
- [ ] Test copy, save, and regenerate

#### Auto-Fit Scoring
- [ ] Save a new prospect
- [ ] Check Prospects page - fit score should appear automatically
- [ ] Verify FitScoreBadge shows correct color

### 5. Optional: Add More Users
If you need to grant access to more users, use:

```sql
-- Replace with actual user email
INSERT INTO practice_members (practice_id, user_id, role)
SELECT 
  p.id,
  u.id,
  'member'
FROM practices p
CROSS JOIN auth.users u
WHERE u.email = 'user@example.com'
ON CONFLICT DO NOTHING;
```

## 🐛 Troubleshooting

### Events not appearing?
- Check `outreach.watchlist` table has entries
- Verify `outreach.triggered_events` table exists
- Check edge function logs in Supabase Dashboard

### Network not building?
- Verify company has active directors
- Check edge function logs
- Ensure Companies House API is responding

### Outreach generation failing?
- Verify `OPENROUTER_API_KEY` is set
- Check edge function logs
- Ensure company data is available

### Fit scores not calculating?
- Check `outreach.practice_capabilities` has entries for your practice
- Verify company has SIC codes
- Check browser console for errors

