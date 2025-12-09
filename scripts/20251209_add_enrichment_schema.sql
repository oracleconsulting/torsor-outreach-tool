-- =============================================================================
-- ENRICHMENT SCHEMA ADDITIONS
-- =============================================================================
-- Run this after the main schema migration
-- Adds enrichment tracking and confirmation support
-- =============================================================================

-- Enrichment records table (if not exists from Phase 2)
CREATE TABLE IF NOT EXISTS outreach.enrichment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    company_number TEXT NOT NULL,
    
    -- Operation type
    operation TEXT DEFAULT 'find' CHECK (operation IN ('find', 'confirm')),
    
    -- For FIND operation
    found_addresses JSONB DEFAULT '[]',
    best_address JSONB,
    confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
    
    -- For CONFIRM operation
    address_to_confirm JSONB,
    confirmation_result TEXT CHECK (confirmation_result IN (
        'confirmed', 'likely_valid', 'suspicious', 'invalid', 'unknown'
    )),
    confirmation_details JSONB,
    
    -- Metadata
    source TEXT,
    sources JSONB DEFAULT '[]',
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT fk_enrichment_practice 
        FOREIGN KEY (practice_id) 
        REFERENCES practices(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_enrichment_company 
        FOREIGN KEY (company_number) 
        REFERENCES outreach.companies(company_number) 
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_enrichment_practice 
    ON outreach.enrichment_records(practice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enrichment_company 
    ON outreach.enrichment_records(company_number);
CREATE INDEX IF NOT EXISTS idx_enrichment_operation 
    ON outreach.enrichment_records(operation);

-- Add enrichment tracking to prospects table
ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'not_attempted' 
    CHECK (enrichment_status IN (
        'not_attempted', 'pending', 'found', 'not_found', 'confirmed', 'invalid'
    ));

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS enriched_address JSONB;

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS enrichment_confidence INTEGER 
    CHECK (enrichment_confidence BETWEEN 0 AND 100);

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS enrichment_source TEXT;

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS enrichment_date TIMESTAMPTZ;

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS address_confirmed BOOLEAN DEFAULT false;

ALTER TABLE outreach.prospects 
    ADD COLUMN IF NOT EXISTS confirmation_date TIMESTAMPTZ;

-- Index for filtering by enrichment status
CREATE INDEX IF NOT EXISTS idx_prospects_enrichment_status 
    ON outreach.prospects(practice_id, enrichment_status);

-- View for prospects needing attention
CREATE OR REPLACE VIEW outreach.v_prospects_needing_enrichment AS
SELECT 
    p.*,
    c.company_name,
    c.registered_office_address,
    c.company_status
FROM outreach.prospects p
JOIN outreach.companies c ON c.company_number = p.company_number
WHERE p.enrichment_status IN ('not_attempted', 'not_found')
   OR (p.enrichment_status = 'found' AND p.address_confirmed = false)
ORDER BY p.prospect_score DESC, p.created_at DESC;

-- RLS for enrichment_records
ALTER TABLE outreach.enrichment_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enrichment records visible to practice members" ON outreach.enrichment_records;

CREATE POLICY "Enrichment records visible to practice members"
ON outreach.enrichment_records FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Grants
GRANT ALL ON outreach.enrichment_records TO authenticated;
GRANT ALL ON outreach.enrichment_records TO service_role;

