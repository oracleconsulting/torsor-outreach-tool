// Company from Companies House API
export interface Company {
  company_number: string
  company_name: string
  company_status: string
  company_type?: string
  incorporation_date?: string
  dissolution_date?: string
  sic_codes: string[]
  registered_office_address: Address
  accounts?: {
    last_accounts?: { made_up_to: string }
    next_due?: string
  }
  has_charges?: boolean
  has_insolvency_history?: boolean
}

export interface Address {
  premises?: string
  address_line_1: string
  address_line_2?: string
  locality?: string
  region?: string
  postal_code: string
  country?: string
}

export interface Officer {
  name: string
  officer_role: string
  appointed_on?: string
  resigned_on?: string
  occupation?: string
  nationality?: string
}

export interface Filing {
  transaction_id: string
  filing_date: string
  description: string
  category: string
  subcategory?: string
}

export interface SearchResult extends Company {
  prospect_score: number
  score_factors: Record<string, number>
  is_covenant_safe: boolean
  covenant_firm_name?: string
}

export type ProspectStatus = 'new' | 'researched' | 'contacted' | 'responded' | 'converted' | 'rejected'

export interface Prospect {
  id: string
  practice_id: string
  company_number: string
  prospect_score: number
  score_factors: Record<string, number>
  status: ProspectStatus
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
  discovery_source: string
  discovery_address?: string
  discovered_via_firm?: string
  notes?: string
  created_at: string
  contacted_at?: string
  converted_at?: string
}

export interface Covenant {
  id: string
  practice_id: string
  accounting_firm_number: string
  accounting_firm_name: string
  address_hash?: string
  restriction_start_date: string
  restriction_end_date: string
  is_active: boolean
  notes?: string
  created_by: string
  created_at: string
}

export interface FirmDiscoveryResult {
  firm: {
    company_number: string
    company_name: string
    registered_address: string
  }
  companies: SearchResult[]
  total_found: number
  address_hash: string
}

export interface SearchHistory {
  id: string
  search_type: 'address' | 'firm' | 'postcode' | 'company'
  search_params: Record<string, any>
  results_count: number
  created_at: string
}

export interface ApiError {
  error_code: string
  message: string
  details?: Record<string, any>
}

export interface SearchOptions {
  limit?: number
  start_index?: number
}

export interface FirmDiscoveryParams {
  firmNumber: string
  practiceId?: string
  targetSicCodes?: string[]
  covenantStartDate?: string
  covenantEndDate?: string
}

export interface ProspectFilters {
  status?: ProspectStatus[]
  minScore?: number
  maxScore?: number
  dateFrom?: string
  dateTo?: string
}

export interface NewProspect extends Omit<Prospect, 'id' | 'created_at' | 'practice_id'> {
  practice_id: string
}

export interface ProspectUpdate {
  status?: ProspectStatus
  notes?: string
  primary_contact_name?: string
  primary_contact_email?: string
  primary_contact_phone?: string
}

export interface BulkResult {
  saved: number
  skipped: number
  errors: string[]
}

export interface NewCovenant extends Omit<Covenant, 'id' | 'created_at' | 'created_by' | 'practice_id'> {
  practice_id: string
}

export interface CovenantUpdate {
  restriction_end_date?: string
  notes?: string
  is_active?: boolean
}

export interface CovenantCheck {
  isSafe: boolean
  restrictingFirm?: string
  restrictionEnd?: string
}

