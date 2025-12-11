import { useState, useEffect } from 'react'
import { importHistory, type ImportedDirector, type ImportSummary } from '../../services/import-history'
import { CheckCircle, FileText, Loader2, Download } from 'lucide-react'
import toast from 'react-hot-toast'

interface ImportHistoryProps {
  practiceId: string
}

export function ImportHistory({ practiceId }: ImportHistoryProps) {
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [directors, setDirectors] = useState<ImportedDirector[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'ai_confirmed' | 'csv_only'>('all')

  useEffect(() => {
    loadData()
  }, [practiceId, filter])

  const loadData = async () => {
    setLoading(true)
    try {
      const [summaryData, directorsData] = await Promise.all([
        importHistory.getImportSummary(practiceId),
        filter === 'ai_confirmed'
          ? importHistory.getAIConfirmedDirectors(practiceId)
          : importHistory.getRecentImports(practiceId),
      ])
      setSummary(summaryData)
      setDirectors(directorsData)
    } catch (error) {
      toast.error(`Failed to load import history: ${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = ['Director Name', 'Company', 'Address Source', 'Trading Address', 'Contact Address', 'Email', 'Phone', 'Verified At']
    const rows = directors.map(d => [
      d.name,
      d.company_name || '',
      d.address_source || '',
      d.trading_address ? `${d.trading_address.address_line_1 || ''}, ${d.trading_address.locality || ''}, ${d.trading_address.postal_code || ''}` : '',
      d.contact_address ? `${d.contact_address.address_line_1 || ''}, ${d.contact_address.locality || ''}, ${d.contact_address.postal_code || ''}` : '',
      d.email || '',
      d.phone || '',
      d.address_verified_at ? new Date(d.address_verified_at).toLocaleString() : '',
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `director-import-history-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export started')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading import history...</span>
      </div>
    )
  }

  if (!summary || summary.total === 0) {
    return (
      <div className="bg-white rounded-lg border p-6 text-center">
        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No recent imports found in the last 24 hours.</p>
      </div>
    )
  }

  const filteredDirectors = filter === 'all' 
    ? directors 
    : filter === 'ai_confirmed'
    ? directors.filter(d => d.address_source === 'csv_import_ai_confirmed')
    : directors.filter(d => d.address_source === 'csv_import')

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold">{summary.total}</div>
          <div className="text-sm text-gray-600">Total Imported</div>
        </div>
        <div className="bg-green-50 rounded-lg border border-green-200 p-4">
          <div className="text-2xl font-bold text-green-600">{summary.ai_confirmed}</div>
          <div className="text-sm text-gray-600">AI Confirmed</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{summary.csv_only}</div>
          <div className="text-sm text-gray-600">CSV Only</div>
        </div>
        <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
          <div className="text-2xl font-bold text-purple-600">{summary.has_email + summary.has_phone}</div>
          <div className="text-sm text-gray-600">With Contact Info</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({summary.total})
          </button>
          <button
            onClick={() => setFilter('ai_confirmed')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              filter === 'ai_confirmed' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            AI Confirmed ({summary.ai_confirmed})
          </button>
          <button
            onClick={() => setFilter('csv_only')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              filter === 'csv_only' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            CSV Only ({summary.csv_only})
          </button>
        </div>
        <button
          onClick={exportToCSV}
          className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Directors List */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Director</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trading Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Verified</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredDirectors.map((director) => (
                <tr key={director.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="font-medium text-gray-900">{director.name}</div>
                    {director.company_name && (
                      <div className="text-xs text-gray-500">{director.company_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        director.address_source === 'csv_import_ai_confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {director.address_source === 'csv_import_ai_confirmed' ? (
                        <>
                          <CheckCircle className="h-3 w-3 inline mr-1" />
                          AI Confirmed
                        </>
                      ) : (
                        'CSV Only'
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {director.trading_address ? (
                      <div className="text-xs">
                        {director.trading_address.address_line_1}
                        {director.trading_address.address_line_2 && `, ${director.trading_address.address_line_2}`}
                        <br />
                        {director.trading_address.locality}
                        {director.trading_address.postal_code && `, ${director.trading_address.postal_code}`}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="text-xs space-y-1">
                      {director.email && <div>📧 {director.email}</div>}
                      {director.phone && <div>📞 {director.phone}</div>}
                      {!director.email && !director.phone && <span className="text-gray-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {director.address_verified_at ? (
                      <div className="text-xs">
                        {new Date(director.address_verified_at).toLocaleString()}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

