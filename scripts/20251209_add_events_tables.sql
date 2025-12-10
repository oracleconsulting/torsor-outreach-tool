-- Add watchlist and triggered_events tables for Phase 4
-- Run after Phase 3 migration

-- Watchlist table for tracking companies to monitor
CREATE TABLE IF NOT EXISTS outreach.watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    company_number TEXT NOT NULL,
    
    events_to_watch TEXT[] DEFAULT ARRAY['accounts_overdue', 'director_change', 'address_change', 'anniversary'],
    
    is_active BOOLEAN DEFAULT true,
    added_at TIMESTAMPTZ DEFAULT now(),
    last_checked_at TIMESTAMPTZ,
    
    UNIQUE(practice_id, company_number)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_practice ON outreach.watchlist(practice_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_company ON outreach.watchlist(company_number);
CREATE INDEX IF NOT EXISTS idx_watchlist_active ON outreach.watchlist(is_active) WHERE is_active = true;

ALTER TABLE outreach.watchlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Watchlist visible to practice members" ON outreach.watchlist;
CREATE POLICY "Watchlist visible to practice members"
ON outreach.watchlist FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

GRANT ALL ON outreach.watchlist TO authenticated;
GRANT ALL ON outreach.watchlist TO service_role;

-- Triggered events table for storing detected events
CREATE TABLE IF NOT EXISTS outreach.triggered_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    company_number TEXT NOT NULL,
    
    event_type TEXT NOT NULL CHECK (event_type IN ('accounts_overdue', 'director_change', 'address_change', 'anniversary', 'filing_change')),
    event_data JSONB,
    
    triggered_at TIMESTAMPTZ DEFAULT now(),
    outreach_status TEXT DEFAULT 'pending' CHECK (outreach_status IN ('pending', 'draft_generated', 'sent', 'skipped')),
    outreach_sent_at TIMESTAMPTZ,
    
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_triggered_events_practice ON outreach.triggered_events(practice_id);
CREATE INDEX IF NOT EXISTS idx_triggered_events_company ON outreach.triggered_events(company_number);
CREATE INDEX IF NOT EXISTS idx_triggered_events_status ON outreach.triggered_events(outreach_status);
CREATE INDEX IF NOT EXISTS idx_triggered_events_type ON outreach.triggered_events(event_type);
CREATE INDEX IF NOT EXISTS idx_triggered_events_triggered ON outreach.triggered_events(triggered_at DESC);

ALTER TABLE outreach.triggered_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Triggered events visible to practice members" ON outreach.triggered_events;
CREATE POLICY "Triggered events visible to practice members"
ON outreach.triggered_events FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

GRANT ALL ON outreach.triggered_events TO authenticated;
GRANT ALL ON outreach.triggered_events TO service_role;

