-- Add Apollo.io enrichment fields to enrichment_records table
-- Run after 20251209_add_enrichment_schema.sql

ALTER TABLE outreach.enrichment_records 
  ADD COLUMN IF NOT EXISTS enrichment_source TEXT DEFAULT 'apollo',
  ADD COLUMN IF NOT EXISTS apollo_org_id TEXT,
  ADD COLUMN IF NOT EXISTS company_website TEXT,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS company_industry TEXT,
  ADD COLUMN IF NOT EXISTS company_employee_count INTEGER;

-- Create contacts table for Apollo-discovered contacts
CREATE TABLE IF NOT EXISTS outreach.prospect_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prospect_id UUID NOT NULL REFERENCES outreach.prospects(id) ON DELETE CASCADE,
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    title TEXT,
    email TEXT,
    email_verified BOOLEAN DEFAULT false,
    phone TEXT,
    linkedin_url TEXT,
    
    source TEXT DEFAULT 'apollo',
    is_primary BOOLEAN DEFAULT false,
    is_decision_maker BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_contacts_prospect ON outreach.prospect_contacts(prospect_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_practice ON outreach.prospect_contacts(practice_id);
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_email ON outreach.prospect_contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_contacts_primary ON outreach.prospect_contacts(prospect_id, is_primary) WHERE is_primary = true;

ALTER TABLE outreach.prospect_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prospect contacts visible to practice members" ON outreach.prospect_contacts;
CREATE POLICY "Prospect contacts visible to practice members"
ON outreach.prospect_contacts FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

GRANT ALL ON outreach.prospect_contacts TO authenticated;
GRANT ALL ON outreach.prospect_contacts TO service_role;

-- Update directors table to use apollo_confirmed instead of ai_confirmed
UPDATE outreach.directors
SET address_source = 'csv_import_apollo_confirmed'
WHERE address_source = 'csv_import_ai_confirmed';

