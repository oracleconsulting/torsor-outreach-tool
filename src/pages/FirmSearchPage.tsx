import { useState, useEffect } from 'react'
import { FirmSearchForm } from '../components/search/FirmSearchForm'
import { SearchResults } from '../components/search/SearchResults'
import { useFirmDiscovery } from '../hooks/useCompaniesHouse'
import { useSaveProspect } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { FirmDiscoveryResult, SearchResult } from '../types'

export function FirmSearchPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [discoveryResults, setDiscoveryResults] = useState<FirmDiscoveryResult | null>(null)
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
      alert('Prospect saved successfully!')
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        alert('This prospect has already been saved.')
      } else {
        alert('Error saving prospect: ' + error.message)
      }
    }
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
          />
        </div>
      )}

      {firmDiscovery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error: {firmDiscovery.error?.message || 'Failed to discover firm clients'}
        </div>
      )}
    </div>
  )
}
