import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { RefreshCw, Download, ExternalLink, Flame, Building2, XCircle } from 'lucide-react'
import { bulkOfficeCheck } from '../services/bulkOfficeCheck'
import { prospects } from '../services/prospects'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import type { BulkOfficeCheckResult, BulkOfficeCheckCompany } from '../types'

const CH_URL = 'https://find-and-update.company-information.service.gov.uk/company'

function parseCompanyNumbers(raw: string): string[] {
  const cleaned = raw
    .replace(/[\s,;]+/g, '\n')
    .split('\n')
    .map((s) => s.replace(/\D/g, '').trim())
    .filter(Boolean)
  return [...new Set(cleaned.map((n) => n.padStart(8, '0')))]
}

export function BulkOfficeCheckPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [knownAddress, setKnownAddress] = useState('')
  const [companyNumbersRaw, setCompanyNumbersRaw] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [result, setResult] = useState<BulkOfficeCheckResult | null>(null)

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

  const parsedNumbers = useMemo(() => parseCompanyNumbers(companyNumbersRaw), [companyNumbersRaw])

  const handleRunCheck = async () => {
    if (!knownAddress.trim()) {
      toast.error('Please enter the known historical address')
      return
    }
    if (parsedNumbers.length === 0) {
      toast.error('Please enter at least one company number')
      return
    }
    setIsRunning(true)
    setProgress(`Checking ${parsedNumbers.length} companies...`)
    setResult(null)
    try {
      const data = await bulkOfficeCheck.run(parsedNumbers, knownAddress.trim())
      setResult(data)
      setProgress(null)
      toast.success(
        `Done: ${data.summary.still_there} still there, ${data.summary.moved} moved, ${data.summary.dissolved} dissolved, ${data.summary.errors} errors`
      )
    } catch (e: any) {
      setProgress(null)
      toast.error(e?.message ?? 'Bulk check failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleImportMovers = async () => {
    if (!result?.moved?.length || !practiceId) {
      toast.error('No moved companies to import or practice not set')
      return
    }
    const toSave = result.moved.map((r) => ({
      practice_id: practiceId,
      company_number: r.company_number,
      prospect_score: 0,
      score_factors: {},
      status: 'new' as const,
      discovery_source: 'bulk_office_check',
      discovery_address: r.registered_office || undefined,
    }))
    try {
      const bulk = await prospects.bulkSaveProspects(toSave)
      toast.success(`Imported ${bulk.saved} prospects${bulk.skipped ? `, ${bulk.skipped} already existed` : ''}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Import failed')
    }
  }

  const handleExportCSV = () => {
    if (!result) return
    const headers = ['company_number', 'company_name', 'company_status', 'registered_office', 'postcode', 'category']
    const rows: string[][] = [headers]
    const add = (list: BulkOfficeCheckCompany[], cat: string) => {
      list.forEach((r) =>
        rows.push([r.company_number, r.company_name, r.company_status, r.registered_office, r.postal_code, cat])
      )
    }
    add(result.still_there, 'still_there')
    add(result.moved, 'moved')
    add(result.dissolved, 'dissolved')
    add(result.errors, 'error')
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_office_check.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV downloaded')
  }

  const renderList = (
    list: BulkOfficeCheckCompany[],
    title: string,
    emptyMsg: string,
    showImport: boolean = false
  ) => (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      {list.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyMsg}</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-auto">
          {list.map((r) => (
            <div key={r.company_number} className="p-3 border rounded-lg bg-white">
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.company_name || r.company_number}</p>
                  <p className="text-xs text-gray-500">
                    {r.company_number}
                    {r.registered_office && ` · ${r.registered_office}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <a
                    href={`${CH_URL}/${r.company_number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-2 py-1 text-xs border rounded hover:bg-gray-50"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {showImport && practiceId && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await prospects.saveProspect({
                            practice_id: practiceId,
                            company_number: r.company_number,
                            prospect_score: 0,
                            score_factors: {},
                            status: 'new',
                            discovery_source: 'bulk_office_check',
                            discovery_address: r.registered_office || undefined,
                          })
                          toast.success('Prospect saved')
                        } catch (err: any) {
                          if (err?.message?.includes('already exists')) toast.error('Already saved')
                          else toast.error('Save failed')
                        }
                      }}
                      className="inline-flex items-center px-2 py-1 text-xs border rounded hover:bg-gray-50"
                    >
                      Save as prospect
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const [resultsTab, setResultsTab] = useState<'moved' | 'still_there' | 'dissolved' | 'errors'>('moved')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bulk Registered Office Checker</h1>
        <p className="text-gray-500">
          Paste company numbers and a known historical address to find who has moved (prospects), who is still there,
          dissolved, or errors.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Known historical address</label>
            <input
              type="text"
              placeholder="e.g. 24-28 Baxter Avenue, Southend-on-Sea, SS2 6HZ"
              value={knownAddress}
              onChange={(e) => setKnownAddress(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Company numbers (one per line or comma-separated)
            </label>
            <textarea
              placeholder="Paste or type company numbers..."
              value={companyNumbersRaw}
              onChange={(e) => setCompanyNumbersRaw(e.target.value)}
              rows={6}
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Parsed: {parsedNumbers.length} unique company number{parsedNumbers.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunCheck}
              disabled={isRunning}
              className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {isRunning && <RefreshCw className="w-4 h-4 animate-spin" />}
              Run bulk check
            </button>
            {isRunning && progress && <span className="text-sm text-gray-500">{progress}</span>}
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Results summary</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded border p-4 text-center">
                <p className="text-2xl font-bold">{result.summary.still_there}</p>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <Building2 className="w-3 h-3" /> Still there
                </p>
              </div>
              <div className="rounded border border-orange-200 bg-orange-50/50 p-4 text-center">
                <p className="text-2xl font-bold">{result.summary.moved}</p>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3" /> Moved
                </p>
              </div>
              <div className="rounded border p-4 text-center">
                <p className="text-2xl font-bold">{result.summary.dissolved}</p>
                <p className="text-xs text-gray-500">Dissolved</p>
              </div>
              <div className="rounded border p-4 text-center">
                <p className="text-2xl font-bold">{result.summary.errors}</p>
                <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
                  <XCircle className="w-3 h-3" /> Errors
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export all to CSV
              </button>
              {result.moved.length > 0 && practiceId && (
                <button
                  type="button"
                  onClick={handleImportMovers}
                  className="inline-flex items-center rounded bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                >
                  Import all movers as prospects
                </button>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Results by category</h2>
            <div className="flex gap-2 border-b mb-4">
              {(['moved', 'still_there', 'dissolved', 'errors'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setResultsTab(tab)}
                  className={`px-3 py-2 text-sm font-medium rounded-t ${
                    resultsTab === tab ? 'bg-gray-100 border border-b-0 border-gray-200' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.replace('_', ' ')} ({result[tab].length})
                </button>
              ))}
            </div>
            {resultsTab === 'moved' && renderList(result.moved, 'Moved (prospects)', 'No moved companies', true)}
            {resultsTab === 'still_there' && renderList(result.still_there, 'Still at address', 'None')}
            {resultsTab === 'dissolved' && renderList(result.dissolved, 'Dissolved', 'None')}
            {resultsTab === 'errors' && renderList(result.errors, 'Errors', 'None')}
          </div>
        </>
      )}
    </div>
  )
}
