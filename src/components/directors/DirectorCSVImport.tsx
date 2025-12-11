import { useState, useEffect } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { directorImport, type ImportResult, type ConfirmationDetail } from '../../services/director-import'
import toast from 'react-hot-toast'

interface DirectorCSVImportProps {
  practiceId: string
  onImportComplete?: (result: ImportResult) => void
}

const STORAGE_KEY = 'director-import-results'

export function DirectorCSVImport({ practiceId, onImportComplete }: DirectorCSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  // Load saved results from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY}-${practiceId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Only restore if it's recent (within last 24 hours)
        if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setResult(parsed.result)
          console.log('Restored import results from localStorage:', parsed.result)
        } else {
          // Clear old results
          localStorage.removeItem(`${STORAGE_KEY}-${practiceId}`)
        }
      }
    } catch (error) {
      console.error('Failed to load saved results:', error)
    }
  }, [practiceId])

  // Save results to localStorage whenever they change
  useEffect(() => {
    if (result) {
      try {
        localStorage.setItem(`${STORAGE_KEY}-${practiceId}`, JSON.stringify({
          result,
          timestamp: Date.now(),
        }))
        console.log('Saved import results to localStorage')
      } catch (error) {
        console.error('Failed to save results:', error)
      }
    }
  }, [result, practiceId])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setFile(selectedFile)
      // Don't clear result when selecting a new file - let user see previous results
      // setResult(null)
    }
  }

  const clearResults = () => {
    setResult(null)
    try {
      localStorage.removeItem(`${STORAGE_KEY}-${practiceId}`)
      toast.success('Results cleared')
    } catch (error) {
      console.error('Failed to clear results:', error)
    }
  } // Force rebuild

  const [confirmAddresses, setConfirmAddresses] = useState(false) // Default to false for faster imports
  const [findMissingAddresses, setFindMissingAddresses] = useState(false) // Find addresses when missing from CSV
  const [enrichContacts, setEnrichContacts] = useState(false) // Enrich director contact details with Apollo
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file first')
      return
    }

    setIsImporting(true)
    setProgress({ current: 0, total: 0 })
    try {
      const importResult = await directorImport.importFromCSV(file, practiceId, {
        confirmAddresses,
        findMissingAddresses,
        enrichContacts,
        onProgress: (current, total) => {
          setProgress({ current, total })
        },
      })
      console.log('Setting result in component:', importResult)
      // Create a new object reference to ensure React detects the change
      const newResult = { ...importResult }
      console.log('About to call setResult with:', newResult)
      setResult(newResult)
      setProgress(null)
      // Force a re-render check
      setTimeout(() => {
        console.log('After setResult, checking state...')
      }, 100)
      
      if (importResult.total === 0) {
        toast.error('No rows found in CSV file. Please check the file format.')
      } else if (importResult.errors.length === 0 && importResult.warnings.length === 0) {
        toast.success(
          `Successfully imported ${importResult.updated} director addresses (${importResult.created} created)`
        )
      } else if (importResult.updated > 0 || importResult.created > 0) {
        toast.success(
          `Imported ${importResult.updated + importResult.created} addresses, but ${importResult.errors.length} errors and ${importResult.warnings.length} warnings`
        )
      } else {
        toast.error(
          `Import completed but no directors were updated or created. ${importResult.errors.length} errors, ${importResult.warnings.length} warnings. Check the results below.`
        )
      }
      
      onImportComplete?.(importResult)
    } catch (error) {
      toast.error(`Import failed: ${(error as Error).message}`)
      setProgress(null)
    } finally {
      setIsImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = `name,officer_id,company_number,trading_address_line_1,trading_address_line_2,trading_locality,trading_region,trading_postal_code,trading_country,contact_address_line_1,contact_address_line_2,contact_locality,contact_region,contact_postal_code,contact_country,email,phone,linkedin_url,preferred_contact_method
John Smith,ABC123,12345678,123 Business Street,,London,Greater London,SW1A 1AA,United Kingdom,123 Business Street,,London,Greater London,SW1A 1AA,United Kingdom,john.smith@example.com,02071234567,https://linkedin.com/in/johnsmith,email
Jane Doe,,87654321,456 High Street,Suite 2,Manchester,Greater Manchester,M1 1AA,United Kingdom,456 High Street,Suite 2,Manchester,Greater Manchester,M1 1AA,United Kingdom,jane.doe@example.com,01612345678,,phone`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'director_addresses_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Debug: Log when component renders
  console.log('DirectorCSVImport rendering, result:', result)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Import Director Addresses</h3>
        <p className="text-sm text-gray-600">
          Upload a CSV file to update director trading and contact addresses. Directors will be matched by name, officer_id, or company_number.
        </p>
      </div>

      {/* Template Download */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <FileText className="h-5 w-5 text-blue-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900">Need a template?</p>
          <p className="text-xs text-blue-700">Download our CSV template with example data and column headers</p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
        >
          <Download className="h-4 w-4" />
          Download Template
        </button>
      </div>

      {/* File Upload */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Upload className="h-12 w-12 text-gray-400" />
          <div className="text-center">
            <label htmlFor="csv-upload" className="cursor-pointer">
              <span className="text-sm font-medium text-primary hover:text-primary/80">
                Click to upload CSV file
              </span>
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isImporting}
              />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              CSV files only, max 10MB
            </p>
          </div>
          {file && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <FileText className="h-4 w-4" />
              <span>{file.name}</span>
              <span className="text-gray-400">
                ({(file.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      {file && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border">
            <input
              type="checkbox"
              id="find-missing-addresses"
              checked={findMissingAddresses}
              onChange={(e) => setFindMissingAddresses(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="find-missing-addresses" className="text-sm cursor-pointer">
              <span className="font-medium">Find missing addresses with AI</span>
              <span className="text-gray-600 block text-xs mt-1">
                Use Perplexity AI to discover trading/contact addresses when they're not in your CSV. Requires company name and company number.
                <strong className="text-orange-600"> Note: This will significantly slow down the import (2-3 seconds per row with missing addresses).</strong>
              </span>
            </label>
          </div>
          
          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border">
            <input
              type="checkbox"
              id="confirm-addresses"
              checked={confirmAddresses}
              onChange={(e) => setConfirmAddresses(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="confirm-addresses" className="text-sm cursor-pointer">
              <span className="font-medium">Confirm existing addresses with Apollo</span>
              <span className="text-gray-600 block text-xs mt-1">
                Use Apollo.io to verify and correct director contact addresses that are already in your CSV (not registered office addresses).
                <strong className="text-orange-600"> Note: This will slow down the import (~600ms per row).</strong>
              </span>
            </label>
          </div>
          
          <div className="flex items-center gap-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <input
              type="checkbox"
              id="enrich-contacts"
              checked={enrichContacts}
              onChange={(e) => setEnrichContacts(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="enrich-contacts" className="text-sm cursor-pointer">
              <span className="font-medium">Enrich director contact details with Apollo</span>
              <span className="text-gray-600 block text-xs mt-1">
                Use Apollo.io to find director email addresses, phone numbers, LinkedIn profiles, and contact addresses.
                <strong className="text-blue-600"> Recommended: This adds verified contact information for outreach.</strong>
                <strong className="text-orange-600"> Note: This will slow down the import (~600ms per row).</strong>
              </span>
            </label>
          </div>
          
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting}
            className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress ? (
                  <>
                    Processing {progress.current} of {progress.total} rows
                    {enrichContacts ? ' (enriching contacts...)' : findMissingAddresses ? ' (finding addresses...)' : confirmAddresses ? ' (confirming addresses...)' : ''}
                  </>
                ) : (
                  <>
                    Importing{confirmAddresses ? ' and confirming addresses' : ''}...
                  </>
                )}
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Import Director Addresses
              </>
            )}
          </button>

          {progress && progress.total > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Results - Debug: Always show if result exists */}
      {result ? (
        <div className="space-y-4 mt-6 border-t-2 border-gray-300 pt-6 bg-white rounded-lg p-6 shadow-md" style={{ display: 'block' }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xl font-bold text-gray-900">✅ Import Results</h4>
              <div className="text-sm text-gray-600 mt-1">
                Results are saved and will persist after page refresh
              </div>
            </div>
            <button
              onClick={clearResults}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700"
            >
              Clear Results
            </button>
          </div>
          <div className="text-sm text-gray-600 mb-4">
            Import completed at {new Date().toLocaleTimeString()}
          </div>
          <div className={`grid gap-4 ${result.confirmed > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold">{result.total}</div>
              <div className="text-sm text-gray-600">Total Rows</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{result.matched}</div>
              <div className="text-sm text-gray-600">Matched</div>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{result.updated}</div>
              <div className="text-sm text-gray-600">Updated</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{result.created}</div>
              <div className="text-sm text-gray-600">Created</div>
            </div>
            {result.confirmed > 0 && (
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{result.confirmed}</div>
                <div className="text-sm text-gray-600">AI Confirmed</div>
              </div>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-yellow-600" />
                <h4 className="font-semibold text-yellow-900">
                  {result.warnings.length} Warning{result.warnings.length !== 1 ? 's' : ''}
                </h4>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.warnings.map((warning, idx) => (
                  <div key={idx} className="text-sm text-yellow-800 bg-white p-2 rounded">
                    <div className="font-medium">Row {warning.row}: {warning.warning}</div>
                    {warning.data.dir_full_name && (
                      <div className="text-xs text-gray-600 mt-1">
                        Director: {warning.data.dir_full_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <h4 className="font-semibold text-red-900">
                  {result.errors.length} Error{result.errors.length !== 1 ? 's' : ''}
                </h4>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {result.errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-800 bg-white p-2 rounded">
                    <div className="font-medium">Row {error.row}: {error.error}</div>
                    {error.data.dir_full_name && (
                      <div className="text-xs text-gray-600 mt-1">
                        Director: {error.data.dir_full_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.errors.length === 0 && (
            <div className="flex items-center gap-2 p-4 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">
                All rows imported successfully!
              </span>
            </div>
          )}

          {/* Address Confirmation Details */}
          {result.confirmations && result.confirmations.length > 0 && (
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <h4 className="font-semibold text-blue-900">
                  Address Confirmation Details ({result.confirmations.filter((c: ConfirmationDetail) => c.confirmed).length} confirmed, {result.confirmations.filter((c: ConfirmationDetail) => !c.confirmed && c.confirmation_method === 'failed').length} failed, {result.confirmations.filter((c: ConfirmationDetail) => c.confirmation_method === 'csv_import').length} from CSV)
                </h4>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {result.confirmations.map((conf: ConfirmationDetail, idx: number) => (
                  <div key={idx} className={`text-sm bg-white p-3 rounded border ${conf.confirmed ? 'border-green-300' : conf.confirmation_method === 'failed' ? 'border-red-300' : 'border-gray-300'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          Row {conf.row}: {conf.director_name}
                          {conf.company_name && (
                            <span className="text-gray-600 font-normal"> ({conf.company_name})</span>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {conf.original_address && (
                            <div className="text-xs">
                              <span className="font-medium text-gray-700">Original:</span>{' '}
                              <span className="text-gray-600">{conf.original_address}</span>
                            </div>
                          )}
                          {conf.confirmed && conf.confirmed_address && (
                            <div className="text-xs">
                              <span className="font-medium text-green-700">✅ Confirmed:</span>{' '}
                              <span className="text-green-600">{conf.confirmed_address}</span>
                              {conf.confidence && (
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                                  conf.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                  conf.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-orange-100 text-orange-800'
                                }`}>
                                  {conf.confidence} confidence
                                </span>
                              )}
                            </div>
                          )}
                          {conf.error && (
                            <div className="text-xs text-red-600">
                              <span className="font-medium">Error:</span> {conf.error}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          conf.confirmed ? 'bg-green-100 text-green-800' :
                          conf.confirmation_method === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {conf.confirmed ? 'AI Confirmed' : conf.confirmation_method === 'failed' ? 'Failed' : 'CSV Only'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

