import type { ProspectFitScore } from '../../types/fit-matching'

interface FitBreakdownProps {
  score: ProspectFitScore
}

export function FitBreakdown({ score }: FitBreakdownProps) {
  const dimensions = [
    { label: 'Sector Experience', value: score.sector_fit },
    { label: 'Client Size Match', value: score.size_fit },
    { label: 'Service Capability', value: score.service_fit },
    { label: 'Location', value: score.location_fit },
    { label: 'Team Capacity', value: score.capacity_fit },
  ].filter((d) => d.value !== undefined && d.value !== null)

  return (
    <div className="bg-white border rounded-lg shadow-lg p-4 min-w-[280px] space-y-3">
      <div className="font-medium text-sm border-b pb-2">Practice Fit Analysis</div>

      <div className="space-y-2">
        {dimensions.map((dim) => (
          <div key={dim.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{dim.label}</span>
              <span className="font-medium">{dim.value}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${
                  dim.value! >= 70
                    ? 'bg-green-500'
                    : dim.value! >= 50
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${dim.value}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {score.recommended_services && score.recommended_services.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-gray-500 mb-1">Recommended Services</div>
          <div className="flex flex-wrap gap-1">
            {score.recommended_services.slice(0, 3).map((service: any, idx: number) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded"
              >
                {service.service || service.serviceName}
              </span>
            ))}
            {score.recommended_services.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{score.recommended_services.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {score.skill_gaps && score.skill_gaps.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-gray-500 mb-1">Skill Gaps</div>
          <div className="flex flex-wrap gap-1">
            {score.skill_gaps.slice(0, 3).map((gap: any, idx: number) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs bg-orange-100 text-orange-800 rounded"
              >
                {gap.skill || gap.skillName}
              </span>
            ))}
            {score.skill_gaps.length > 3 && (
              <span className="px-2 py-0.5 text-xs text-gray-500">
                +{score.skill_gaps.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {score.requires_upskilling && (
        <div className="pt-2 border-t">
          <div className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            May require team upskilling
          </div>
        </div>
      )}

      {score.recommend_refer && (
        <div className="pt-2 border-t">
          <div className="text-xs text-red-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Consider referring to another practice
          </div>
        </div>
      )}
    </div>
  )
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

