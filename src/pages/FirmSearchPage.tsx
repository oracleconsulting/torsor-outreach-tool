import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { FirmSearchForm } from '../components/search/FirmSearchForm'
import { SearchResults } from '../components/search/SearchResults'
import { CompanyModal } from '../components/company/CompanyModal'
import { BulkEnrichmentModal } from '../components/enrichment/BulkEnrichmentModal'
import { useFirmDiscovery } from '../hooks/useCompaniesHouse'
import { useSaveProspect } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { FirmDiscoveryResult, SearchResult } from '../types'
import type { CompanyForEnrichment } from '../types/enrichment'

export function FirmSearchPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [discoveryResults, setDiscoveryResults] = useState<FirmDiscoveryResult | null>(null)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false)
  const [companiesToEnrich, setCompaniesToEnrich] = useState<CompanyForEnrichment[]>([])
  const firmDiscovery = useFirmDiscovery()
  const saveProspect = useSaveProspect()

  // Get practice ID from user
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

  const handleSaveProspect = async (companyNumber: string) => {
    if (!practiceId || !discoveryResults) return

    const company = discoveryResults.companies.find((c) => c.company_number === companyNumber)
    if (!company) return

    try {
      await saveProspect.mutateAsync({
        practice_id: practiceId,
        company_number: companyNumber,
        prospect_score: company.prospect_score,
        score_factors: company.score_factors,
        status: 'new',
        discovery_source: 'firm_search',
        discovery_address: discoveryResults.firm.registered_address,
        discovered_via_firm: discoveryResults.firm.company_number,
      })
      toast.success('Prospect saved successfully!')
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        toast.error('This prospect has already been saved.')
      } else {
        toast.error('Error saving prospect: ' + error.message)
      }
    }
  }

  const handleViewCompany = (companyNumber: string) => {
    setSelectedCompany(companyNumber)
  }

  const handleSaveFromModal = async () => {
    if (selectedCompany) {
      await handleSaveProspect(selectedCompany)
      setSelectedCompany(null)
    }
  }

  const handleEnrichCompanies = (companyNumbers: string[]) => {
    if (!discoveryResults) return

    const companies: CompanyForEnrichment[] = companyNumbers
      .map((num) => {
        const result = discoveryResults.companies.find((c) => c.company_number === num)
        if (!result) return null

        return {
          company_number: result.company_number,
          company_name: result.company_name,
          registered_address: result.registered_office_address,
          enrichment_status: result.enrichment_status,
        }
      })
      .filter((c): c is CompanyForEnrichment => c !== null)

    setCompaniesToEnrich(companies)
    setEnrichmentModalOpen(true)
  }

  const handleSaveEnrichedProspects = async (companyNumbers: string[]) => {
    if (!practiceId || !discoveryResults) return

    for (const companyNumber of companyNumbers) {
      const company = discoveryResults.companies.find((c) => c.company_number === companyNumber)
      if (!company) continue

      try {
        await saveProspect.mutateAsync({
          practice_id: practiceId,
          company_number: companyNumber,
          prospect_score: company.prospect_score,
          score_factors: company.score_factors,
          status: 'new',
          discovery_source: 'firm_search',
          discovery_address: discoveryResults.firm.registered_address,
          discovered_via_firm: discoveryResults.firm.company_number,
        })
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error('Error saving prospect:', error)
        }
      }
    }

    toast.success(`Saved ${companyNumbers.length} prospects`)
    setEnrichmentModalOpen(false)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Discover Firm Clients</h1>
        <p className="text-gray-600 mt-2">
          Enter an accounting firm's company number to discover all companies at their registered address
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Search</h2>
          <FirmSearchForm
            practiceId={practiceId}
            onResults={(results) => setDiscoveryResults(results)}
          />
        </div>

        {discoveryResults && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Firm Details</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Name:</span> {discoveryResults.firm.company_name}</p>
              <p><span className="font-medium">Number:</span> {discoveryResults.firm.company_number}</p>
              <p><span className="font-medium">Address:</span> {discoveryResults.firm.registered_address}</p>
            </div>
          </div>
        )}
      </div>

      {discoveryResults && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">
            Discovered Companies ({discoveryResults.total_found})
          </h2>
          <SearchResults
            results={discoveryResults.companies}
            onSaveProspect={handleSaveProspect}
            onViewCompany={handleViewCompany}
            onEnrichCompanies={handleEnrichCompanies}
          />
        </div>
      )}

      {firmDiscovery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error: {firmDiscovery.error?.message || 'Failed to discover firm clients'}
        </div>
      )}

      {selectedCompany && (
        <CompanyModal
          companyNumber={selectedCompany}
          isOpen={!!selectedCompany}
          onClose={() => setSelectedCompany(null)}
          onSaveProspect={handleSaveFromModal}
        />
      )}

      {enrichmentModalOpen && (
        <BulkEnrichmentModal
          isOpen={enrichmentModalOpen}
          onClose={() => {
            setEnrichmentModalOpen(false)
            setCompaniesToEnrich([])
          }}
          companies={companiesToEnrich}
          operation="find"
          source="search_results"
          onSaveProspects={handleSaveEnrichedProspects}
        />
      )}
    </div>
  )
}
