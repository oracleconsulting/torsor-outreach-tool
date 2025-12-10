import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { AddressSearchForm } from '../components/search/AddressSearchForm'
import { SearchResults } from '../components/search/SearchResults'
import { CompanyModal } from '../components/company/CompanyModal'
import { BulkEnrichmentModal } from '../components/enrichment/BulkEnrichmentModal'
import { useSaveProspect } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { Company, SearchResult } from '../types'
import type { CompanyForEnrichment } from '../types/enrichment'

export function AddressSearchPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false)
  const [companiesToEnrich, setCompaniesToEnrich] = useState<CompanyForEnrichment[]>([])
  const saveProspect = useSaveProspect()

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

  const handleResults = async (companies: Company[]) => {
    // Convert Company[] to SearchResult[] with scoring
    const results: SearchResult[] = await Promise.all(
      companies.map(async (company) => {
        // Calculate prospect score
        let score = 5
        const factors: Record<string, number> = {}

        // Active status (+1)
        if (company.company_status === 'active') {
          score += 1
          factors.active_status = 1
        }

        // Company age
        if (company.incorporation_date) {
          const ageYears =
            (Date.now() - new Date(company.incorporation_date).getTime()) /
            (1000 * 60 * 60 * 24 * 365)
          if (ageYears >= 5) {
            score += 2
            factors.company_age = 2
          } else if (ageYears >= 2) {
            score += 1
            factors.company_age = 1
          }
        }

        // Has filed accounts (+1)
        if (company.accounts?.last_accounts?.made_up_to) {
          score += 1
          factors.has_accounts = 1
        }

        score = Math.min(score, 10)

        return {
          ...company,
          prospect_score: score,
          score_factors: factors,
          is_covenant_safe: true, // Would check covenants here if needed
        }
      })
    )

    // Sort by score
    results.sort((a, b) => b.prospect_score - a.prospect_score)
    setSearchResults(results)
  }

  const handleSaveProspect = async (companyNumber: string) => {
    if (!practiceId) {
      toast.error('Please log in to save prospects')
      return
    }

    const company = searchResults.find((c) => c.company_number === companyNumber)
    if (!company) return

    try {
      await saveProspect.mutateAsync({
        practice_id: practiceId,
        company_number: companyNumber,
        prospect_score: company.prospect_score,
        score_factors: company.score_factors,
        status: 'new',
        discovery_source: 'address_search',
        discovery_address: company.registered_office_address
          ? `${company.registered_office_address.address_line_1}, ${company.registered_office_address.postal_code}`
          : undefined,
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
    const companies: CompanyForEnrichment[] = companyNumbers
      .map((num) => {
        const result = searchResults.find((c) => c.company_number === num)
        if (!result || !result.registered_office_address) return null

        return {
          company_number: result.company_number,
          company_name: result.company_name,
          registered_address: result.registered_office_address,
          enrichment_status: result.enrichment_status,
        }
      })
      .filter((c) => c !== null) as CompanyForEnrichment[]

    setCompaniesToEnrich(companies)
    setEnrichmentModalOpen(true)
  }

  const handleSaveEnrichedProspects = async (companyNumbers: string[]) => {
    if (!practiceId) return

    for (const companyNumber of companyNumbers) {
      const company = searchResults.find((c) => c.company_number === companyNumber)
      if (!company) continue

      try {
        await saveProspect.mutateAsync({
          practice_id: practiceId,
          company_number: companyNumber,
          prospect_score: company.prospect_score,
          score_factors: company.score_factors,
          status: 'new',
          discovery_source: 'address_search',
          discovery_address: company.registered_office_address
            ? `${company.registered_office_address.address_line_1}, ${company.registered_office_address.postal_code}`
            : undefined,
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
        <h1 className="text-3xl font-bold">Address Search</h1>
        <p className="text-gray-600 mt-2">
          Search for companies by postcode or address to find potential clients
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border p-6 sticky top-4">
            <h2 className="text-xl font-semibold mb-4">Search</h2>
            <AddressSearchForm onResults={handleResults} onLoading={setIsLoading} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">
              Search Results {searchResults.length > 0 && `(${searchResults.length})`}
            </h2>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-gray-600">Searching for companies...</p>
              </div>
            ) : searchResults.length > 0 ? (
              <SearchResults
                results={searchResults}
                onSaveProspect={handleSaveProspect}
                onViewCompany={handleViewCompany}
                onEnrichCompanies={handleEnrichCompanies}
                practiceId={practiceId}
              />
            ) : (
              <div className="text-center py-12 text-gray-500">
                Enter a postcode or address above to search for companies
              </div>
            )}
          </div>
        </div>
      </div>

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
