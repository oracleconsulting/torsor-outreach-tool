import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Search as SearchIcon, Save } from 'lucide-react'
import type { SearchResult } from '../../types'
import { AddressStatusCell } from '../enrichment/AddressStatusCell'
import { FitScoreBadge } from '../fit/FitScoreBadge'
import { useFitScore } from '../../hooks/useFitScore'

interface SearchResultsProps {
  results: SearchResult[]
  onSaveProspect?: (companyNumber: string) => void
  onViewCompany?: (companyNumber: string) => void
  onEnrichCompanies?: (companyNumbers: string[]) => void
  practiceId?: string
}

export function SearchResults({ results, onSaveProspect, onViewCompany, onEnrichCompanies, practiceId }: SearchResultsProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleSelect = (companyNumber: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(companyNumber)) {
      newSelected.delete(companyNumber)
    } else {
      newSelected.add(companyNumber)
    }
    setSelected(newSelected)
  }

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800'
    if (score >= 5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No companies found. Try a different search.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          Found {results.length} {results.length === 1 ? 'company' : 'companies'}
        </p>
        {selected.size > 0 && (
          <div className="flex gap-2">
            {onEnrichCompanies && (
              <button
                onClick={() => {
                  onEnrichCompanies(Array.from(selected))
                  setSelected(new Set())
                }}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
              >
                <SearchIcon className="h-4 w-4" />
                Find Addresses ({selected.size})
              </button>
            )}
            <button
              onClick={() => {
                selected.forEach((num) => onSaveProspect?.(num))
                setSelected(new Set())
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 text-sm"
            >
              <Save className="h-4 w-4" />
              Save {selected.size} Selected
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selected.size === results.length && results.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelected(new Set(results.map((r) => r.company_number)))
                    } else {
                      setSelected(new Set())
                    }
                  }}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Covenant
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address Status
              </th>
              {practiceId && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fit Score
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {results.map((result) => (
              <tr key={result.company_number} className="hover:bg-gray-50">
                <td className="px-4 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selected.has(result.company_number)}
                    onChange={() => toggleSelect(result.company_number)}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  />
                </td>
                <td className="px-4 py-4">
                  <div>
                    <div className="font-medium text-gray-900">{result.company_name}</div>
                    <div className="text-sm text-gray-500">{result.company_number}</div>
                  </div>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                    {result.company_status}
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScoreColor(result.prospect_score)}`}>
                    {result.prospect_score}/10
                  </span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  {result.is_covenant_safe ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      <span className="text-xs">Safe</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600" title={result.covenant_firm_name}>
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      <span className="text-xs">Restricted</span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap">
                  <AddressStatusCell
                    result={result}
                    onEnrich={() => onEnrichCompanies?.([result.company_number])}
                  />
                </td>
                {practiceId && (
                  <td className="px-4 py-4 whitespace-nowrap">
                    <FitScoreCell companyNumber={result.company_number} practiceId={practiceId} />
                  </td>
                )}
                <td className="px-4 py-4 whitespace-nowrap text-sm">
                  <button
                    onClick={() => onViewCompany?.(result.company_number)}
                    className="text-primary hover:text-primary/80 mr-4"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => onSaveProspect?.(result.company_number)}
                    className="text-primary hover:text-primary/80"
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FitScoreCell({ companyNumber, practiceId }: { companyNumber: string; practiceId: string }) {
  const { data: fitScore } = useFitScore(practiceId, companyNumber)
  return <FitScoreBadge score={fitScore} />
}

