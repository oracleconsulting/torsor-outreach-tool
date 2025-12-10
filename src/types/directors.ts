// Director Network types

export interface Address {
  address_line_1?: string
  address_line_2?: string
  locality?: string
  region?: string
  postal_code?: string
  country?: string
}

export interface Director {
  id: string
  officer_id?: string
  name: string
  date_of_birth?: string
  nationality?: string
  total_appointments: number
  active_appointments: number
  sectors?: string[]
  last_updated: string
  // Address fields (from CSV import)
  trading_address?: Address
  contact_address?: Address
  email?: string
  phone?: string
  linkedin_url?: string
  preferred_contact_method?: 'email' | 'phone' | 'address' | 'linkedin'
  address_source?: string
  address_verified_at?: string
  address_verified_by?: string
}

export interface DirectorAppointment {
  id: string
  director_id: string
  company_number: string
  role: string
  appointed_on?: string
  resigned_on?: string
  is_active: boolean
}

export interface DirectorNetwork {
  id: string
  practice_id: string
  source_company: string
  target_company: string
  connection_type: 'direct' | 'shared_director'
  connecting_directors: string[]
  connection_strength: number
  target_company_name?: string
  target_turnover?: number
  target_sector?: string
  created_at: string
  last_updated: string
}

export interface NetworkOpportunity {
  company_number: string
  company_name: string
  connection_strength: 'direct' | 'shared_director' | 'second_degree'
  connection_path: string[] // Director names connecting you
  source_client: string
  source_client_name?: string
  connecting_directors: string[]
  turnover?: number
  sector?: string
  company_status?: string
  prospect_score?: number
  fit_score?: number
}

export interface DirectorNetworkDetail {
  directorId: string
  directorName: string
  appointments: Appointment[]
  totalCompanies: number
  activeCompanies: number
  yourClients: string[]
  opportunities: NetworkOpportunity[]
}

export interface Appointment {
  company_number: string
  company_name: string
  role: string
  appointed_on?: string
  resigned_on?: string
  is_active: boolean
  turnover?: number
  sector?: string
  status?: string
}

