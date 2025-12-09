import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { SearchResult } from '../../types'

interface CompanyCardProps {
  company: SearchResult
  onView?: () => void
  onSave?: () => void
}

export function CompanyCard({ company, onView, onSave }: CompanyCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-green-100 text-green-800'
    if (score >= 5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{company.company_name}</h3>
          <p className="text-sm text-gray-500 mt-1">{company.company_number}</p>
          
          <div className="flex items-center gap-2 mt-3">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
              {company.company_status}
            </span>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getScoreColor(company.prospect_score)}`}>
              Score: {company.prospect_score}/10
            </span>
            {company.is_covenant_safe ? (
              <div className="flex items-center text-green-600">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                <span className="text-xs">Safe</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                <span className="text-xs">Restricted</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        {onView && (
          <button
            onClick={onView}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
          >
            View Details
          </button>
        )}
        {onSave && (
          <button
            onClick={onSave}
            className="flex-1 px-3 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Save Prospect
          </button>
        )}
      </div>
    </div>
  )
}

