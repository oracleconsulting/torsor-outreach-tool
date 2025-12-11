import { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { directorImport, type ImportResult } from '../../services/director-import'
import toast from 'react-hot-toast'

interface DirectorCSVImportProps {
  practiceId: string
  onImportComplete?: (result: ImportResult) => void
}

export function DirectorCSVImport({ practiceId, onImportComplete }: DirectorCSVImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please select a CSV file')
        return
      }
      setFile(selectedFile)
      setResult(null)
    }
  }

  const [confirmAddresses, setConfirmAddresses] = useState(false) // Default to false for faster imports
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
        onProgress: (current, total) => {
          setProgress({ current, total })
        },
      })
      console.log('Setting result in component:', importResult)
      // Force a state update to ensure re-render
      setResult(null)
      setTimeout(() => {
        setResult(importResult)
        setProgress(null)
      }, 0)
      
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

  // Debug: Log when component renders with result
  if (result) {
    console.log('Component rendering with result:', result)
  }

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
              id="confirm-addresses"
              checked={confirmAddresses}
              onChange={(e) => setConfirmAddresses(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="confirm-addresses" className="text-sm cursor-pointer">
              <span className="font-medium">Confirm addresses with AI</span>
              <span className="text-gray-600 block text-xs mt-1">
                Use Perplexity AI to verify and correct director contact addresses (not registered office addresses).
                <strong className="text-orange-600"> Note: This will significantly slow down the import (1-2 seconds per row).</strong>
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
                    {confirmAddresses ? ' (confirming addresses...)' : ''}
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

      {/* Results */}
      {result && (
        <div className="space-y-4 mt-6 border-t-2 border-gray-300 pt-6 bg-white rounded-lg p-6 shadow-md">
          <h4 className="text-xl font-bold mb-4 text-gray-900">Import Results</h4>
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
        </div>
      )}
    </div>
  )
}

