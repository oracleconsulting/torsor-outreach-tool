import { useState, useEffect } from 'react'
import { X, Building2, Calendar, MapPin, FileText, Users, ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useCompany, useCompanyOfficers, useCompanyFilings } from '../../hooks/useCompaniesHouse'
import { useAddToWatchlist, useRemoveFromWatchlist, useWatchlist } from '../../hooks/useWatchlist'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'

interface CompanyModalProps {
  companyNumber: string
  isOpen: boolean
  onClose: () => void
  onSaveProspect?: () => void
}

export function CompanyModal({ companyNumber, isOpen, onClose, onSaveProspect }: CompanyModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'officers' | 'filings'>('overview')
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  
  const { data: company, isLoading: companyLoading } = useCompany(companyNumber)
  const { data: officers, isLoading: officersLoading } = useCompanyOfficers(companyNumber, false)
  const { data: filings, isLoading: filingsLoading } = useCompanyFilings(companyNumber, 10)
  const { data: watchlist } = useWatchlist(practiceId)
  const addToWatchlist = useAddToWatchlist()
  const removeFromWatchlist = useRemoveFromWatchlist()
  const buildNetwork = useBuildNetwork()

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

  const isWatched = watchlist?.some((w) => w.company_number === companyNumber) || false

  const handleToggleWatch = async () => {
    if (!practiceId) {
      toast.error('Please log in to watch companies')
      return
    }

    try {
      if (isWatched) {
        await removeFromWatchlist.mutateAsync({ practiceId, companyNumber })
        toast.success('Removed from watchlist')
      } else {
        await addToWatchlist.mutateAsync({ practiceId, companyNumber })
        toast.success('Added to watchlist')
      }
    } catch (error: any) {
      toast.error('Error updating watchlist: ' + error.message)
    }
  }

  const handleBuildNetwork = async () => {
    if (!practiceId) {
      toast.error('Please log in to build networks')
      return
    }

    try {
      await buildNetwork.mutateAsync({ practiceId, companyNumber })
      toast.success('Network built successfully! Check the Network page for opportunities.')
    } catch (error: any) {
      toast.error('Error building network: ' + error.message)
    }
  }

  if (!isOpen) return null

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatAddress = (address: any) => {
    if (!address) return 'N/A'
    const parts = [
      address.premises,
      address.address_line_1,
      address.address_line_2,
      address.locality,
      address.region,
      address.postal_code,
      address.country,
    ].filter(Boolean)
    return parts.join(', ')
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-6 w-6 text-primary" />
              <div>
                <h2 className="text-xl font-semibold">
                  {companyLoading ? 'Loading...' : company?.company_name || 'Company Details'}
                </h2>
                <p className="text-sm text-gray-500">{companyNumber}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('officers')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'officers'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Officers
              </button>
              <button
                onClick={() => setActiveTab('filings')}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'filings'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Filings
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
            {companyLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-4 text-gray-600">Loading company details...</p>
              </div>
            ) : !company ? (
              <div className="text-center py-12 text-gray-500">
                Company not found
              </div>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Company Status</p>
                          <p className="font-medium">{company.company_status || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Company Type</p>
                          <p className="font-medium">{company.company_type || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Incorporation Date</p>
                          <p className="font-medium">{formatDate(company.incorporation_date)}</p>
                        </div>
                        {company.dissolution_date && (
                          <div>
                            <p className="text-sm text-gray-500">Dissolution Date</p>
                            <p className="font-medium">{formatDate(company.dissolution_date)}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Registered Office Address
                      </h3>
                      <p className="text-gray-700">{formatAddress(company.registered_office_address)}</p>
                    </div>

                    {/* SIC Codes */}
                    {company.sic_codes && company.sic_codes.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">SIC Codes</h3>
                        <div className="flex flex-wrap gap-2">
                          {company.sic_codes.map((code, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                            >
                              {code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Accounts */}
                    {company.accounts && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Accounts Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {company.accounts.last_accounts?.made_up_to && (
                            <div>
                              <p className="text-sm text-gray-500">Last Accounts</p>
                              <p className="font-medium">
                                {formatDate(company.accounts.last_accounts.made_up_to)}
                              </p>
                            </div>
                          )}
                          {company.accounts.next_due && (
                            <div>
                              <p className="text-sm text-gray-500">Next Accounts Due</p>
                              <p className="font-medium">{formatDate(company.accounts.next_due)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Flags */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
                      <div className="space-y-2">
                        {company.has_charges && (
                          <p className="text-sm text-amber-600">⚠️ Company has charges</p>
                        )}
                        {company.has_insolvency_history && (
                          <p className="text-sm text-red-600">⚠️ Company has insolvency history</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'officers' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Officers
                    </h3>
                    {officersLoading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : !officers || officers.length === 0 ? (
                      <p className="text-gray-500">No officers found</p>
                    ) : (
                      <div className="space-y-4">
                        {officers.map((officer, index) => (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{officer.name}</p>
                                <p className="text-sm text-gray-500 mt-1">{officer.officer_role}</p>
                                {officer.occupation && (
                                  <p className="text-sm text-gray-600 mt-1">Occupation: {officer.occupation}</p>
                                )}
                              </div>
                              <div className="text-right text-sm text-gray-500">
                                {officer.appointed_on && (
                                  <p>Appointed: {formatDate(officer.appointed_on)}</p>
                                )}
                                {officer.resigned_on && (
                                  <p className="text-red-600">Resigned: {formatDate(officer.resigned_on)}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'filings' && (
                  <div>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Filings
                    </h3>
                    {filingsLoading ? (
                      <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    ) : !filings || filings.length === 0 ? (
                      <p className="text-gray-500">No filings found</p>
                    ) : (
                      <div className="space-y-3">
                        {filings.map((filing) => (
                          <div key={filing.transaction_id} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="font-medium">{filing.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-4 w-4" />
                                    {formatDate(filing.filing_date)}
                                  </span>
                                  {filing.category && (
                                    <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                      {filing.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href={`https://find-and-update.company-information.service.gov.uk/company/${companyNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                View on Companies House
              </a>
              {practiceId && (
                <>
                  <button
                    onClick={handleToggleWatch}
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                    disabled={addToWatchlist.isPending || removeFromWatchlist.isPending}
                  >
                    {isWatched ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Remove from Watchlist
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Add to Watchlist
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleBuildNetwork}
                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                    disabled={buildNetwork.isPending}
                  >
                    {buildNetwork.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Building...
                      </>
                    ) : (
                      <>
                        <Network className="h-4 w-4" />
                        Build Network
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
              {onSaveProspect && (
                <button
                  onClick={onSaveProspect}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  Save as Prospect
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

