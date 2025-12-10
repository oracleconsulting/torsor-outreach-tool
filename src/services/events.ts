import { supabase } from '../lib/supabase'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export const events = {
  async addToWatchlist(
    practiceId: string,
    companyNumber: string,
    eventTypes: string[] = ['accounts_overdue', 'director_change', 'address_change', 'anniversary']
  ): Promise<void> {
    const { error } = await supabase.from('outreach.watchlist').upsert(
      {
        practice_id: practiceId,
        company_number: companyNumber,
        events_to_watch: eventTypes,
        is_active: true,
      },
      {
        onConflict: 'practice_id,company_number',
      }
    )

    if (error) throw error
  },

  async removeFromWatchlist(practiceId: string, companyNumber: string): Promise<void> {
    const { error } = await supabase
      .from('outreach.watchlist')
      .delete()
      .eq('practice_id', practiceId)
      .eq('company_number', companyNumber)

    if (error) throw error
  },

  async getWatchlist(practiceId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('outreach.watchlist')
      .select(`
        *,
        company:companies!watchlist_company_number_fkey(company_name, company_status)
      `)
      .eq('practice_id', practiceId)
      .eq('is_active', true)
      .order('added_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async updateEventPreferences(
    practiceId: string,
    companyNumber: string,
    eventTypes: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('outreach.watchlist')
      .update({ events_to_watch: eventTypes })
      .eq('practice_id', practiceId)
      .eq('company_number', companyNumber)

    if (error) throw error
  },

  async detectEvents(practiceId: string): Promise<{ checked: number; eventsDetected: number }> {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(`${SUPABASE_URL}/functions/v1/detect-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ practiceId }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return response.json()
  },

  async getPendingEvents(practiceId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('outreach.triggered_events')
      .select(`
        *,
        company:companies!triggered_events_company_number_fkey(company_name, company_status)
      `)
      .eq('practice_id', practiceId)
      .eq('outreach_status', 'pending')
      .order('triggered_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async getEventsByType(practiceId: string, eventType: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('outreach.triggered_events')
      .select(`
        *,
        company:companies!triggered_events_company_number_fkey(company_name, company_status)
      `)
      .eq('practice_id', practiceId)
      .eq('event_type', eventType)
      .eq('outreach_status', 'pending')
      .order('triggered_at', { ascending: false })

    if (error) throw error
    return data || []
  },

  async markEventHandled(eventId: string, status: 'draft_generated' | 'sent' | 'skipped'): Promise<void> {
    const updates: any = { outreach_status: status }
    if (status === 'sent') {
      updates.outreach_sent_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('outreach.triggered_events')
      .update(updates)
      .eq('id', eventId)

    if (error) throw error
  },
}



