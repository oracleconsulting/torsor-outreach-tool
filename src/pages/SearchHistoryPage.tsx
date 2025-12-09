import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useSearchHistory, useDeleteSearch } from '../hooks/useSearchHistory'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useNavigate } from '@tanstack/react-router'
import { Trash2, Search, RefreshCw } from 'lucide-react'

export function SearchHistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [filterType, setFilterType] = useState<string>('all')

  useEffect(() => {
    const getPracticeId = async () => {
      if (!user) return
      const { data } = await supabase
        .from('practice_members')
        .select('practice_id')
        .eq('user_id', user.id)
        .single()
      if (data) setPracticeId(data.practice_id)
    }
    getPracticeId()
  }, [user])

  const { data: history, isLoading } = useSearchHistory(practiceId)
  const deleteSearch = useDeleteSearch()

  const filteredHistory = history?.filter((item) => {
    if (filterType === 'all') return true
    return item.search_type === filterType
  })

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this search?')) return
    try {
      await deleteSearch.mutateAsync(id)
    } catch (error) {
      alert('Error deleting search: ' + (error as Error).message)
    }
  }

  const handleRerun = (item: SearchHistory) => {
    if (item.search_type === 'firm' && item.search_params.firmNumber) {
      navigate({ to: '/firm-search', search: { firmNumber: item.search_params.firmNumber } })
    } else if (item.search_type === 'postcode' && item.search_params.postcode) {
      navigate({ to: '/address-search' })
      // Could pass postcode as search param
    } else if (item.search_type === 'address') {
      navigate({ to: '/address-search' })
    }
  }

  const getSearchTypeLabel = (type: string) => {
    switch (type) {
      case 'firm':
        return 'Firm Search'
      case 'address':
        return 'Address Search'
      case 'postcode':
        return 'Postcode Search'
      case 'company':
        return 'Company Search'
      default:
        return type
    }
  }

  const formatSearchParams = (params: Record<string, any>) => {
    if (params.firmNumber) return `Firm: ${params.firmNumber}`
    if (params.postcode) return `Postcode: ${params.postcode}`
    if (params.query) return `Query: ${params.query}`
    return JSON.stringify(params)
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="mt-4 text-gray-600">Loading search history...</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Search History</h1>
          <p className="text-gray-600 mt-2">View and manage your past searches</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filterType === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('firm')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filterType === 'firm'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Firm Searches
          </button>
          <button
            onClick={() => setFilterType('address')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filterType === 'address'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Address Searches
          </button>
          <button
            onClick={() => setFilterType('postcode')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filterType === 'postcode'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Postcode Searches
          </button>
        </div>

        {filteredHistory && filteredHistory.length > 0 ? (
          <div className="space-y-4">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Search className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{getSearchTypeLabel(item.search_type)}</span>
                      <span className="text-sm text-gray-500">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{formatSearchParams(item.search_params)}</p>
                    <p className="text-xs text-gray-500">
                      {item.results_count} {item.results_count === 1 ? 'result' : 'results'} found
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRerun(item)}
                      className="p-2 text-primary hover:bg-primary/10 rounded-md"
                      title="Re-run search"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                      title="Delete search"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            {filterType === 'all'
              ? 'No search history yet. Start searching to see your history here.'
              : `No ${filterType} searches found.`}
          </div>
        )}
      </div>
    </div>
  )
}
