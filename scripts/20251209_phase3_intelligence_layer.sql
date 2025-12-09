-- ============================================================================
-- PHASE 3: INTELLIGENCE LAYER - DATABASE SCHEMA
-- ============================================================================
-- Director Network Mapping + Practice-Prospect Fit Matching
-- Run after Phase 1 + Phase 2 migrations
-- ============================================================================

-- Required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- FEATURE 2: DIRECTOR NETWORK MAPPING
-- ============================================================================

-- Director/Officer profiles (enhanced from Companies House)
CREATE TABLE IF NOT EXISTS outreach.directors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id TEXT UNIQUE,  -- Companies House officer ID
    name TEXT NOT NULL,
    date_of_birth TEXT,      -- Month/Year only
    nationality TEXT,
    
    -- Calculated fields
    total_appointments INTEGER DEFAULT 0,
    active_appointments INTEGER DEFAULT 0,
    sectors TEXT[],          -- Aggregated from companies
    
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- Director-Company relationships
CREATE TABLE IF NOT EXISTS outreach.director_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    director_id UUID NOT NULL REFERENCES outreach.directors(id) ON DELETE CASCADE,
    company_number TEXT NOT NULL,
    
    role TEXT NOT NULL,
    appointed_on DATE,
    resigned_on DATE,
    is_active BOOLEAN GENERATED ALWAYS AS (resigned_on IS NULL) STORED,
    
    UNIQUE(director_id, company_number, role)
);

-- Network connections (materialized for performance)
CREATE TABLE IF NOT EXISTS outreach.director_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    
    source_company TEXT NOT NULL,      -- Your client
    target_company TEXT NOT NULL,      -- Opportunity
    
    connection_type TEXT NOT NULL,     -- 'direct', 'shared_director'
    connecting_directors UUID[],       -- Director IDs forming the connection
    connection_strength INTEGER,       -- 1 = direct, 2 = one hop, etc.
    
    -- Opportunity details (cached)
    target_company_name TEXT,
    target_turnover NUMERIC,
    target_sector TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    last_updated TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(practice_id, source_company, target_company)
);

-- Indexes for director network
CREATE INDEX IF NOT EXISTS idx_directors_officer_id ON outreach.directors(officer_id);
CREATE INDEX IF NOT EXISTS idx_directors_name ON outreach.directors(name);
CREATE INDEX IF NOT EXISTS idx_appointments_director ON outreach.director_appointments(director_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company ON outreach.director_appointments(company_number);
CREATE INDEX IF NOT EXISTS idx_appointments_active ON outreach.director_appointments(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_networks_practice ON outreach.director_networks(practice_id);
CREATE INDEX IF NOT EXISTS idx_networks_source ON outreach.director_networks(source_company);
CREATE INDEX IF NOT EXISTS idx_networks_target ON outreach.director_networks(target_company);

-- ============================================================================
-- FEATURE 4: PRACTICE-PROSPECT FIT MATCHING
-- ============================================================================

-- Practice capability profiles (synced from Torsor)
CREATE TABLE IF NOT EXISTS outreach.practice_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE UNIQUE,
    
    -- Sector experience (aggregated from clients)
    sector_experience JSONB DEFAULT '{}',  -- { "68": 45, "62": 30 } = SIC: client count
    
    -- Size profile
    typical_client_turnover_min NUMERIC,
    typical_client_turnover_max NUMERIC,
    typical_client_employees_min INTEGER,
    typical_client_employees_max INTEGER,
    
    -- Geographic reach
    primary_locations TEXT[],
    serves_nationally BOOLEAN DEFAULT false,
    
    -- Capacity
    total_capacity_hours NUMERIC,
    available_capacity_hours NUMERIC,
    
    last_synced TIMESTAMPTZ DEFAULT now()
);

-- Prospect fit scores
CREATE TABLE IF NOT EXISTS outreach.prospect_fit_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    company_number TEXT NOT NULL,
    
    -- Scores (0-100)
    overall_fit INTEGER NOT NULL,
    sector_fit INTEGER,
    size_fit INTEGER,
    service_fit INTEGER,
    location_fit INTEGER,
    capacity_fit INTEGER,
    
    -- Recommendations
    recommended_services JSONB,
    recommended_team_lead UUID,  -- References team_members if available
    skill_gaps JSONB,
    
    -- Flags
    requires_upskilling BOOLEAN DEFAULT false,
    recommend_refer BOOLEAN DEFAULT false,
    
    calculated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(practice_id, company_number)
);

-- Indexes for fit matching
CREATE INDEX IF NOT EXISTS idx_fit_scores_practice ON outreach.prospect_fit_scores(practice_id);
CREATE INDEX IF NOT EXISTS idx_fit_scores_overall ON outreach.prospect_fit_scores(practice_id, overall_fit DESC);
CREATE INDEX IF NOT EXISTS idx_fit_scores_company ON outreach.prospect_fit_scores(company_number);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE outreach.directors ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.director_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.director_networks ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.practice_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach.prospect_fit_scores ENABLE ROW LEVEL SECURITY;

-- Directors: Read-only for practice members
CREATE POLICY IF NOT EXISTS "Directors visible to practice members"
ON outreach.directors FOR SELECT
USING (true);

-- Director appointments: Read-only for practice members
CREATE POLICY IF NOT EXISTS "Appointments visible to practice members"
ON outreach.director_appointments FOR SELECT
USING (true);

-- Director networks: Full access for practice members
CREATE POLICY IF NOT EXISTS "Networks visible to practice members"
ON outreach.director_networks FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Practice capabilities: Full access for practice members
CREATE POLICY IF NOT EXISTS "Capabilities visible to practice members"
ON outreach.practice_capabilities FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- Fit scores: Full access for practice members
CREATE POLICY IF NOT EXISTS "Fit scores visible to practice members"
ON outreach.prospect_fit_scores FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT ALL ON outreach.directors TO authenticated;
GRANT ALL ON outreach.director_appointments TO authenticated;
GRANT ALL ON outreach.director_networks TO authenticated;
GRANT ALL ON outreach.practice_capabilities TO authenticated;
GRANT ALL ON outreach.prospect_fit_scores TO authenticated;

GRANT ALL ON outreach.directors TO service_role;
GRANT ALL ON outreach.director_appointments TO service_role;
GRANT ALL ON outreach.director_networks TO service_role;
GRANT ALL ON outreach.practice_capabilities TO service_role;
GRANT ALL ON outreach.prospect_fit_scores TO service_role;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update director appointment counts
CREATE OR REPLACE FUNCTION outreach.update_director_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE outreach.directors
    SET 
        total_appointments = (
            SELECT COUNT(*) FROM outreach.director_appointments
            WHERE director_id = COALESCE(NEW.director_id, OLD.director_id)
        ),
        active_appointments = (
            SELECT COUNT(*) FROM outreach.director_appointments
            WHERE director_id = COALESCE(NEW.director_id, OLD.director_id)
            AND is_active = true
        ),
        last_updated = now()
    WHERE id = COALESCE(NEW.director_id, OLD.director_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update counts
DROP TRIGGER IF EXISTS trigger_update_director_counts ON outreach.director_appointments;
CREATE TRIGGER trigger_update_director_counts
    AFTER INSERT OR UPDATE OR DELETE ON outreach.director_appointments
    FOR EACH ROW
    EXECUTE FUNCTION outreach.update_director_counts();

