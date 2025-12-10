import { useState } from 'react'
import { Upload, FileText, CheckCircle, XCircle, Loader2, Download } from 'lucide-react'
import { directorImport, type ImportResult } from '../../services/director-import'
import { Button } from '../ui/button'
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

  const handleImport = async () => {
    if (!file) {
      toast.error('Please select a CSV file first')
      return
    }

    setIsImporting(true)
    try {
      const importResult = await directorImport.importFromCSV(file, practiceId)
      setResult(importResult)
      
      if (importResult.errors.length === 0) {
        toast.success(
          `Successfully imported ${importResult.updated} director addresses`
        )
      } else {
        toast.error(
          `Imported ${importResult.updated} addresses, but ${importResult.errors.length} rows had errors`
        )
      }
      
      onImportComplete?.(importResult)
    } catch (error) {
      toast.error(`Import failed: ${(error as Error).message}`)
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
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-2" />
          Download Template
        </Button>
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

      {/* Import Button */}
      {file && (
        <Button
          onClick={handleImport}
          disabled={isImporting}
          className="w-full"
        >
          {isImporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Import Director Addresses
            </>
          )}
        </Button>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
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
          </div>

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
                    {error.data.name && (
                      <div className="text-xs text-gray-600 mt-1">
                        Director: {error.data.name}
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

