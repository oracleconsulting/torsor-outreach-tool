-- =============================================================================
-- COMPANIES HOUSE OUTREACH TOOL - DATABASE MIGRATION
-- =============================================================================
-- Run this in Supabase SQL Editor
-- Migration: 20251209_create_outreach_schema.sql
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- For fuzzy text matching

-- Create schema
CREATE SCHEMA IF NOT EXISTS outreach;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Cached company data from Companies House
CREATE TABLE IF NOT EXISTS outreach.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_number TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    company_status TEXT,
    company_type TEXT,
    incorporation_date DATE,
    dissolution_date DATE,
    sic_codes TEXT[] DEFAULT '{}',
    nature_of_business TEXT,
    
    -- Registered office
    registered_office_address JSONB,
    address_line_1 TEXT,
    postal_code TEXT,
    
    -- Accounts info
    last_accounts_date DATE,
    next_accounts_due DATE,
    accounts_type TEXT,
    
    -- Flags
    has_charges BOOLEAN DEFAULT false,
    has_insolvency_history BOOLEAN DEFAULT false,
    has_been_liquidated BOOLEAN DEFAULT false,
    
    -- Cache management
    etag TEXT,
    last_fetched_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for companies table
CREATE INDEX IF NOT EXISTS idx_outreach_companies_number 
    ON outreach.companies(company_number);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_name 
    ON outreach.companies USING gin(company_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_postal_code 
    ON outreach.companies(postal_code);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_sic_codes 
    ON outreach.companies USING gin(sic_codes);
CREATE INDEX IF NOT EXISTS idx_outreach_companies_status 
    ON outreach.companies(company_status);

-- Historical address tracking
CREATE TABLE IF NOT EXISTS outreach.company_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_number TEXT NOT NULL,
    
    -- Address components
    premises TEXT,
    address_line_1 TEXT,
    address_line_2 TEXT,
    locality TEXT,
    region TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'United Kingdom',
    
    -- Generated hash for matching (computed column)
    address_hash TEXT,
    
    -- Timeline
    effective_from DATE,
    effective_to DATE,
    is_current BOOLEAN DEFAULT true,
    
    -- Source
    source_filing TEXT,
    filing_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT fk_company_addresses_company 
        FOREIGN KEY (company_number) 
        REFERENCES outreach.companies(company_number) 
        ON DELETE CASCADE
);

-- Trigger to auto-generate address_hash
CREATE OR REPLACE FUNCTION outreach.generate_address_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.address_hash := md5(
        lower(trim(coalesce(NEW.address_line_1, ''))) || 
        lower(trim(coalesce(NEW.postal_code, '')))
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_address_hash ON outreach.company_addresses;
CREATE TRIGGER trg_generate_address_hash
    BEFORE INSERT OR UPDATE ON outreach.company_addresses
    FOR EACH ROW EXECUTE FUNCTION outreach.generate_address_hash();

-- Indexes for company_addresses
CREATE INDEX IF NOT EXISTS idx_outreach_addresses_company 
    ON outreach.company_addresses(company_number);
CREATE INDEX IF NOT EXISTS idx_outreach_addresses_hash 
    ON outreach.company_addresses(address_hash);
CREATE INDEX IF NOT EXISTS idx_outreach_addresses_postal 
    ON outreach.company_addresses(postal_code);
CREATE INDEX IF NOT EXISTS idx_outreach_addresses_current 
    ON outreach.company_addresses(is_current) WHERE is_current = true;

-- Covenant/non-compete restrictions
CREATE TABLE IF NOT EXISTS outreach.covenant_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    
    -- Firm details
    accounting_firm_number TEXT NOT NULL,
    accounting_firm_name TEXT NOT NULL,
    
    -- Restriction scope
    address_hash TEXT,
    restriction_start_date DATE NOT NULL,
    restriction_end_date DATE NOT NULL,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    -- Audit
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT fk_covenant_practice 
        FOREIGN KEY (practice_id) 
        REFERENCES practices(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_covenant_dates 
        CHECK (restriction_end_date > restriction_start_date)
);

-- Indexes for covenant_restrictions
CREATE INDEX IF NOT EXISTS idx_outreach_covenants_practice 
    ON outreach.covenant_restrictions(practice_id);
CREATE INDEX IF NOT EXISTS idx_outreach_covenants_firm 
    ON outreach.covenant_restrictions(accounting_firm_number);
CREATE INDEX IF NOT EXISTS idx_outreach_covenants_active 
    ON outreach.covenant_restrictions(is_active, restriction_end_date);
CREATE INDEX IF NOT EXISTS idx_outreach_covenants_hash 
    ON outreach.covenant_restrictions(address_hash);

-- Saved prospects
CREATE TABLE IF NOT EXISTS outreach.prospects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    company_number TEXT NOT NULL,
    
    -- Scoring
    prospect_score INTEGER DEFAULT 5,
    score_factors JSONB DEFAULT '{}',
    
    -- Status pipeline
    status TEXT DEFAULT 'new',
    
    -- Contact info
    primary_contact_name TEXT,
    primary_contact_email TEXT,
    primary_contact_phone TEXT,
    
    -- Source tracking
    discovery_source TEXT,
    discovery_address TEXT,
    discovered_via_firm TEXT,
    
    -- Notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    contacted_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT fk_prospect_practice 
        FOREIGN KEY (practice_id) 
        REFERENCES practices(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_prospect_company 
        FOREIGN KEY (company_number) 
        REFERENCES outreach.companies(company_number) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_prospect_score 
        CHECK (prospect_score BETWEEN 0 AND 10),
    
    CONSTRAINT chk_prospect_status 
        CHECK (status IN ('new', 'researched', 'contacted', 'responded', 'converted', 'rejected')),
    
    CONSTRAINT uq_prospect_practice_company 
        UNIQUE(practice_id, company_number)
);

-- Indexes for prospects
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_practice 
    ON outreach.prospects(practice_id);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_status 
    ON outreach.prospects(practice_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_score 
    ON outreach.prospects(practice_id, prospect_score DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_prospects_company 
    ON outreach.prospects(company_number);

-- Search history
CREATE TABLE IF NOT EXISTS outreach.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    search_type TEXT NOT NULL,
    search_params JSONB NOT NULL,
    results_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT fk_search_history_practice 
        FOREIGN KEY (practice_id) 
        REFERENCES practices(id) 
        ON DELETE CASCADE,
    
    CONSTRAINT chk_search_type 
        CHECK (search_type IN ('address', 'firm', 'postcode', 'company'))
);

-- Index for search_history
CREATE INDEX IF NOT EXISTS idx_outreach_search_history_practice 
    ON outreach.search_history(practice_id, created_at DESC);

-- Saved searches
CREATE TABLE IF NOT EXISTS outreach.saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL,
    user_id UUID NOT NULL,
    
    name TEXT NOT NULL,
    search_type TEXT NOT NULL,
    search_params JSONB NOT NULL,
    is_favorite BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ,
    
    CONSTRAINT fk_saved_searches_practice 
        FOREIGN KEY (practice_id) 
        REFERENCES practices(id) 
        ON DELETE CASCADE
);

-- Index for saved_searches
CREATE INDEX IF NOT EXISTS idx_outreach_saved_searches_practice 
    ON outreach.saved_searches(practice_id);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Get companies at an address on a specific date
CREATE OR REPLACE FUNCTION outreach.get_companies_at_address(
    p_address_hash TEXT,
    p_target_date DATE DEFAULT CURRENT_DATE,
    p_practice_id UUID DEFAULT NULL
)
RETURNS TABLE (
    company_number TEXT,
    company_name TEXT,
    company_status TEXT,
    sic_codes TEXT[],
    address_from DATE,
    address_to DATE,
    is_covenant_safe BOOLEAN,
    covenant_firm_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.company_number,
        c.company_name,
        c.company_status,
        c.sic_codes,
        ca.effective_from,
        ca.effective_to,
        -- Covenant check
        NOT EXISTS (
            SELECT 1 FROM outreach.covenant_restrictions cr
            WHERE cr.address_hash = ca.address_hash
              AND cr.is_active = true
              AND cr.practice_id = p_practice_id
              AND p_target_date BETWEEN cr.restriction_start_date AND cr.restriction_end_date
        ) AS is_covenant_safe,
        -- Get restricting firm name if applicable
        (
            SELECT cr.accounting_firm_name
            FROM outreach.covenant_restrictions cr
            WHERE cr.address_hash = ca.address_hash
              AND cr.is_active = true
              AND cr.practice_id = p_practice_id
              AND p_target_date BETWEEN cr.restriction_start_date AND cr.restriction_end_date
            LIMIT 1
        ) AS covenant_firm_name
    FROM outreach.company_addresses ca
    JOIN outreach.companies c ON c.company_number = ca.company_number
    WHERE ca.address_hash = p_address_hash
      AND (ca.effective_from IS NULL OR ca.effective_from <= p_target_date)
      AND (ca.effective_to IS NULL OR ca.effective_to >= p_target_date)
    ORDER BY c.company_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Calculate prospect score
CREATE OR REPLACE FUNCTION outreach.calculate_prospect_score(
    p_company_number TEXT,
    p_target_sic_codes TEXT[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_company RECORD;
    v_score INTEGER := 5;
    v_factors JSONB := '{}';
BEGIN
    SELECT * INTO v_company FROM outreach.companies WHERE company_number = p_company_number;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('score', 0, 'factors', '{"error": "Company not found"}'::jsonb);
    END IF;
    
    -- Active status (+1)
    IF v_company.company_status = 'active' THEN
        v_score := v_score + 1;
        v_factors := v_factors || '{"active_status": 1}'::jsonb;
    END IF;
    
    -- Company age (+1 for 2+ years, +2 for 5+ years)
    IF v_company.incorporation_date IS NOT NULL THEN
        IF v_company.incorporation_date < CURRENT_DATE - INTERVAL '5 years' THEN
            v_score := v_score + 2;
            v_factors := v_factors || '{"company_age": 2}'::jsonb;
        ELSIF v_company.incorporation_date < CURRENT_DATE - INTERVAL '2 years' THEN
            v_score := v_score + 1;
            v_factors := v_factors || '{"company_age": 1}'::jsonb;
        END IF;
    END IF;
    
    -- Has filed accounts (+1)
    IF v_company.last_accounts_date IS NOT NULL THEN
        v_score := v_score + 1;
        v_factors := v_factors || '{"has_accounts": 1}'::jsonb;
    END IF;
    
    -- Industry match (+2)
    IF p_target_sic_codes IS NOT NULL AND v_company.sic_codes && p_target_sic_codes THEN
        v_score := v_score + 2;
        v_factors := v_factors || '{"industry_match": 2}'::jsonb;
    END IF;
    
    -- Cap at 10
    v_score := LEAST(v_score, 10);
    
    RETURN jsonb_build_object('score', v_score, 'factors', v_factors);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION outreach.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prospects_updated_at ON outreach.prospects;
CREATE TRIGGER trg_prospects_updated_at
    BEFORE UPDATE ON outreach.prospects
    FOR EACH ROW EXECUTE FUNCTION outreach.update_updated_at();

DROP TRIGGER IF EXISTS trg_covenants_updated_at ON outreach.covenant_restrictions;
CREATE TRIGGER trg_covenants_updated_at
    BEFORE UPDATE ON outreach.covenant_restrictions
    FOR EACH ROW EXECUTE FUNCTION outreach.update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all practice-scoped tables
ALTER TABLE outreach.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.covenant_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.saved_searches ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Prospects visible to practice members" ON outreach.prospects;
DROP POLICY IF EXISTS "Covenants visible to practice members" ON outreach.covenant_restrictions;
DROP POLICY IF EXISTS "Search history visible to practice members" ON outreach.search_history;
DROP POLICY IF EXISTS "Saved searches visible to practice members" ON outreach.saved_searches;

-- Prospects: practice members only
CREATE POLICY "Prospects visible to practice members"
ON outreach.prospects FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Covenants: practice members only
CREATE POLICY "Covenants visible to practice members"
ON outreach.covenant_restrictions FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Search history: own practice
CREATE POLICY "Search history visible to practice members"
ON outreach.search_history FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Saved searches: own practice
CREATE POLICY "Saved searches visible to practice members"
ON outreach.saved_searches FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Prospects with company details
CREATE OR REPLACE VIEW outreach.v_prospects_with_company AS
SELECT 
    p.*,
    c.company_name,
    c.company_status,
    c.company_type,
    c.sic_codes,
    c.incorporation_date,
    c.registered_office_address,
    c.last_accounts_date,
    c.next_accounts_due
FROM outreach.prospects p
JOIN outreach.companies c ON c.company_number = p.company_number;

-- Active covenants with days remaining
CREATE OR REPLACE VIEW outreach.v_active_covenants AS
SELECT 
    *,
    restriction_end_date - CURRENT_DATE AS days_remaining,
    CASE 
        WHEN restriction_end_date - CURRENT_DATE <= 30 THEN 'expiring_soon'
        WHEN restriction_end_date < CURRENT_DATE THEN 'expired'
        ELSE 'active'
    END AS covenant_status
FROM outreach.covenant_restrictions
WHERE is_active = true
ORDER BY restriction_end_date;

-- =============================================================================
-- GRANTS (for service role access)
-- =============================================================================

GRANT USAGE ON SCHEMA outreach TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA outreach TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA outreach TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA outreach TO service_role;

GRANT USAGE ON SCHEMA outreach TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA outreach TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA outreach TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA outreach TO authenticated;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

-- Run this to verify installation
DO $$
BEGIN
    RAISE NOTICE 'Outreach schema created successfully!';
    RAISE NOTICE 'Tables: companies, company_addresses, covenant_restrictions, prospects, search_history, saved_searches';
    RAISE NOTICE 'Functions: get_companies_at_address, calculate_prospect_score';
    RAISE NOTICE 'Views: v_prospects_with_company, v_active_covenants';
END $$;

