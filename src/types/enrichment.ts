// Enrichment-specific types

export type EnrichmentOperation = 'find' | 'confirm'

export type EnrichmentStatus = 
  | 'not_attempted' 
  | 'pending' 
  | 'found' 
  | 'not_found' 
  | 'confirmed' 
  | 'invalid'

export type ConfirmationResult = 
  | 'confirmed'      // Address verified as real and current
  | 'likely_valid'   // Some evidence but not conclusive
  | 'suspicious'     // May be virtual/outdated
  | 'invalid'        // Confirmed as wrong/virtual/closed
  | 'unknown'        // Could not verify either way

export type AddressQuality = 'excellent' | 'good' | 'needs_enrichment' | 'unusable'

export interface EnrichedAddress {
  line1: string
  line2?: string
  town: string
  postcode: string
  county?: string
  type: 'trading' | 'registered' | 'director' | 'other'
  source: string
  sourceUrl?: string
  confidence: number
}

export interface ConfirmationDetails {
  foundOnWebsite: boolean
  websiteUrl?: string
  foundOnGoogleMaps: boolean
  googleMapsVerified?: boolean
  isVirtualOffice: boolean
  virtualOfficeProvider?: string
  isOutdated: boolean
  outdatedReason?: string
  alternativeAddress?: EnrichedAddress
  sources: string[]
}

export interface EnrichmentRequest {
  operation: EnrichmentOperation
  companyName: string
  companyNumber: string
  registeredAddress?: string
  addressToConfirm?: {
    line1: string
    line2?: string
    town: string
    postcode: string
  }
  directorName?: string
  principalActivity?: string
  sicCode?: string
}

export interface FindEnrichmentResult {
  success: boolean
  operation: 'find'
  addresses?: EnrichedAddress[]
  bestAddress?: EnrichedAddress
  confidence: number
  notes?: string
  sources: string[]
}

export interface ConfirmEnrichmentResult {
  success: boolean
  operation: 'confirm'
  confirmationResult: ConfirmationResult
  confirmationDetails: ConfirmationDetails
  confidence: number
  notes?: string
}

export type EnrichmentResult = FindEnrichmentResult | ConfirmEnrichmentResult

export interface CompanyForEnrichment {
  company_number: string
  company_name: string
  registered_address?: any
  trading_address?: any
  director_name?: string
  principal_activity?: string
  sic_code?: string
  enrichment_status?: EnrichmentStatus
}

export interface EnrichmentJob {
  id: string
  companies: CompanyForEnrichment[]
  operation: EnrichmentOperation
  source: 'search_results' | 'prospects' | 'csv'
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: {
    current: number
    total: number
  }
  results: Map<string, EnrichmentResult>
  startedAt?: Date
  completedAt?: Date
}

