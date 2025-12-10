import { supabase } from '../lib/supabase'
import type { PracticeCapabilities, ProspectFitScore, ServiceNeed } from '../types/fit-matching'
import type { Company, Prospect } from '../types'

// Helper to extract turnover from company data
function extractTurnover(_company: Company | Prospect): number | undefined {
  // This would need accounts data parsing - placeholder for now
  return undefined
}

// Helper to extract region from address
function extractRegion(address: any): string {
  if (!address) return ''
  return address.region || address.locality || ''
}

// Infer service needs from prospect data
export function inferServiceNeeds(prospect: Company | Prospect): ServiceNeed[] {
  const needs: ServiceNeed[] = []

  const sicCodes = 'sic_codes' in prospect ? prospect.sic_codes : []
  const companyType = 'company_type' in prospect ? prospect.company_type : undefined
  const turnover = extractTurnover(prospect)

  // Base on SIC codes
  if (sicCodes.some((s) => s.startsWith('68'))) {
    // Property company
    needs.push({ service: 'property_tax', priority: 'high' })
    needs.push({ service: 'capital_allowances', priority: 'medium' })
  }

  if (sicCodes.some((s) => s.startsWith('62') || s.startsWith('63'))) {
    // IT/Software
    needs.push({ service: 'rd_tax_credits', priority: 'high' })
    needs.push({ service: 'advisory', priority: 'medium' })
  }

  // Base on turnover
  if (turnover && turnover > 1000000) {
    needs.push({ service: 'management_accounts', priority: 'high' })
    needs.push({ service: 'advisory', priority: 'medium' })
  }

  if (turnover && turnover > 5000000) {
    needs.push({ service: 'audit', priority: 'high' })
    needs.push({ service: 'fractional_cfo', priority: 'medium' })
  }

  // Base on company type
  if (companyType === 'ltd') {
    needs.push({ service: 'corporation_tax', priority: 'high' })
    needs.push({ service: 'annual_accounts', priority: 'high' })
  }

  return needs
}

// Calculate sector fit
function calculateSectorFit(
  prospectSics: string[],
  practiceExperience: Record<string, number>
): number {
  if (prospectSics.length === 0) return 50 // Neutral if no SIC codes

  // Check if practice has experience in any of prospect's sectors
  const hasExperience = prospectSics.some((sic) => {
    const mainSic = sic.substring(0, 2) // First 2 digits
    return practiceExperience[mainSic] && practiceExperience[mainSic] > 0
  })

  if (!hasExperience) return 20 // Low fit if no sector experience

  // Calculate based on number of clients in sector
  const maxClients = Math.max(...Object.values(practiceExperience), 0)
  const relevantClients = prospectSics.reduce((sum, sic) => {
    const mainSic = sic.substring(0, 2)
    return sum + (practiceExperience[mainSic] || 0)
  }, 0)

  // Score based on relative experience
  return Math.min(100, 50 + (relevantClients / maxClients) * 50)
}

// Calculate size fit
function calculateSizeFit(
  prospectTurnover: number | undefined,
  minTurnover?: number,
  maxTurnover?: number
): number {
  if (!prospectTurnover || !minTurnover || !maxTurnover) return 50

  if (prospectTurnover >= minTurnover && prospectTurnover <= maxTurnover) {
    return 100 // Perfect fit
  }

  // Calculate distance from ideal range
  const range = maxTurnover - minTurnover
  const center = (minTurnover + maxTurnover) / 2
  const distance = Math.abs(prospectTurnover - center)

  if (distance <= range) {
    return 75 // Close to ideal
  }

  if (distance <= range * 2) {
    return 50 // Moderate fit
  }

  return 25 // Poor fit
}

// Calculate location fit
function calculateLocationFit(
  prospectLocation: string,
  practiceLocations: string[],
  servesNationally: boolean
): number {
  if (servesNationally) return 80 // High fit if national

  if (practiceLocations.length === 0) return 50 // Neutral if no location data

  const normalizedProspect = prospectLocation.toLowerCase().trim()
  const hasMatch = practiceLocations.some((loc) =>
    normalizedProspect.includes(loc.toLowerCase()) || loc.toLowerCase().includes(normalizedProspect)
  )

  return hasMatch ? 90 : 30
}

// Calculate service fit (simplified - would need Torsor integration)
function calculateServiceFit(needs: ServiceNeed[]): number {
  // Placeholder - would check against practice service readiness
  // For now, assume 70% fit if needs identified
  return needs.length > 0 ? 70 : 50
}

// Calculate capacity fit (simplified)
function calculateCapacityFit(needs: ServiceNeed[], availableHours?: number): number {
  if (!availableHours) return 50 // Neutral if no capacity data

  // Estimate hours needed (simplified)
  const estimatedHours = needs.length * 20 // Rough estimate

  if (availableHours >= estimatedHours * 2) return 100 // Plenty of capacity
  if (availableHours >= estimatedHours) return 75 // Adequate capacity
  if (availableHours >= estimatedHours * 0.5) return 50 // Tight capacity
  return 25 // Insufficient capacity
}

export const fitMatching = {
  async getPracticeCapabilities(practiceId: string): Promise<PracticeCapabilities | null> {
    const { data, error } = await supabase
      .from('outreach.practice_capabilities')
      .select('*')
      .eq('practice_id', practiceId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },

  async syncPracticeCapabilities(practiceId: string): Promise<PracticeCapabilities> {
    // This would fetch from Torsor platform
    // For now, create/update with defaults
    const { data, error } = await supabase
      .from('outreach.practice_capabilities')
      .upsert(
        {
          practice_id: practiceId,
          sector_experience: {},
          serves_nationally: false,
          last_synced: new Date().toISOString(),
        },
        {
          onConflict: 'practice_id',
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async calculatePracticeFit(
    practiceId: string,
    companyNumber: string,
    company: Company
  ): Promise<ProspectFitScore> {
    // Get practice capabilities
    let capabilities = await this.getPracticeCapabilities(practiceId)
    if (!capabilities) {
      capabilities = await this.syncPracticeCapabilities(practiceId)
    }

    // Infer service needs
    const needs = inferServiceNeeds(company)

    // Calculate dimension scores
    const sectorFit = calculateSectorFit(company.sic_codes || [], capabilities.sector_experience)
    const turnover = extractTurnover(company)
    const sizeFit = calculateSizeFit(
      turnover,
      capabilities.typical_client_turnover_min,
      capabilities.typical_client_turnover_max
    )
    const locationFit = calculateLocationFit(
      extractRegion(company.registered_office_address),
      capabilities.primary_locations || [],
      capabilities.serves_nationally
    )
    const serviceFit = calculateServiceFit(needs)
    const capacityFit = calculateCapacityFit(needs, capabilities.available_capacity_hours)

    // Overall weighted score
    const overallFit = Math.round(
      sectorFit * 0.25 +
        sizeFit * 0.15 +
        serviceFit * 0.3 +
        locationFit * 0.1 +
        capacityFit * 0.2
    )

    // Determine flags
    const requiresUpskilling = needs.length > 2 && serviceFit < 60
    const recommendRefer = overallFit < 40

    // Save score
    const { data, error } = await supabase
      .from('outreach.prospect_fit_scores')
      .upsert(
        {
          practice_id: practiceId,
          company_number: companyNumber,
          overall_fit: overallFit,
          sector_fit: sectorFit,
          size_fit: sizeFit,
          service_fit: serviceFit,
          location_fit: locationFit,
          capacity_fit: capacityFit,
          recommended_services: needs.map((n) => ({
            service: n.service,
            priority: n.priority,
          })),
          requires_upskilling: requiresUpskilling,
          recommend_refer: recommendRefer,
          calculated_at: new Date().toISOString(),
        },
        {
          onConflict: 'practice_id,company_number',
        }
      )
      .select()
      .single()

    if (error) throw error
    return data
  },

  async getFitScore(
    practiceId: string,
    companyNumber: string
  ): Promise<ProspectFitScore | null> {
    const { data, error } = await supabase
      .from('outreach.prospect_fit_scores')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('company_number', companyNumber)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  },
}

