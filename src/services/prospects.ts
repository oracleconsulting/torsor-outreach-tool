import { supabase } from '../lib/supabase'
import type { Prospect, ProspectFilters, NewProspect, ProspectUpdate, BulkResult } from '../types'

export const prospects = {
  async getProspects(practiceId: string, filters?: ProspectFilters): Promise<Prospect[]> {
    let query = supabase
      .from('outreach.prospects')
      .select('*')
      .eq('practice_id', practiceId)
      .order('prospect_score', { ascending: false })
      .order('created_at', { ascending: false })

    if (filters?.status && filters.status.length > 0) {
      query = query.in('status', filters.status)
    }

    if (filters?.minScore !== undefined) {
      query = query.gte('prospect_score', filters.minScore)
    }

    if (filters?.maxScore !== undefined) {
      query = query.lte('prospect_score', filters.maxScore)
    }

    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom)
    }

    if (filters?.dateTo) {
      query = query.lte('created_at', filters.dateTo)
    }

    const { data, error } = await query

    if (error) throw error
    return (data || []) as Prospect[]
  },

  async getProspect(id: string): Promise<Prospect> {
    const { data, error } = await supabase
      .from('outreach.prospects')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data as Prospect
  },

  async saveProspect(prospect: NewProspect): Promise<Prospect> {
    // Check for duplicates
    const { data: existing } = await supabase
      .from('outreach.prospects')
      .select('id')
      .eq('practice_id', prospect.practice_id)
      .eq('company_number', prospect.company_number)
      .single()

    if (existing) {
      throw new Error('Prospect already exists for this company')
    }

    const { data, error } = await supabase
      .from('outreach.prospects')
      .insert(prospect)
      .select('*')
      .single()

    if (error) throw error

    // Auto-calculate fit score in background (don't await)
    if (data) {
      this.calculateFitScoreForProspect(prospect.practice_id, prospect.company_number).catch(
        (err) => console.error('Error calculating fit score:', err)
      )
    }

    return data as Prospect
  },

  async calculateFitScoreForProspect(practiceId: string, companyNumber: string): Promise<void> {
    // Get company data
    const { data: company } = await supabase
      .from('outreach.companies')
      .select('*')
      .eq('company_number', companyNumber)
      .single()

    if (!company) return

    // Import fit matching service
    const { fitMatching } = await import('./fit-matching')
    await fitMatching.calculatePracticeFit(practiceId, companyNumber, company as any)
  },

  async updateProspect(id: string, updates: ProspectUpdate): Promise<Prospect> {
    const updateData: any = { ...updates }

    // Auto-update timestamps based on status
    if (updates.status === 'contacted') {
      updateData.contacted_at = new Date().toISOString()
    }
    if (updates.status === 'converted') {
      updateData.converted_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('outreach.prospects')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error
    return data as Prospect
  },

  async deleteProspect(id: string): Promise<void> {
    const { error } = await supabase
      .from('outreach.prospects')
      .delete()
      .eq('id', id)

    if (error) throw error
  },

  async bulkSaveProspects(prospects: NewProspect[]): Promise<BulkResult> {
    const result: BulkResult = {
      saved: 0,
      skipped: 0,
      errors: [],
    }

    for (const prospect of prospects) {
      try {
        // Check for duplicates
        const { data: existing } = await supabase
          .from('outreach.prospects')
          .select('id')
          .eq('practice_id', prospect.practice_id)
          .eq('company_number', prospect.company_number)
          .single()

        if (existing) {
          result.skipped++
          continue
        }

        await supabase
          .from('outreach.prospects')
          .insert(prospect)

        result.saved++
      } catch (error: any) {
        result.errors.push(`${prospect.company_number}: ${error.message}`)
      }
    }

    return result
  },

  async exportProspects(practiceId: string, filters?: ProspectFilters): Promise<Blob> {
    const prospects = await this.getProspects(practiceId, filters)

    // Generate CSV
    const headers = [
      'Company Number',
      'Company Name',
      'Status',
      'Score',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Discovery Source',
      'Created At',
    ]

    const rows = prospects.map((p) => [
      p.company_number,
      (p as any).companies?.company_name || '',
      p.status,
      p.prospect_score.toString(),
      p.primary_contact_name || '',
      p.primary_contact_email || '',
      p.primary_contact_phone || '',
      p.discovery_source,
      p.created_at,
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return new Blob([csv], { type: 'text/csv' })
  },
}

