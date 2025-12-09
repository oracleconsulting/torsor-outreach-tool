// Practice-Prospect Fit Matching types

export interface PracticeCapabilities {
  id: string
  practice_id: string
  sector_experience: Record<string, number> // SIC code -> client count
  typical_client_turnover_min?: number
  typical_client_turnover_max?: number
  typical_client_employees_min?: number
  typical_client_employees_max?: number
  primary_locations?: string[]
  serves_nationally: boolean
  total_capacity_hours?: number
  available_capacity_hours?: number
  last_synced: string
}

export interface ProspectFitScore {
  id: string
  practice_id: string
  company_number: string
  overall_fit: number // 0-100
  sector_fit?: number
  size_fit?: number
  service_fit?: number
  location_fit?: number
  capacity_fit?: number
  recommended_services?: ServiceRecommendation[]
  recommended_team_lead?: string // UUID of team member
  skill_gaps?: SkillGap[]
  requires_upskilling: boolean
  recommend_refer: boolean
  calculated_at: string
}

export interface ServiceRecommendation {
  serviceId: string
  serviceName: string
  fitScore: number
  requiredSkills: string[]
  teamReadiness: number
}

export interface SkillGap {
  skill: string
  skillName: string
  requiredLevel: number
  currentLevel: number
  gap: number
}

export interface ServiceNeed {
  service: string
  priority: 'high' | 'medium' | 'low'
}

