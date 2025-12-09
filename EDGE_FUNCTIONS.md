# Edge Functions - Quick Reference

## ✅ Already Deployed

1. **`companies-house`**
   - Code: [`supabase/functions/companies-house/index.ts`](supabase/functions/companies-house/index.ts)
   - Env: `COMPANIES_HOUSE_API_KEY`

2. **`address-discovery`**
   - Code: [`supabase/functions/address-discovery/index.ts`](supabase/functions/address-discovery/index.ts)

3. **`address-enrichment`**
   - Code: [`supabase/functions/address-enrichment/index.ts`](supabase/functions/address-enrichment/index.ts)
   - Env: `OPENROUTER_API_KEY`

---

## ⏳ To Be Created

### Phase 3
4. **`build-director-network`**
   - Code: Create `supabase/functions/build-director-network/index.ts`
   - See: Phase 3 implementation plan

### Phase 4
5. **`detect-events`**
   - Code: Create `supabase/functions/detect-events/index.ts`
   - See: Phase 4 implementation plan

6. **`generate-outreach`**
   - Code: Create `supabase/functions/generate-outreach/index.ts`
   - Env: `OPENROUTER_API_KEY`
   - See: Phase 4 implementation plan

### Phase 5
7. **`detect-switch-signals`**
   - Code: Create `supabase/functions/detect-switch-signals/index.ts`
   - See: Phase 5 implementation plan

### Phase 6
8. **`check-competitor-movements`**
   - Code: Create `supabase/functions/check-competitor-movements/index.ts`
   - See: Phase 6 implementation plan

9. **`process-nurture`**
   - Code: Create `supabase/functions/process-nurture/index.ts`
   - Env: `OPENROUTER_API_KEY` (optional)
   - See: Phase 6 implementation plan

---

## Deployment

```bash
supabase functions deploy [function-name]
```

Set environment variables in Supabase dashboard: Project Settings → Edge Functions → Secrets
