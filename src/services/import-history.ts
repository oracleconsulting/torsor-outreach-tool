import { supabase } from '../lib/supabase'
import type { Director } from '../types/directors'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

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

/**
 * Query outreach schema using REST API with Accept-Profile header
 */
async function queryOutreachSchema(endpoint: string) {
  const { data: { session } } = await supabase.auth.getSession()
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    headers: {
      'Accept-Profile': 'outreach',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to query outreach schema: ${response.status} - ${errorText}`)
  }

  return response.json()
}

export const importHistory = {
  /**
   * Get all directors imported in the last 24 hours
   */
  async getRecentImports(_practiceId: string): Promise<ImportedDirector[]> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const data = await queryOutreachSchema(
      `directors?address_source=in.(csv_import,csv_import_ai_confirmed)&address_verified_at=gte.${oneDayAgo.toISOString()}&order=address_verified_at.desc`
    )

    return (data || []).map((d: any) => ({
      ...d,
      appointment_count: 0, // TODO: Could join with appointments if needed
    }))
  },

  /**
   * Get summary statistics of recent imports
   */
  async getImportSummary(_practiceId: string): Promise<ImportSummary> {
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const data = await queryOutreachSchema(
      `directors?address_source=in.(csv_import,csv_import_ai_confirmed)&address_verified_at=gte.${oneDayAgo.toISOString()}&select=address_source,trading_address,contact_address,email,phone`
    )

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

    const data = await queryOutreachSchema(
      `directors?address_source=eq.csv_import_ai_confirmed&address_verified_at=gte.${oneDayAgo.toISOString()}&order=address_verified_at.desc`
    )

    return data || []
  },
}

