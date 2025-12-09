import { supabase } from '../lib/supabase'
import type { SearchHistory } from '../types'

export const searchHistory = {
  async getSearchHistory(practiceId: string, limit = 50): Promise<SearchHistory[]> {
    const { data, error } = await supabase
      .from('outreach.search_history')
      .select('*')
      .eq('practice_id', practiceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as SearchHistory[]
  },

  async saveSearch(
    practiceId: string,
    userId: string,
    searchType: 'address' | 'firm' | 'postcode' | 'company',
    searchParams: Record<string, any>,
    resultsCount: number
  ): Promise<void> {
    const { error } = await supabase.from('outreach.search_history').insert({
      practice_id: practiceId,
      user_id: userId,
      search_type: searchType,
      search_params: searchParams,
      results_count: resultsCount,
    })

    if (error) throw error
  },

  async deleteSearch(id: string): Promise<void> {
    const { error } = await supabase.from('outreach.search_history').delete().eq('id', id)
    if (error) throw error
  },
}

