# Edge Functions Reference

This document lists all Supabase Edge Functions required for the Torsor Outreach Tool, organized by phase.

---

## Phase 1-2: Foundation (✅ Already Deployed)

### 1. `companies-house`
**Purpose:** Proxy for Companies House API with rate limiting  
**Status:** ✅ Deployed  
**Endpoint:** `POST /functions/v1/companies-house`  
**Actions:**
- `getCompany` - Get company profile
- `searchCompanies` - Search companies
- `getCompanyOfficers` - Get company officers
- `getCompanyFilings` - Get company filings
- `getOfficerAppointments` - Get officer's other appointments

**Environment Variables:**
- `COMPANIES_HOUSE_API_KEY` - Your Companies House API key

---

### 2. `address-discovery`
**Purpose:** Discover companies at an address, filter accounting firms, score prospects  
**Status:** ✅ Deployed  
**Endpoint:** `POST /functions/v1/address-discovery`  
**Request:**
```json
{
  "address": "123 High Street, London, SW1A 1AA",
  "practiceId": "uuid",
  "excludeFirmNumber": "optional-accounting-firm-number"
}
```

**Environment Variables:**
- None (uses Companies House API via `companies-house` function)

---

### 3. `address-enrichment`
**Purpose:** Find or confirm business addresses using AI  
**Status:** ✅ Deployed  
**Endpoint:** `POST /functions/v1/address-enrichment`  
**Request:**
```json
{
  "operation": "find" | "confirm",
  "companyName": "Company Name Ltd",
  "companyNumber": "12345678",
  "registeredAddress": "optional address string",
  "addressToConfirm": {
    "line1": "...",
    "town": "...",
    "postcode": "..."
  }
}
```

**Environment Variables:**
- `OPENROUTER_API_KEY` - Your OpenRouter API key

---

## Phase 3: Intelligence Layer (🔨 To Be Implemented)

### 4. `build-director-network`
**Purpose:** Build director network connections for a client company  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/build-director-network`  
**Request:**
```json
{
  "practiceId": "uuid",
  "companyNumber": "12345678"
}
```

**Response:**
```json
{
  "networks": [
    {
      "directorId": "uuid",
      "directorName": "John Smith",
      "opportunities": [
        {
          "companyNumber": "87654321",
          "companyName": "Other Company Ltd",
          "connectionStrength": "direct"
        }
      ]
    }
  ]
}
```

**Implementation Notes:**
- Calls `companies-house` function to get officers
- For each director, calls `getOfficerAppointments`
- Stores network connections in database
- Returns network opportunities

**Environment Variables:**
- None (uses existing `companies-house` function)

---

## Phase 4: Engagement Engine (📋 Planned)

### 5. `detect-events`
**Purpose:** Detect trigger events for watched companies  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/detect-events`  
**Request:**
```json
{
  "practiceId": "uuid"
}
```

**Response:**
```json
{
  "checked": 50,
  "eventsDetected": 5,
  "events": [
    {
      "companyNumber": "12345678",
      "eventType": "accounts_overdue",
      "eventData": { ... }
    }
  ]
}
```

**Environment Variables:**
- None (uses existing `companies-house` function)

**Scheduling:** Should run daily via Supabase CRON

---

### 6. `generate-outreach`
**Purpose:** Generate AI-powered personalized outreach messages  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/generate-outreach`  
**Request:**
```json
{
  "practiceId": "uuid",
  "companyNumber": "12345678",
  "format": "email_intro" | "formal_letter" | "linkedin_connect" | "warm_intro",
  "tone": "formal" | "professional" | "friendly",
  "triggerEvent": { ... },
  "networkConnection": { ... }
}
```

**Response:**
```json
{
  "format": "email_intro",
  "subject": "Subject line",
  "body": "Message body...",
  "personalizationPoints": ["company name", "recent event", ...],
  "suggestedSendDate": "2025-12-15"
}
```

**Environment Variables:**
- `OPENROUTER_API_KEY` - For AI generation (Claude/Perplexity)

---

## Phase 5: Predictive Analytics (📋 Planned)

### 7. `detect-switch-signals`
**Purpose:** Detect "ready to switch" signals for companies  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/detect-switch-signals`  
**Request:**
```json
{
  "companyNumber": "12345678",
  "practiceId": "uuid"
}
```

**Response:**
```json
{
  "companyNumber": "12345678",
  "totalScore": 65,
  "signals": [
    {
      "signal": "ACCOUNTS_OVERDUE",
      "detected": true,
      "weight": 25,
      "evidence": { "daysOverdue": 45 }
    }
  ],
  "confidence": "high"
}
```

**Environment Variables:**
- None (uses existing `companies-house` function)

---

## Phase 6: Strategic Tools (📋 Planned)

### 8. `check-competitor-movements`
**Purpose:** Detect companies joining/leaving competitor addresses  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/check-competitor-movements`  
**Request:**
```json
{
  "practiceId": "uuid"
}
```

**Response:**
```json
{
  "competitorsChecked": 5,
  "movementsDetected": 3,
  "movements": [
    {
      "competitorId": "uuid",
      "companyNumber": "12345678",
      "movementType": "left",
      "movementDate": "2025-12-01"
    }
  ]
}
```

**Environment Variables:**
- None (uses existing `address-discovery` function)

**Scheduling:** Should run daily via Supabase CRON

---

### 9. `process-nurture`
**Purpose:** Process due nurture sequence actions  
**Status:** ⏳ **NOT YET CREATED**  
**Endpoint:** `POST /functions/v1/process-nurture`  
**Request:**
```json
{
  "practiceId": "uuid"
}
```

**Response:**
```json
{
  "processed": 10,
  "emailsSent": 5,
  "tasksCreated": 3
}
```

**Environment Variables:**
- `OPENROUTER_API_KEY` - For AI personalization (optional)

**Scheduling:** Should run every 4 hours via Supabase CRON

---

## Deployment Checklist

When creating a new edge function:

1. ✅ Create function in `supabase/functions/[function-name]/index.ts`
2. ✅ Add CORS headers
3. ✅ Add error handling
4. ✅ Set environment variables in Supabase dashboard
5. ✅ Deploy: `supabase functions deploy [function-name]`
6. ✅ Test endpoint
7. ✅ Update this document with status

---

## Current Status Summary

| Function | Status | Phase | Priority |
|----------|--------|-------|----------|
| `companies-house` | ✅ Deployed | 1-2 | Critical |
| `address-discovery` | ✅ Deployed | 1-2 | Critical |
| `address-enrichment` | ✅ Deployed | 2 | High |
| `build-director-network` | ⏳ Not Created | 3 | Medium |
| `detect-events` | ⏳ Not Created | 4 | High |
| `generate-outreach` | ⏳ Not Created | 4 | High |
| `detect-switch-signals` | ⏳ Not Created | 5 | Medium |
| `check-competitor-movements` | ⏳ Not Created | 6 | Low |
| `process-nurture` | ⏳ Not Created | 6 | Low |

---

## Notes

- All functions should use the shared CORS helper from `_shared/cors.ts`
- Functions that call Companies House should use the `companies-house` function (don't call API directly)
- Functions requiring AI should use OpenRouter with appropriate model
- Scheduled functions should be set up via Supabase CRON jobs

