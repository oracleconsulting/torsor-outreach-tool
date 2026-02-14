import { supabase } from '../lib/supabase'
import type { BulkOfficeCheckResult } from '../types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

async function callEdgeFunction(functionName: string, body: object): Promise<BulkOfficeCheckResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export const bulkOfficeCheck = {
  async run(companyNumbers: string[], knownAddress: string): Promise<BulkOfficeCheckResult> {
    return callEdgeFunction('bulk-office-check', {
      company_numbers: companyNumbers,
      known_address: knownAddress,
    })
  },
}
