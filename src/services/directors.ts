import { supabase } from '../lib/supabase'
import { companiesHouse } from './companiesHouse'
import type {
  Director,
  DirectorAppointment,
  DirectorNetwork,
  NetworkOpportunity,
  DirectorNetworkDetail,
  Appointment,
} from '../types/directors'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function getOfficerAppointments(officerId: string): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession()

  const response = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    },
    body: JSON.stringify({
      action: 'getOfficerAppointments',
      officerId,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch officer appointments: ${response.statusText}`)
  }

  return response.json()
}

export const directors = {
  async getDirectorByOfficerId(officerId: string): Promise<Director | null> {
    const { data, error } = await supabase
      .from('outreach.directors')
      .select('*')
      .eq('officer_id', officerId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async getOrCreateDirector(officerData: {
    officer_id?: string
    name: string
    date_of_birth?: string
    nationality?: string
  }): Promise<Director> {
    // Try to find existing
    if (officerData.officer_id) {
      const existing = await this.getDirectorByOfficerId(officerData.officer_id)
      if (existing) return existing
    }

    // Create new
    const { data, error } = await supabase
      .from('outreach.directors')
      .insert(officerData)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getDirectorAppointments(directorId: string): Promise<DirectorAppointment[]> {
    const { data, error } = await supabase
      .from('outreach.director_appointments')
      .select('*')
      .eq('director_id', directorId)
      .order('appointed_on', { ascending: false })

    if (error) throw error
    return data
  },

  async getCompanyDirectors(companyNumber: string): Promise<DirectorAppointment[]> {
    const { data, error } = await supabase
      .from('outreach.director_appointments')
      .select(`
        *,
        director:directors(*)
      `)
      .eq('company_number', companyNumber)
      .eq('is_active', true)

    if (error) throw error
    return data
  },

  async saveAppointment(
    directorId: string,
    appointment: {
      company_number: string
      role: string
      appointed_on?: string
      resigned_on?: string
    }
  ): Promise<DirectorAppointment> {
    const { data, error } = await supabase
      .from('outreach.director_appointments')
      .upsert(
        {
          director_id: directorId,
          ...appointment,
        },
        {
          onConflict: 'director_id,company_number,role',
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async buildNetworkForCompany(
    practiceId: string,
    clientCompanyNumber: string
  ): Promise<DirectorNetworkDetail[]> {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(`${SUPABASE_URL}/functions/v1/build-director-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        practiceId,
        companyNumber: clientCompanyNumber,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return result.networks || []
  },

  async getNetworkOpportunities(practiceId: string): Promise<NetworkOpportunity[]> {
    const { data: networks, error } = await supabase
      .from('outreach.director_networks')
      .select(`
        *,
        source_company_data:companies!director_networks_source_company_fkey(company_name),
        target_company_data:companies!director_networks_target_company_fkey(company_name)
      `)
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Get director names
    const directorIds = [
      ...new Set(networks.flatMap((n) => n.connecting_directors || [])),
    ]

    const { data: directorsData } = await supabase
      .from('outreach.directors')
      .select('id, name')
      .in('id', directorIds)

    const directorMap = new Map(directorsData?.map((d) => [d.id, d.name]) || [])

    return networks.map((n) => ({
      company_number: n.target_company,
      company_name: n.target_company_name || n.target_company_data?.company_name || '',
      connection_strength: n.connection_type as 'direct' | 'shared_director',
      connection_path: (n.connecting_directors || [])
        .map((id) => directorMap.get(id))
        .filter(Boolean) as string[],
      source_client: n.source_company,
      source_client_name: n.source_company_data?.company_name,
      connecting_directors: n.connecting_directors || [],
      turnover: n.target_turnover,
      sector: n.target_sector,
    }))
  },
}

