import { useState } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { useFirmDiscovery } from '../../hooks/useCompaniesHouse'
import type { FirmDiscoveryParams } from '../../types'

interface FirmSearchFormProps {
  practiceId?: string
  onResults?: (results: any) => void
}

export function FirmSearchForm({ practiceId, onResults }: FirmSearchFormProps) {
  const [firmNumber, setFirmNumber] = useState('')
  const [includeCovenantCheck, setIncludeCovenantCheck] = useState(false)
  const [covenantStartDate, setCovenantStartDate] = useState('')
  const [covenantEndDate, setCovenantEndDate] = useState('')

  const firmDiscovery = useFirmDiscovery()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!firmNumber.trim()) return

    const params: FirmDiscoveryParams = {
      firmNumber: firmNumber.trim(),
      practiceId,
    }

    if (includeCovenantCheck && covenantStartDate && covenantEndDate) {
      params.covenantStartDate = covenantStartDate
      params.covenantEndDate = covenantEndDate
    }

    try {
      const result = await firmDiscovery.mutateAsync(params)
      onResults?.(result)
    } catch (error) {
      console.error('Firm discovery error:', error)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="firmNumber" className="block text-sm font-medium text-gray-700 mb-1">
          Accounting Firm Company Number
        </label>
        <input
          id="firmNumber"
          type="text"
          value={firmNumber}
          onChange={(e) => setFirmNumber(e.target.value)}
          placeholder="e.g., 12345678"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          Enter the Companies House company number of the accounting firm
        </p>
      </div>

      <div className="flex items-center">
        <input
          id="covenantCheck"
          type="checkbox"
          checked={includeCovenantCheck}
          onChange={(e) => setIncludeCovenantCheck(e.target.checked)}
          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
        />
        <label htmlFor="covenantCheck" className="ml-2 block text-sm text-gray-700">
          Include covenant check
        </label>
      </div>

      {includeCovenantCheck && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="covenantStart" className="block text-sm font-medium text-gray-700 mb-1">
              Restriction Start Date
            </label>
            <input
              id="covenantStart"
              type="date"
              value={covenantStartDate}
              onChange={(e) => setCovenantStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label htmlFor="covenantEnd" className="block text-sm font-medium text-gray-700 mb-1">
              Restriction End Date
            </label>
            <input
              id="covenantEnd"
              type="date"
              value={covenantEndDate}
              onChange={(e) => setCovenantEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={firmDiscovery.isPending}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {firmDiscovery.isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Discover Firm Clients
          </>
        )}
      </button>
    </form>
  )
}

