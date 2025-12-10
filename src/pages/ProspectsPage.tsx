import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Search, CheckCircle } from 'lucide-react'
import { useProspects, useUpdateProspect, useDeleteProspect } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { prospects } from '../services/prospects'
import { BulkEnrichmentModal } from '../components/enrichment/BulkEnrichmentModal'
import { AddressStatusCell } from '../components/enrichment/AddressStatusCell'
import { FitScoreBadge } from '../components/fit/FitScoreBadge'
import { useFitScore } from '../hooks/useFitScore'
import type { ProspectStatus } from '../types'
import type { CompanyForEnrichment } from '../types/enrichment'

export function ProspectsPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [selectedStatus, setSelectedStatus] = useState<ProspectStatus[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [enrichmentModalOpen, setEnrichmentModalOpen] = useState(false)
  const [enrichmentOperation, setEnrichmentOperation] = useState<'find' | 'confirm'>('find')
  const [companiesToEnrich, setCompaniesToEnrich] = useState<CompanyForEnrichment[]>([])

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

  const { data: prospectsList, isLoading } = useProspects(practiceId, {
    status: selectedStatus.length > 0 ? selectedStatus : undefined,
  })
  const updateProspect = useUpdateProspect()
  const deleteProspect = useDeleteProspect()

  const handleExport = async () => {
    if (!practiceId) return
    try {
      const blob = await prospects.exportProspects(practiceId, {
        status: selectedStatus.length > 0 ? selectedStatus : undefined,
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prospects-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Error exporting prospects: ' + (error as Error).message)
    }
  }

  const handleStatusChange = async (id: string, newStatus: ProspectStatus) => {
    try {
      await updateProspect.mutateAsync({ id, updates: { status: newStatus } })
    } catch (error) {
      toast.error('Error updating prospect: ' + (error as Error).message)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prospect?')) return
    try {
      await deleteProspect.mutateAsync(id)
    } catch (error) {
      toast.error('Error deleting prospect: ' + (error as Error).message)
    }
  }

  const handleEnrichSelected = (operation: 'find' | 'confirm') => {
    if (selectedIds.size === 0) return

    const selectedProspects = prospectsList?.filter((p) => selectedIds.has(p.id)) || []
    const companies: CompanyForEnrichment[] = selectedProspects.map((p) => ({
      company_number: p.company_number,
      company_name: (p as any).companies?.company_name || p.company_number,
      registered_address: (p as any).companies?.registered_office_address,
      trading_address: p.enriched_address,
      enrichment_status: p.enrichment_status,
    }))

    setCompaniesToEnrich(companies)
    setEnrichmentOperation(operation)
    setEnrichmentModalOpen(true)
  }

  const handleUpdateProspects = async (results: Map<string, any>) => {
    if (!practiceId) return

    let updated = 0
    for (const [companyNumber, result] of results.entries()) {
      const prospect = prospectsList?.find((p) => p.company_number === companyNumber)
      if (!prospect) continue

      try {
        const updates: any = {}

        if (result.operation === 'find' && result.success) {
          updates.enrichment_status = 'found'
          updates.enriched_address = result.bestAddress
          updates.enrichment_confidence = result.confidence
          updates.enrichment_date = new Date().toISOString()
        } else if (result.operation === 'confirm') {
          if (result.confirmationResult === 'confirmed' || result.confirmationResult === 'likely_valid') {
            updates.address_confirmed = true
            updates.confirmation_date = new Date().toISOString()
            updates.enrichment_status = 'confirmed'
          } else if (result.confirmationResult === 'invalid') {
            updates.enrichment_status = 'invalid'
          }
        }

        if (Object.keys(updates).length > 0) {
          await updateProspect.mutateAsync({ id: prospect.id, updates })
          updated++
        }
      } catch (error) {
        console.error('Error updating prospect:', error)
      }
    }

    toast.success(`Updated ${updated} prospects`)
    setEnrichmentModalOpen(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading prospects...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Saved Prospects</h1>
          <p className="text-gray-600 mt-2">Manage your saved prospect companies</p>
        </div>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          Export CSV
        </button>
      </div>

      {/* Enrichment Stats */}
      {prospectsList && prospectsList.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{prospectsList.length}</p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Has Address</p>
            <p className="text-2xl font-bold text-green-600">
              {prospectsList.filter((p) => p.enrichment_status === 'confirmed' || p.enrichment_status === 'found').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">Needs Enrichment</p>
            <p className="text-2xl font-bold text-yellow-600">
              {prospectsList.filter((p) => !p.enrichment_status || p.enrichment_status === 'not_attempted' || p.enrichment_status === 'not_found').length}
            </p>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <p className="text-sm text-gray-500">No Address</p>
            <p className="text-2xl font-bold text-red-600">
              {prospectsList.filter((p) => p.enrichment_status === 'invalid').length}
            </p>
          </div>
        </div>
      )}

      {/* Bulk Actions */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center gap-4">
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-600">{selectedIds.size} selected</span>
          )}

          <button
            onClick={() => handleEnrichSelected('find')}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Search className="h-4 w-4" />
            Find Addresses
          </button>

          <button
            onClick={() => handleEnrichSelected('confirm')}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <CheckCircle className="h-4 w-4" />
            Confirm Addresses
          </button>

          <div className="flex-1" />

          {prospectsList && prospectsList.filter(
            (p) => !p.enrichment_status || p.enrichment_status === 'not_attempted' || p.enrichment_status === 'not_found'
          ).length > 0 && (
            <button
              onClick={() => {
                const needsEnrichment = prospectsList
                  .filter((p) => !p.enrichment_status || p.enrichment_status === 'not_attempted' || p.enrichment_status === 'not_found')
                  .map((p) => ({
                    company_number: p.company_number,
                    company_name: (p as any).companies?.company_name || p.company_number,
                    registered_address: (p as any).companies?.registered_office_address,
                    trading_address: p.enriched_address,
                    enrichment_status: p.enrichment_status,
                  }))
                  .filter((c): c is CompanyForEnrichment => c !== null && !!c.registered_address)
                setCompaniesToEnrich(needsEnrichment)
                setEnrichmentOperation('find')
                setEnrichmentModalOpen(true)
              }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <Search className="h-4 w-4" />
              Enrich All Needing ({prospectsList.filter(
                (p) => !p.enrichment_status || p.enrichment_status === 'not_attempted' || p.enrichment_status === 'not_found'
              ).length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex gap-2 mb-4">
          {(['new', 'researched', 'contacted', 'responded', 'converted', 'rejected'] as ProspectStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => {
                setSelectedStatus((prev) =>
                  prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
                )
              }}
              className={`px-3 py-1 text-sm rounded-md ${
                selectedStatus.includes(status)
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {prospectsList && prospectsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === prospectsList.length && prospectsList.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(new Set(prospectsList.map((p) => p.id)))
                        } else {
                          setSelectedIds(new Set())
                        }
                      }}
                      className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fit Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prospectsList.map((prospect) => (
                  <tr key={prospect.id}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(prospect.id)}
                        onChange={() => toggleSelect(prospect.id)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium">{prospect.company_number}</div>
                      <div className="text-sm text-gray-500">{(prospect as any).companies?.company_name}</div>
                    </td>
                    <td className="px-4 py-4">{prospect.prospect_score}/10</td>
                    <td className="px-4 py-4">
                      <select
                        value={prospect.status}
                        onChange={(e) => handleStatusChange(prospect.id, e.target.value as ProspectStatus)}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="new">New</option>
                        <option value="researched">Researched</option>
                        <option value="contacted">Contacted</option>
                        <option value="responded">Responded</option>
                        <option value="converted">Converted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <AddressStatusCell
                        result={{
                          ...prospect,
                          company_name: (prospect as any).companies?.company_name || prospect.company_number,
                          registered_office_address: (prospect as any).companies?.registered_office_address,
                        } as any}
                      />
                    </td>
                    <td className="px-4 py-4">
                      {practiceId && (
                        <FitScoreCell companyNumber={prospect.company_number} practiceId={practiceId} />
                      )}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">{prospect.discovery_source}</td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {new Date(prospect.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleDelete(prospect.id)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No prospects found. Start a search to discover potential clients.
          </div>
        )}
      </div>

      {enrichmentModalOpen && (
        <BulkEnrichmentModal
          isOpen={enrichmentModalOpen}
          onClose={() => {
            setEnrichmentModalOpen(false)
            setCompaniesToEnrich([])
          }}
          companies={companiesToEnrich}
          operation={enrichmentOperation}
          source="prospects"
          onUpdateProspects={handleUpdateProspects}
        />
      )}
    </div>
  )
}

function FitScoreCell({ companyNumber, practiceId }: { companyNumber: string; practiceId: string }) {
  const { data: fitScore } = useFitScore(practiceId, companyNumber)
  return <FitScoreBadge score={fitScore} />
}
