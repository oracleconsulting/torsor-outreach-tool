import { AlertTriangle } from 'lucide-react'
import type { ProspectFitScore } from '../../types/fit-matching'
import { FitBreakdown } from './FitBreakdown'

interface FitScoreBadgeProps {
  score: ProspectFitScore | null | undefined
  showTooltip?: boolean
}

export function FitScoreBadge({ score, showTooltip = true }: FitScoreBadgeProps) {
  if (!score) {
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
        No score
      </span>
    )
  }

  const getColor = () => {
    if (score.overall_fit >= 70) return 'bg-green-100 text-green-800'
    if (score.overall_fit >= 50) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const badge = (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getColor()} flex items-center gap-1`}>
      {score.overall_fit}% Fit
      {score.recommend_refer && <AlertTriangle className="h-3 w-3" />}
    </span>
  )

  if (showTooltip) {
    return (
      <div className="group relative">
        {badge}
        <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block">
          <FitBreakdown score={score} />
        </div>
      </div>
    )
  }

  return badge
}

