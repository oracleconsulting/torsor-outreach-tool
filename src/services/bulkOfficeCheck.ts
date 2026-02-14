import { supabase } from '../lib/supabase'
import type { BulkOfficeCheckResult } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** Max companies per request to stay under Edge Function timeout (~60–150s). */
const CHUNK_SIZE = 40

async function callEdgeFunction(
  functionName: string,
  body: object
): Promise<BulkOfficeCheckResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const url = `${SUPABASE_URL}/functions/v1/${functionName}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  }
  if (SUPABASE_ANON_KEY) {
    headers['apikey'] = SUPABASE_ANON_KEY
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const msg = (err as { error?: string }).error ?? `HTTP ${res.status} ${res.statusText}`
    console.error('[bulkOfficeCheck]', res.status, res.statusText, err)
    throw new Error(msg)
  }
  return res.json()
}

function mergeResults(
  acc: BulkOfficeCheckResult,
  next: BulkOfficeCheckResult
): BulkOfficeCheckResult {
  return {
    total_checked: acc.total_checked + next.total_checked,
    still_there: [...acc.still_there, ...next.still_there],
    moved: [...acc.moved, ...next.moved],
    dissolved: [...acc.dissolved, ...next.dissolved],
    errors: [...acc.errors, ...next.errors],
    summary: {
      still_there: acc.summary.still_there + next.summary.still_there,
      moved: acc.summary.moved + next.summary.moved,
      dissolved: acc.summary.dissolved + next.summary.dissolved,
      errors: acc.summary.errors + next.summary.errors,
    },
  }
}

const emptyResult: BulkOfficeCheckResult = {
  total_checked: 0,
  still_there: [],
  moved: [],
  dissolved: [],
  errors: [],
  summary: { still_there: 0, moved: 0, dissolved: 0, errors: 0 },
}

export const bulkOfficeCheck = {
  CHUNK_SIZE,

  async run(companyNumbers: string[], knownAddress: string): Promise<BulkOfficeCheckResult> {
    if (companyNumbers.length <= CHUNK_SIZE) {
      return callEdgeFunction('bulk-office-check', {
        company_numbers: companyNumbers,
        known_address: knownAddress,
      })
    }
    let merged = emptyResult
    for (let i = 0; i < companyNumbers.length; i += CHUNK_SIZE) {
      const chunk = companyNumbers.slice(i, i + CHUNK_SIZE)
      const chunkResult = await callEdgeFunction('bulk-office-check', {
        company_numbers: chunk,
        known_address: knownAddress,
      })
      merged = mergeResults(merged, chunkResult)
    }
    return merged
  },

  /** Run in chunks and call onProgress after each chunk (for UI). */
  async runWithProgress(
    companyNumbers: string[],
    knownAddress: string,
    onProgress: (done: number, total: number, resultSoFar: BulkOfficeCheckResult) => void
  ): Promise<BulkOfficeCheckResult> {
    if (companyNumbers.length <= CHUNK_SIZE) {
      const result = await callEdgeFunction('bulk-office-check', {
        company_numbers: companyNumbers,
        known_address: knownAddress,
      })
      onProgress(companyNumbers.length, companyNumbers.length, result)
      return result
    }
    let merged = emptyResult
    const total = companyNumbers.length
    for (let i = 0; i < companyNumbers.length; i += CHUNK_SIZE) {
      const chunk = companyNumbers.slice(i, i + CHUNK_SIZE)
      const chunkResult = await callEdgeFunction('bulk-office-check', {
        company_numbers: chunk,
        known_address: knownAddress,
      })
      merged = mergeResults(merged, chunkResult)
      const done = Math.min(i + CHUNK_SIZE, total)
      onProgress(done, total, merged)
    }
    return merged
  },
}
