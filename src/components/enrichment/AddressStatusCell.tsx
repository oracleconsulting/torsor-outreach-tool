import { CheckCircle2, AlertCircle, XCircle, HelpCircle, Search } from 'lucide-react'
import type { SearchResult } from '../../types'

interface AddressStatusCellProps {
  result: SearchResult
  onEnrich?: () => void
}

export function AddressStatusCell({ result, onEnrich }: AddressStatusCellProps) {
  // Determine address quality
  const hasTradingAddress = result.has_trading_address ?? false
  const addressQuality = result.address_quality || 'unknown'
  const enrichmentStatus = result.enrichment_status || 'not_attempted'

  // If enrichment found an address
  if (enrichmentStatus === 'found' || enrichmentStatus === 'confirmed') {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-700">Address found</span>
        {result.enrichment_confidence && (
          <span className="text-xs text-gray-500">({result.enrichment_confidence}%)</span>
        )}
      </div>
    )
  }

  // If has trading address and it's good quality
  if (hasTradingAddress && addressQuality === 'excellent') {
    return (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm text-green-700">Has trading address</span>
      </div>
    )
  }

  // If needs enrichment
  if (addressQuality === 'needs_enrichment' || enrichmentStatus === 'not_attempted') {
    return (
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-yellow-500" />
        <span className="text-sm text-yellow-700">Needs enrichment</span>
        {onEnrich && (
          <button
            onClick={onEnrich}
            className="ml-2 p-1 text-primary hover:bg-primary/10 rounded"
            title="Find address"
          >
            <Search className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  // If enrichment attempted but not found
  if (enrichmentStatus === 'not_found') {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-700">No address found</span>
      </div>
    )
  }

  // If invalid
  if (enrichmentStatus === 'invalid') {
    return (
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-700">Invalid address</span>
      </div>
    )
  }

  // Unknown/default
  return (
    <div className="flex items-center gap-2">
      <HelpCircle className="h-4 w-4 text-gray-400" />
      <span className="text-sm text-gray-500">Unknown</span>
    </div>
  )
}

