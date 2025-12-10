import { useState, useEffect } from 'react'
import { useNetworkOpportunities, useBuildNetwork } from '../hooks/useDirectorNetwork'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Building2, Users, TrendingUp, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from '@tanstack/react-router'

export function NetworkPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()

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

  const { data: opportunities, isLoading } = useNetworkOpportunities(practiceId)

  // Get unique source clients
  const sourceClients = opportunities
    ? [...new Set(opportunities.map((o) => o.source_client))]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Director Network Opportunities</h1>
        <p className="text-gray-600 mt-2">
          Companies connected to your existing clients through shared directors
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-gray-600">Loading network opportunities...</p>
        </div>
      ) : !opportunities || opportunities.length === 0 ? (
        <div className="bg-white rounded-lg border p-8 text-center">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Network Opportunities Yet</h3>
          <p className="text-gray-600 mb-4">
            Build networks by adding your existing clients. The system will discover companies
            connected through shared directors.
          </p>
          <p className="text-sm text-gray-500">
            To build a network, go to a client company and use the "Build Network" action.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Opportunities</p>
                  <p className="text-2xl font-bold">{opportunities.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Building2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Source Clients</p>
                  <p className="text-2xl font-bold">{sourceClients.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Direct Connections</p>
                  <p className="text-2xl font-bold">
                    {opportunities.filter((o) => o.connection_strength === 'direct').length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Opportunities Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Warm Introduction Opportunities</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Opportunity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Connected Via
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Your Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Sector
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {opportunities.map((opp) => (
                    <tr key={opp.company_number} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium">{opp.company_name}</div>
                        <div className="text-sm text-gray-500">{opp.company_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {opp.connection_path.map((name, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {opp.connection_strength === 'direct' ? 'Direct' : 'Shared Director'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to="/firm-search"
                          search={{ firmNumber: opp.source_client }}
                          className="text-primary hover:underline text-sm"
                        >
                          {opp.source_client_name || opp.source_client}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{opp.sector || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link
                            to="/firm-search"
                            search={{ firmNumber: opp.company_number }}
                            className="text-sm text-primary hover:underline"
                          >
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}



