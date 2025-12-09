-- Add outreach_drafts table for Phase 4
-- Run after Phase 3 migration

CREATE TABLE IF NOT EXISTS outreach.outreach_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID NOT NULL REFERENCES practices(id) ON DELETE CASCADE,
    prospect_id UUID REFERENCES outreach.prospects(id) ON DELETE SET NULL,
    company_number TEXT NOT NULL,
    
    format TEXT NOT NULL CHECK (format IN ('email_intro', 'formal_letter', 'linkedin_connect', 'linkedin_message', 'warm_intro')),
    tone TEXT CHECK (tone IN ('formal', 'professional', 'friendly')),
    
    subject TEXT,
    body TEXT NOT NULL,
    
    personalization_points TEXT[],
    ai_model TEXT,
    
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'discarded')),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outreach_drafts_practice ON outreach.outreach_drafts(practice_id);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_company ON outreach.outreach_drafts(company_number);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON outreach.outreach_drafts(status);

ALTER TABLE outreach.outreach_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Outreach drafts visible to practice members" ON outreach.outreach_drafts;
CREATE POLICY "Outreach drafts visible to practice members"
ON outreach.outreach_drafts FOR ALL
USING (practice_id IN (
    SELECT practice_id FROM practice_members WHERE user_id = auth.uid()
));

GRANT ALL ON outreach.outreach_drafts TO authenticated;
GRANT ALL ON outreach.outreach_drafts TO service_role;

