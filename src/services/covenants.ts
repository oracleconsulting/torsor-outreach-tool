import { supabase } from '../lib/supabase'
import type { Covenant, NewCovenant, CovenantUpdate, CovenantCheck } from '../types'

export const covenants = {
  async getCovenants(practiceId: string, includeExpired = false): Promise<Covenant[]> {
    let query = supabase
      .from('outreach.covenant_restrictions')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('is_active', true)

    if (!includeExpired) {
      query = query.gte('restriction_end_date', new Date().toISOString().split('T')[0])
    }

    const { data, error } = await query.order('restriction_end_date', { ascending: true })

    if (error) throw error
    return (data || []) as Covenant[]
  },

  async getCovenant(id: string): Promise<Covenant> {
    const { data, error } = await supabase
      .from('outreach.covenant_restrictions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Covenant
  },

  async createCovenant(covenant: NewCovenant): Promise<Covenant> {
    // Validate dates
    const startDate = new Date(covenant.restriction_start_date)
    const endDate = new Date(covenant.restriction_end_date)

    if (endDate <= startDate) {
      throw new Error('Restriction end date must be after start date')
    }

    // Get firm address to generate hash
    if (!covenant.address_hash && covenant.accounting_firm_number) {
      // Fetch firm details to get address
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()

      const firmResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          action: 'getCompany',
          params: { companyNumber: covenant.accounting_firm_number },
        }),
      })

      if (firmResponse.ok) {
        const firm = await firmResponse.json()
        if (firm.registered_office_address) {
          const line1 = (firm.registered_office_address.address_line_1 || '').toLowerCase().trim()
          const postcode = (firm.registered_office_address.postal_code || '').toLowerCase().trim()
          covenant.address_hash = btoa(line1 + postcode).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
        }
      }
    }

    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('outreach.covenant_restrictions')
      .insert({
        ...covenant,
        created_by: user?.id,
      })
      .select()
      .single()

    if (error) throw error
    return data as Covenant
  },

  async updateCovenant(id: string, updates: CovenantUpdate): Promise<Covenant> {
    const { data, error } = await supabase
      .from('outreach.covenant_restrictions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data as Covenant
  },

  async deactivateCovenant(id: string): Promise<void> {
    const { error } = await supabase
      .from('outreach.covenant_restrictions')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error
  },

  async checkCovenantSafety(
    addressHash: string,
    practiceId: string,
    targetDate?: Date
  ): Promise<CovenantCheck> {
    const checkDate = targetDate || new Date()
    const dateStr = checkDate.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('outreach.covenant_restrictions')
      .select('accounting_firm_name, restriction_end_date')
      .eq('practice_id', practiceId)
      .eq('address_hash', addressHash)
      .eq('is_active', true)
      .lte('restriction_start_date', dateStr)
      .gte('restriction_end_date', dateStr)
      .limit(1)

    if (error) throw error

    if (data && data.length > 0) {
      return {
        isSafe: false,
        restrictingFirm: data[0].accounting_firm_name,
        restrictionEnd: data[0].restriction_end_date,
      }
    }

    return { isSafe: true }
  },
}

