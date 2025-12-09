import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useProspects, useUpdateProspect, useDeleteProspect } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { prospects } from '../services/prospects'
import type { ProspectStatus } from '../types'

export function ProspectsPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [selectedStatus, setSelectedStatus] = useState<ProspectStatus[]>([])

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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {prospectsList.map((prospect) => (
                  <tr key={prospect.id}>
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
    </div>
  )
}
