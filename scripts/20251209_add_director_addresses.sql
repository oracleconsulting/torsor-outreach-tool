-- Add director address fields to support CSV import of trading/contact addresses
-- Run after Phase 3 migration

-- Add address columns to directors table
ALTER TABLE outreach.directors
ADD COLUMN IF NOT EXISTS trading_address JSONB,
ADD COLUMN IF NOT EXISTS contact_address JSONB,
ADD COLUMN IF NOT EXISTS preferred_contact_method TEXT CHECK (preferred_contact_method IN ('email', 'phone', 'address', 'linkedin')),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
ADD COLUMN IF NOT EXISTS address_source TEXT, -- 'csv_import', 'manual', 'companies_house', etc.
ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS address_verified_by UUID;

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS idx_directors_email ON outreach.directors(email) WHERE email IS NOT NULL;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_directors_phone ON outreach.directors(phone) WHERE phone IS NOT NULL;

-- Add comment explaining the address fields
COMMENT ON COLUMN outreach.directors.trading_address IS 'Trading/business address (JSONB with address_line_1, address_line_2, locality, region, postal_code, country)';
COMMENT ON COLUMN outreach.directors.contact_address IS 'Preferred contact address (JSONB with same structure as trading_address)';
COMMENT ON COLUMN outreach.directors.address_source IS 'Source of address data: csv_import, manual, companies_house, etc.';

