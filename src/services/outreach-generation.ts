import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export type OutreachFormat = 'email_intro' | 'formal_letter' | 'linkedin_connect' | 'linkedin_message' | 'warm_intro'
export type OutreachTone = 'formal' | 'professional' | 'friendly'

export interface OutreachRequest {
  practiceId: string
  companyNumber: string
  format: OutreachFormat
  tone: OutreachTone
  triggerEvent?: any
  networkConnection?: any
}

export interface OutreachDraft {
  format: OutreachFormat
  subject?: string
  body: string
  personalizationPoints: string[]
  suggestedSendDate: string
  draftId?: string
  generatedAt: string
}

export const outreachGeneration = {
  async generateOutreach(request: OutreachRequest): Promise<OutreachDraft> {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-outreach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  },

  async getOutreachDrafts(practiceId: string, prospectId?: string): Promise<any[]> {
    let query = supabase
      .from('outreach.outreach_drafts')
      .select('*')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false })

    if (prospectId) {
      query = query.eq('prospect_id', prospectId)
    }

    const { data, error } = await query

    if (error) throw error
    return data || []
  },

  async saveDraft(draft: {
    practiceId: string
    prospectId?: string
    companyNumber: string
    format: OutreachFormat
    tone?: OutreachTone
    subject?: string
    body: string
    personalizationPoints?: string[]
  }): Promise<any> {
    const { data, error } = await supabase
      .from('outreach.outreach_drafts')
      .insert({
        practice_id: draft.practiceId,
        prospect_id: draft.prospectId,
        company_number: draft.companyNumber,
        format: draft.format,
        tone: draft.tone,
        subject: draft.subject,
        body: draft.body,
        personalization_points: draft.personalizationPoints || [],
        status: 'draft',
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async markDraftSent(draftId: string): Promise<void> {
    const { error } = await supabase
      .from('outreach.outreach_drafts')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', draftId)

    if (error) throw error
  },

  async updateDraft(draftId: string, updates: Partial<{
    subject: string
    body: string
    status: 'draft' | 'approved' | 'sent' | 'discarded'
  }>): Promise<void> {
    const { error } = await supabase
      .from('outreach.outreach_drafts')
      .update(updates)
      .eq('id', draftId)

    if (error) throw error
  },
}

