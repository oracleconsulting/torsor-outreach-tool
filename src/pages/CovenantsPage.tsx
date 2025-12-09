import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useCovenants, useCreateCovenant, useDeactivateCovenant } from '../hooks/useCovenants'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { NewCovenant } from '../types'

export function CovenantsPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState<Partial<NewCovenant>>({
    accounting_firm_number: '',
    accounting_firm_name: '',
    restriction_start_date: '',
    restriction_end_date: '',
    notes: '',
  })

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

  const { data: covenantsList, isLoading } = useCovenants(practiceId)
  const createCovenant = useCreateCovenant()
  const deactivateCovenant = useDeactivateCovenant()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!practiceId) return

    try {
      await createCovenant.mutateAsync({
        ...formData,
        practice_id: practiceId,
      } as NewCovenant)
      setShowForm(false)
      setFormData({
        accounting_firm_number: '',
        accounting_firm_name: '',
        restriction_start_date: '',
        restriction_end_date: '',
        notes: '',
      })
    } catch (error) {
      toast.error('Error creating covenant: ' + (error as Error).message)
    }
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate this covenant?')) return
    try {
      await deactivateCovenant.mutateAsync(id)
    } catch (error) {
      toast.error('Error deactivating covenant: ' + (error as Error).message)
    }
  }

  if (isLoading) {
    return <div className="text-center py-12">Loading covenants...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Covenant Restrictions</h1>
          <p className="text-gray-600 mt-2">Manage non-compete restrictions for accounting firms</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          {showForm ? 'Cancel' : 'Add Covenant'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Covenant</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firm Company Number
              </label>
              <input
                type="text"
                value={formData.accounting_firm_number}
                onChange={(e) => setFormData({ ...formData, accounting_firm_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Firm Name
              </label>
              <input
                type="text"
                value={formData.accounting_firm_name}
                onChange={(e) => setFormData({ ...formData, accounting_firm_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.restriction_start_date}
                  onChange={(e) => setFormData({ ...formData, restriction_start_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.restriction_end_date}
                  onChange={(e) => setFormData({ ...formData, restriction_end_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-md"
                rows={3}
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Create Covenant
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        {covenantsList && covenantsList.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Firm</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {covenantsList.map((covenant) => (
                  <tr key={covenant.id}>
                    <td className="px-4 py-4">
                      <div className="font-medium">{covenant.accounting_firm_name}</div>
                      <div className="text-sm text-gray-500">{covenant.accounting_firm_number}</div>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {new Date(covenant.restriction_start_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-sm">
                      {new Date(covenant.restriction_end_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          covenant.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {covenant.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {covenant.is_active && (
                        <button
                          onClick={() => handleDeactivate(covenant.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No covenants found. Add a covenant to track non-compete restrictions.
          </div>
        )}
      </div>
    </div>
  )
}
