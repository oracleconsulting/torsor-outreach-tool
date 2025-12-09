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
    // 1. Get all officers of the client company from Companies House
    const officers = await companiesHouse.getCompanyOfficers(clientCompanyNumber, false)

    if (!officers || officers.length === 0) {
      return []
    }

    // Filter to active directors
    const activeDirectors = officers.filter(
      (o) =>
        !o.resigned_on &&
        ['director', 'llp member', 'secretary'].includes(o.officer_role.toLowerCase())
    )

    const networks: DirectorNetworkDetail[] = []

    for (const officer of activeDirectors) {
      // 2. Get or create director record
      const director = await this.getOrCreateDirector({
        officer_id: officer.links?.officer?.appointments?.split('/').pop(),
        name: officer.name,
        date_of_birth: officer.date_of_birth?.month
          ? `${officer.date_of_birth.month}/${officer.date_of_birth.year}`
          : undefined,
        nationality: officer.nationality,
      })

      // 3. Save current appointment
      await this.saveAppointment(director.id, {
        company_number: clientCompanyNumber,
        role: officer.officer_role,
        appointed_on: officer.appointed_on,
        resigned_on: officer.resigned_on,
      })

      // 4. Get all appointments for this director from Companies House
      let otherAppointments: Appointment[] = []
      if (officer.links?.officer?.appointments) {
        try {
          const appointmentsData = await getOfficerAppointments(
            officer.links.officer.appointments
          )

          if (appointmentsData.items) {
            otherAppointments = await Promise.all(
              appointmentsData.items
                .filter(
                  (a: any) =>
                    a.appointed_to?.company_number !== clientCompanyNumber && !a.resigned_on
                )
                .map(async (appt: any) => {
                  // Get company details
                  const company = await companiesHouse.getCompany(
                    appt.appointed_to.company_number
                  )

                  return {
                    company_number: appt.appointed_to.company_number,
                    company_name: appt.appointed_to.company_name || company?.company_name || '',
                    role: appt.officer_role,
                    appointed_on: appt.appointed_on,
                    resigned_on: appt.resigned_on,
                    is_active: !appt.resigned_on,
                    sector: company?.sic_codes?.[0],
                    status: company?.company_status,
                  }
                })
            )
          }

          // Save appointments to database
          for (const appt of otherAppointments) {
            await this.saveAppointment(director.id, {
              company_number: appt.company_number,
              role: appt.role,
              appointed_on: appt.appointed_on,
              resigned_on: appt.resigned_on,
            })
          }
        } catch (error) {
          console.error(`Error fetching appointments for ${officer.name}:`, error)
        }
      }

      // 5. Store network connections
      for (const opp of otherAppointments.filter((a) => a.is_active && a.status === 'active')) {
        await supabase.from('outreach.director_networks').upsert(
          {
            practice_id: practiceId,
            source_company: clientCompanyNumber,
            target_company: opp.company_number,
            connection_type: 'direct',
            connecting_directors: [director.id],
            connection_strength: 1,
            target_company_name: opp.company_name,
            target_sector: opp.sector,
            last_updated: new Date().toISOString(),
          },
          {
            onConflict: 'practice_id,source_company,target_company',
          }
        )
      }

      networks.push({
        directorId: director.id,
        directorName: director.name,
        appointments: otherAppointments,
        totalCompanies: otherAppointments.length + 1, // +1 for client
        activeCompanies: otherAppointments.filter((a) => a.is_active).length,
        yourClients: [clientCompanyNumber],
        opportunities: otherAppointments
          .filter((a) => a.is_active && a.status === 'active')
          .map((a) => ({
            company_number: a.company_number,
            company_name: a.company_name,
            connection_strength: 'direct' as const,
            connection_path: [director.name],
            source_client: clientCompanyNumber,
            connecting_directors: [director.id],
            sector: a.sector,
            status: a.status,
          })),
      })
    }

    return networks
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

