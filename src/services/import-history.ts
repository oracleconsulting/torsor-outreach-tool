import { supabase } from '../lib/supabase'
import type { Director } from '../types/directors'

export interface ImportedDirector extends Director {
  appointment_count?: number
  company_name?: string
}

export interface ImportSummary {
  total: number
  ai_confirmed: number
  csv_only: number
  has_trading_address: number
  has_contact_address: number
  has_email: number
  has_phone: number
}

export const importHistory = {
  /**
   * Get all directors imported in the last 24 hours
   */
  async getRecentImports(_practiceId: string): Promise<ImportedDirector[]> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await supabase
      .from('outreach.directors')
      .select(`
        *,
        appointments:director_appointments(count)
      `)
      .in('address_source', ['csv_import', 'csv_import_ai_confirmed'])
      .gte('address_verified_at', oneDayAgo.toISOString())
      .order('address_verified_at', { ascending: false })

    if (error) throw error

    return (data || []).map((d: any) => ({
      ...d,
      appointment_count: d.appointments?.[0]?.count || 0,
    }))
  },

  /**
   * Get summary statistics of recent imports
   */
  async getImportSummary(_practiceId: string): Promise<ImportSummary> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await supabase
      .from('outreach.directors')
      .select('address_source, trading_address, contact_address, email, phone')
      .in('address_source', ['csv_import', 'csv_import_ai_confirmed'])
      .gte('address_verified_at', oneDayAgo.toISOString())

    if (error) throw error

    const directors = data || []
    
    return {
      total: directors.length,
      ai_confirmed: directors.filter((d: any) => d.address_source === 'csv_import_ai_confirmed').length,
      csv_only: directors.filter((d: any) => d.address_source === 'csv_import').length,
      has_trading_address: directors.filter((d: any) => d.trading_address).length,
      has_contact_address: directors.filter((d: any) => d.contact_address).length,
      has_email: directors.filter((d: any) => d.email).length,
      has_phone: directors.filter((d: any) => d.phone).length,
    }
  },

  /**
   * Get only AI-confirmed directors
   */
  async getAIConfirmedDirectors(_practiceId: string): Promise<ImportedDirector[]> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await supabase
      .from('outreach.directors')
      .select('*')
      .eq('address_source', 'csv_import_ai_confirmed')
      .gte('address_verified_at', oneDayAgo.toISOString())
      .order('address_verified_at', { ascending: false })

    if (error) throw error
    return data || []
  },
}

