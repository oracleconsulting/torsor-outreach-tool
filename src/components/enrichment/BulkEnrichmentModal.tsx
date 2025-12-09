import { useState, useEffect } from 'react'
import { X, Search, Shield, Download, Save, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useBulkEnrichment } from '../../hooks/useEnrichment'
import type {
  CompanyForEnrichment,
  EnrichmentResult,
  EnrichmentOperation,
  FindEnrichmentResult,
  ConfirmEnrichmentResult,
} from '../../types/enrichment'

interface BulkEnrichmentModalProps {
  isOpen: boolean
  onClose: () => void
  companies: CompanyForEnrichment[]
  operation: EnrichmentOperation
  source: 'search_results' | 'prospects' | 'csv'
  onSaveProspects?: (companyNumbers: string[]) => void
  onUpdateProspects?: (results: Map<string, EnrichmentResult>) => void
}

export function BulkEnrichmentModal({
  isOpen,
  onClose,
  companies,
  operation,
  source,
  onSaveProspects,
  onUpdateProspects,
}: BulkEnrichmentModalProps) {
  const [results, setResults] = useState<Map<string, EnrichmentResult>>(new Map())
  const [progress, setProgress] = useState({ current: 0, total: companies.length })
  const bulkEnrichment = useBulkEnrichment()

  useEffect(() => {
    if (!isOpen) {
      setResults(new Map())
      setProgress({ current: 0, total: companies.length })
    }
  }, [isOpen, companies.length])

  const handleStart = async () => {
    setResults(new Map())
    setProgress({ current: 0, total: companies.length })

    try {
      const enrichmentResults = await bulkEnrichment.mutateAsync({
        companies,
        operation,
        onProgress: (current, total) => setProgress({ current, total }),
      })

      setResults(enrichmentResults)
    } catch (error) {
      console.error('Bulk enrichment error:', error)
    }
  }

  const handleSaveProspects = () => {
    const successful = Array.from(results.entries())
      .filter(([_, result]) => result.success)
      .map(([companyNumber]) => companyNumber)

    onSaveProspects?.(successful)
    onClose()
  }

  const handleUpdateProspects = () => {
    onUpdateProspects?.(results)
    onClose()
  }

  const handleExport = () => {
    const csvRows = [
      ['Company Number', 'Company Name', 'Operation', 'Success', 'Address', 'Confidence', 'Notes'],
    ]

    companies.forEach((company) => {
      const result = results.get(company.company_number)
      if (result) {
        if (result.operation === 'find') {
          const findResult = result as FindEnrichmentResult
          const address = findResult.bestAddress
            ? `${findResult.bestAddress.line1}, ${findResult.bestAddress.town}, ${findResult.bestAddress.postcode}`
            : 'Not found'
          csvRows.push([
            company.company_number,
            company.company_name,
            'Find',
            findResult.success ? 'Yes' : 'No',
            address,
            findResult.confidence.toString(),
            findResult.notes || '',
          ])
        } else {
          const confirmResult = result as ConfirmEnrichmentResult
          csvRows.push([
            company.company_number,
            company.company_name,
            'Confirm',
            confirmResult.success ? 'Yes' : 'No',
            confirmResult.confirmationResult,
            confirmResult.confidence.toString(),
            confirmResult.notes || '',
          ])
        }
      }
    })

    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `enrichment-results-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  const title = operation === 'find' ? 'Find Contact Addresses' : 'Confirm Existing Addresses'
  const description =
    operation === 'find'
      ? `Search for verified contact addresses for ${companies.length} companies`
      : `Verify existing addresses are real and current for ${companies.length} companies`

  const successfulCount = Array.from(results.values()).filter((r) => r.success).length
  const avgConfidence =
    results.size > 0
      ? Math.round(
          Array.from(results.values()).reduce((sum, r) => sum + (r.confidence || 0), 0) / results.size
        )
      : 0

  const isRunning = bulkEnrichment.isPending
  const isComplete = results.size > 0 && !isRunning

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-3">
              {operation === 'find' ? (
                <Search className="h-6 w-6 text-primary" />
              ) : (
                <Shield className="h-6 w-6 text-primary" />
              )}
              <div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-sm text-gray-500">{description}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Progress */}
          {isRunning && (
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Processing companies...</span>
                  <span className="font-medium">
                    {progress.current} of {progress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(progress.current / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          {isComplete && (
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Processed</p>
                  <p className="text-2xl font-bold">{results.size}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {operation === 'find' ? 'Found' : 'Confirmed'}
                  </p>
                  <p className="text-2xl font-bold text-green-600">{successfulCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">
                    {operation === 'find' ? 'Not Found' : 'Invalid'}
                  </p>
                  <p className="text-2xl font-bold text-red-600">{results.size - successfulCount}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Avg Confidence</p>
                  <p className="text-2xl font-bold">{avgConfidence}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
            {isComplete && results.size > 0 ? (
              <div className="space-y-3">
                {companies.map((company) => {
                  const result = results.get(company.company_number)
                  if (!result) return null

                  return (
                    <div key={company.company_number} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{company.company_name}</h3>
                            <span className="text-xs text-gray-500">{company.company_number}</span>
                            {result.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500" />
                            )}
                          </div>

                          {result.operation === 'find' && (
                            <FindResultDisplay result={result as FindEnrichmentResult} />
                          )}

                          {result.operation === 'confirm' && (
                            <ConfirmResultDisplay result={result as ConfirmEnrichmentResult} />
                          )}

                          {result.notes && (
                            <p className="text-sm text-gray-600 mt-2">{result.notes}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{result.confidence}%</span>
                          <p className="text-xs text-gray-500">confidence</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : !isRunning ? (
              <div className="text-center py-12 text-gray-500">
                Click "Start" to begin {operation === 'find' ? 'finding' : 'confirming'} addresses
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
            <button
              onClick={handleExport}
              disabled={!isComplete}
              className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Export Results
            </button>

            <div className="flex gap-3">
              {!isRunning && results.size === 0 && (
                <button
                  onClick={handleStart}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  {operation === 'find' ? (
                    <>
                      <Search className="h-4 w-4 inline mr-2" />
                      Start Finding Addresses
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 inline mr-2" />
                      Start Confirming Addresses
                    </>
                  )}
                </button>
              )}

              {source === 'search_results' && isComplete && (
                <button
                  onClick={handleSaveProspects}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 inline mr-2" />
                  Save to Prospects ({successfulCount})
                </button>
              )}

              {source === 'prospects' && isComplete && (
                <button
                  onClick={handleUpdateProspects}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  <RefreshCw className="h-4 w-4 inline mr-2" />
                  Update Prospects
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FindResultDisplay({ result }: { result: FindEnrichmentResult }) {
  if (!result.success || !result.bestAddress) {
    return <p className="text-sm text-red-600">No address found</p>
  }

  const addr = result.bestAddress
  return (
    <div>
      <p className="text-sm font-medium text-gray-900">
        {addr.line1}
        {addr.line2 && `, ${addr.line2}`}
      </p>
      <p className="text-sm text-gray-600">
        {addr.town}, {addr.postcode}
      </p>
      <p className="text-xs text-gray-500 mt-1">Source: {addr.source}</p>
    </div>
  )
}

function ConfirmResultDisplay({ result }: { result: ConfirmEnrichmentResult }) {
  const getResultColor = () => {
    switch (result.confirmationResult) {
      case 'confirmed':
        return 'text-green-600'
      case 'likely_valid':
        return 'text-blue-600'
      case 'suspicious':
        return 'text-yellow-600'
      case 'invalid':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getResultIcon = () => {
    switch (result.confirmationResult) {
      case 'confirmed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'likely_valid':
        return <AlertCircle className="h-4 w-4 text-blue-500" />
      case 'suspicious':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'invalid':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {getResultIcon()}
        <span className={`text-sm font-medium ${getResultColor()}`}>
          {result.confirmationResult.charAt(0).toUpperCase() + result.confirmationResult.slice(1).replace('_', ' ')}
        </span>
      </div>

      <div className="text-xs text-gray-600 space-y-1">
        {result.confirmationDetails.foundOnWebsite && (
          <p>✓ Found on website</p>
        )}
        {result.confirmationDetails.foundOnGoogleMaps && (
          <p>✓ Found on Google Maps</p>
        )}
        {result.confirmationDetails.isVirtualOffice && (
          <p className="text-yellow-600">⚠ Virtual office detected</p>
        )}
        {result.confirmationDetails.isOutdated && (
          <p className="text-red-600">✗ Address may be outdated</p>
        )}
        {result.confirmationDetails.alternativeAddress && (
          <p className="text-blue-600">
            Alternative: {result.confirmationDetails.alternativeAddress.line1}, {result.confirmationDetails.alternativeAddress.postcode}
          </p>
        )}
      </div>
    </div>
  )
}

