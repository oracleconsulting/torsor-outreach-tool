import { supabase } from '../lib/supabase'
import type { Director } from '../types/directors'
import { apollo } from './apollo'

export interface DirectorCSVRow {
  // Company info (for matching)
  company_name?: string
  company_number?: string
  registered_number?: string
  
  // Director name components (auto-detected)
  dir_title?: string
  dir_name_prefix?: string
  dir_first_name?: string
  dir_middle_names?: string
  dir_surname?: string
  dir_initial?: string
  dir_full_name?: string // Constructed or provided
  
  // Director address (auto-detected)
  dir_address_line_1?: string
  dir_address_line_2?: string
  dir_address_line_3?: string
  dir_town?: string
  dir_postcode?: string
  dir_country?: string
  
  // Director details
  dir_date_of_birth?: string
  dir_nationality?: string
  dir_position?: string
  dir_occupation?: string
  
  // Trading address (for context, not director address)
  trading_address_line_1?: string
  trading_address_line_2?: string
  trading_address_line_3?: string
  trading_address_line_4?: string
  trading_town?: string
  trading_postcode?: string
  
  // Registered office (for context, not director address)
  registered_office_address_line_1?: string
  registered_office_address_line_2?: string
  registered_office_address_line_3?: string
  registered_office_address_line_4?: string
  registered_office_town?: string
  registered_office_postcode?: string
  registered_office_country?: string
  
  // Contact details (if available)
  email?: string
  phone?: string
  linkedin_url?: string
  preferred_contact_method?: 'email' | 'phone' | 'address' | 'linkedin'
  
  // Raw row data for reference
  _raw?: Record<string, string>
}

export interface ColumnMapping {
  // Company
  company_name?: string
  company_number?: string
  
  // Director name
  dir_title?: string
  dir_first_name?: string
  dir_middle_names?: string
  dir_surname?: string
  dir_full_name?: string
  
  // Director address
  dir_address_line_1?: string
  dir_address_line_2?: string
  dir_address_line_3?: string
  dir_town?: string
  dir_postcode?: string
  dir_country?: string
  
  // Director details
  dir_date_of_birth?: string
  dir_nationality?: string
  dir_position?: string
  dir_occupation?: string
  
  // Registered office address (for context when finding addresses)
  registered_office_address_1?: string
  registered_office_address_2?: string
  registered_office_address_3?: string
  registered_office_address_4?: string
  registered_office_town?: string
  registered_office_postcode?: string
  registered_office_country?: string
}

export interface ConfirmationDetail {
  row: number
  director_name: string
  company_number?: string
  company_name?: string
  confirmed: boolean
  confirmation_method: 'ai_confirmed' | 'apollo_confirmed' | 'csv_import' | 'failed'
  original_address?: string
  confirmed_address?: string
  confidence?: 'high' | 'medium' | 'low'
  error?: string
}

export interface ImportResult {
  total: number
  matched: number
  updated: number
  created: number
  confirmed: number // Addresses confirmed via AI
  errors: Array<{ row: number; error: string; data: Partial<DirectorCSVRow> }>
  warnings: Array<{ row: number; warning: string; data: Partial<DirectorCSVRow> }>
  confirmations: ConfirmationDetail[]
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

export const directorImport = {
  /**
   * Auto-detect column mappings from CSV headers
   */
  detectColumnMappings(headers: string[]): ColumnMapping {
    const mapping: ColumnMapping = {}
    const lowerHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Company columns
    mapping.company_name = this.findColumn(lowerHeaders, ['company name', 'company_name', 'company'])
    mapping.company_number = this.findColumn(lowerHeaders, [
      'registered number', 'registered_number', 'company number', 'company_number',
      'company no', 'company_no', 'reg number', 'reg_number'
    ])
    
    // Registered office address columns (for context when finding addresses)
    mapping.registered_office_address_1 = this.findColumn(lowerHeaders, ['registered office address 1', 'registered_office_address_1', 'reg office address 1'])
    mapping.registered_office_address_2 = this.findColumn(lowerHeaders, ['registered office address 2', 'registered_office_address_2', 'reg office address 2'])
    mapping.registered_office_address_3 = this.findColumn(lowerHeaders, ['registered office address 3', 'registered_office_address_3', 'reg office address 3'])
    mapping.registered_office_address_4 = this.findColumn(lowerHeaders, ['registered office address 4', 'registered_office_address_4', 'reg office address 4'])
    mapping.registered_office_town = this.findColumn(lowerHeaders, ['registered office town', 'registered_office_town', 'reg office town'])
    mapping.registered_office_postcode = this.findColumn(lowerHeaders, ['registered office postcode', 'registered_office_postcode', 'reg office postcode'])
    mapping.registered_office_country = this.findColumn(lowerHeaders, ['registered office country', 'registered_office_country', 'reg office country'])
    
    // Director name columns
    mapping.dir_title = this.findColumn(lowerHeaders, ['dir title', 'dir_title', 'title', 'director title'])
    mapping.dir_first_name = this.findColumn(lowerHeaders, ['dir first name', 'dir_first_name', 'first name', 'first_name', 'forename'])
    mapping.dir_middle_names = this.findColumn(lowerHeaders, ['dir middle names', 'dir_middle_names', 'middle names', 'middle_names'])
    mapping.dir_surname = this.findColumn(lowerHeaders, ['dir surname', 'dir_surname', 'surname', 'last name', 'last_name'])
    mapping.dir_full_name = this.findColumn(lowerHeaders, ['dir full name', 'dir_full_name', 'full name', 'full_name', 'name', 'director name'])
    
    // Director address columns
    mapping.dir_address_line_1 = this.findColumn(lowerHeaders, [
      'dir address line 1', 'dir_address_line_1', 'dir address 1', 'director address line 1',
      'director address 1', 'dir address', 'director address'
    ])
    mapping.dir_address_line_2 = this.findColumn(lowerHeaders, [
      'dir address line 2', 'dir_address_line_2', 'dir address 2', 'director address line 2'
    ])
    mapping.dir_address_line_3 = this.findColumn(lowerHeaders, [
      'dir address line 3', 'dir_address_line_3', 'dir address 3', 'director address line 3'
    ])
    mapping.dir_town = this.findColumn(lowerHeaders, [
      'dir town', 'dir_town', 'director town', 'dir city', 'director city'
    ])
    mapping.dir_postcode = this.findColumn(lowerHeaders, [
      'dir postcode', 'dir_postcode', 'director postcode', 'dir postal code', 'director postal code'
    ])
    mapping.dir_country = this.findColumn(lowerHeaders, [
      'dir country', 'dir_country', 'director country'
    ])
    
    // Director details
    mapping.dir_date_of_birth = this.findColumn(lowerHeaders, [
      'dir date of birth', 'dir_date_of_birth', 'date of birth', 'dob', 'director dob'
    ])
    mapping.dir_nationality = this.findColumn(lowerHeaders, [
      'dir nationality', 'dir_nationality', 'nationality', 'director nationality'
    ])
    mapping.dir_position = this.findColumn(lowerHeaders, [
      'dir position', 'dir_position', 'position', 'director position'
    ])
    mapping.dir_occupation = this.findColumn(lowerHeaders, [
      'dir occupation', 'dir_occupation', 'occupation', 'director occupation'
    ])
    
    // Registered office address columns (for context when finding addresses)
    mapping.registered_office_address_1 = this.findColumn(lowerHeaders, ['registered office address 1', 'registered_office_address_1', 'reg office address 1'])
    mapping.registered_office_address_2 = this.findColumn(lowerHeaders, ['registered office address 2', 'registered_office_address_2', 'reg office address 2'])
    mapping.registered_office_address_3 = this.findColumn(lowerHeaders, ['registered office address 3', 'registered_office_address_3', 'reg office address 3'])
    mapping.registered_office_address_4 = this.findColumn(lowerHeaders, ['registered office address 4', 'registered_office_address_4', 'reg office address 4'])
    mapping.registered_office_town = this.findColumn(lowerHeaders, ['registered office town', 'registered_office_town', 'reg office town'])
    mapping.registered_office_postcode = this.findColumn(lowerHeaders, ['registered office postcode', 'registered_office_postcode', 'reg office postcode'])
    mapping.registered_office_country = this.findColumn(lowerHeaders, ['registered office country', 'registered_office_country', 'reg office country'])
    
    return mapping
  },

  /**
   * Find column index by matching against possible names
   */
  findColumn(headers: string[], possibleNames: string[]): string | undefined {
    for (const name of possibleNames) {
      // Try exact match first (case-insensitive)
      const exactMatch = headers.find(h => h.toLowerCase().trim() === name.toLowerCase().trim())
      if (exactMatch) return exactMatch
      
      // Try partial match
      const index = headers.findIndex(h => {
        const hLower = h.toLowerCase().trim()
        const nLower = name.toLowerCase().trim()
        return hLower.includes(nLower) || nLower.includes(hLower)
      })
      if (index !== -1) {
        return headers[index]
      }
    }
    return undefined
  },

  /**
   * Parse CSV file and import director addresses with AI confirmation
   */
  async importFromCSV(
    file: File,
    practiceId: string,
    options?: {
      confirmAddresses?: boolean // Use Perplexity to confirm addresses
      skipConfirmation?: boolean // Skip if address already confirmed
      findMissingAddresses?: boolean // Use AI to find addresses when they're missing from CSV
      onProgress?: (current: number, total: number) => void // Progress callback
    }
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      matched: 0,
      updated: 0,
      created: 0,
      confirmed: 0,
      errors: [],
      warnings: [],
      confirmations: [],
    }

    try {
      // Parse CSV
      const text = await file.text()
      const { headers, rows } = this.parseCSV(text)
      
      if (rows.length === 0) {
        throw new Error('CSV file appears to be empty or has no data rows')
      }
      
      // Auto-detect column mappings
      const mapping = this.detectColumnMappings(headers)
      
      // Log detected mappings for debugging
      console.log('Detected column mappings:', mapping)
      console.log('CSV headers:', headers)
      console.log('Number of rows:', rows.length)
      
      result.total = rows.length

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        
        // Report progress
        if (options?.onProgress) {
          options.onProgress(i + 1, rows.length)
        }
        
        try {
          const directorRow = this.normalizeRow(row, mapping)
          
          // Debug: Log first row to see what we're getting
          if (i === 0) {
            console.log('First row normalized:', {
              dir_full_name: directorRow.dir_full_name,
              company_number: directorRow.company_number,
              dir_address_line_1: directorRow.dir_address_line_1,
              mapping: mapping,
              rowKeys: Object.keys(row).slice(0, 15),
            })
          }
          
          // Skip if no director name found
          if (!directorRow.dir_full_name || directorRow.dir_full_name.trim() === '') {
            result.warnings.push({
              row: i + 1,
              warning: `No director name found in row. Detected columns: ${Object.keys(mapping).filter(k => mapping[k as keyof ColumnMapping]).join(', ')}. Row has: ${Object.keys(row).slice(0, 10).join(', ')}...`,
              data: directorRow,
            })
            continue
          }
          
          // Find or confirm address with Perplexity if requested
          let confirmedAddress = null
          let foundAddress: {
            address_line_1: string
            address_line_2?: string
            locality: string
            postal_code: string
            country: string
          } | null = null
          
          const originalAddress = directorRow.dir_address_line_1 
            ? `${directorRow.dir_address_line_1}, ${directorRow.dir_address_line_2 || ''}, ${directorRow.dir_town || ''}, ${directorRow.dir_postcode || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')
            : undefined
          
          const confirmationDetail: ConfirmationDetail = {
            row: i + 1,
            director_name: directorRow.dir_full_name || 'Unknown',
            company_number: directorRow.company_number,
            company_name: directorRow.company_name,
            confirmed: false,
            confirmation_method: 'csv_import',
            original_address: originalAddress,
          }
          
          // Find missing addresses using AI
          if (options?.findMissingAddresses && !directorRow.dir_address_line_1 && directorRow.company_number && directorRow.company_name) {
            try {
              // Add a small delay to avoid rate limiting
              if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000)) // 1 second delay every 10 rows
              }
              
              const apolloResult = await apollo.enrichCompany({
                company_name: directorRow.company_name,
                company_number: directorRow.company_number,
                director_name: directorRow.dir_full_name,
              }, false) // Don't fetch contacts during CSV import to save credits
              
              if (apolloResult.success && apolloResult.found && apolloResult.address) {
                foundAddress = {
                  address_line_1: apolloResult.address.line1 || '',
                  address_line_2: apolloResult.address.line2,
                  locality: apolloResult.address.city || '',
                  postal_code: apolloResult.address.postcode || '',
                  country: apolloResult.address.country || 'United Kingdom',
                }
                confirmationDetail.confirmed = true
                confirmationDetail.confirmation_method = 'apollo_confirmed'
                confirmationDetail.confirmed_address = `${foundAddress.address_line_1}, ${foundAddress.address_line_2 || ''}, ${foundAddress.locality}, ${foundAddress.postal_code}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')
                // Convert numeric confidence to string
                const confidenceNum = apolloResult.confidence || 0
                confirmationDetail.confidence = confidenceNum >= 80 ? 'high' : confidenceNum >= 50 ? 'medium' : 'low'
                result.confirmed++
                
                // Update director row with found address
                directorRow.dir_address_line_1 = foundAddress.address_line_1
                directorRow.dir_address_line_2 = foundAddress.address_line_2
                directorRow.dir_town = foundAddress.locality
                directorRow.dir_postcode = foundAddress.postal_code
                directorRow.dir_country = foundAddress.country
              } else {
                confirmationDetail.confirmation_method = 'failed'
                confirmationDetail.error = apolloResult.notes || 'Apollo could not find address'
                result.warnings.push({
                  row: i + 1,
                  warning: `Address discovery failed: ${apolloResult.notes || 'No address found in Apollo database'}`,
                  data: directorRow,
                })
              }
            } catch (error) {
              confirmationDetail.confirmation_method = 'failed'
              const errorMessage = (error as Error).message
              confirmationDetail.error = errorMessage
              // Provide more helpful error message
              let warningMessage = `Address discovery failed: ${errorMessage}`
              if (errorMessage.includes('Network error') || errorMessage.includes('Failed to fetch')) {
                warningMessage = `Address discovery failed: Unable to reach AI service. Please check your connection and ensure the address-enrichment Edge Function is deployed.`
              }
              result.warnings.push({
                row: i + 1,
                warning: warningMessage,
                data: directorRow,
              })
            }
          }
          
          // Confirm existing addresses with Apollo if requested
          if (options?.confirmAddresses && directorRow.dir_address_line_1) {
            try {
              // Add a small delay to avoid rate limiting
              if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 600)) // 600ms delay for Apollo rate limits
              }
              
              const confirmResult = await apollo.confirmAddress({
                company_name: directorRow.company_name || '',
                company_number: directorRow.company_number || '',
                director_name: directorRow.dir_full_name,
              }, {
                line1: directorRow.dir_address_line_1,
                postcode: directorRow.dir_postcode || '',
              })
              
              if (confirmResult.success && confirmResult.confirmed && confirmResult.apolloAddress) {
                confirmedAddress = {
                  address_line_1: confirmResult.apolloAddress.line1,
                  address_line_2: confirmResult.apolloAddress.line2,
                  locality: confirmResult.apolloAddress.city,
                  postal_code: confirmResult.apolloAddress.postcode,
                  country: confirmResult.apolloAddress.country || 'United Kingdom',
                  confidence: confirmResult.confidence >= 80 ? 'high' : confirmResult.confidence >= 50 ? 'medium' : 'low',
                }
                result.confirmed++
                confirmationDetail.confirmed = true
                confirmationDetail.confirmation_method = 'apollo_confirmed'
                confirmationDetail.confirmed_address = `${confirmedAddress.address_line_1}, ${confirmedAddress.address_line_2 || ''}, ${confirmedAddress.locality || ''}, ${confirmedAddress.postal_code || ''}`.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '')
                confirmationDetail.confidence = (confirmedAddress.confidence || 'medium') as 'high' | 'medium' | 'low'
                
                // Update with confirmed address
                directorRow.dir_address_line_1 = confirmedAddress.address_line_1
                directorRow.dir_address_line_2 = confirmedAddress.address_line_2
                directorRow.dir_town = confirmedAddress.locality
                directorRow.dir_postcode = confirmedAddress.postal_code
                directorRow.dir_country = confirmedAddress.country || 'United Kingdom'
              } else {
                confirmationDetail.confirmation_method = 'failed'
                confirmationDetail.error = confirmResult.notes || 'Apollo could not confirm address'
              }
            } catch (error) {
              confirmationDetail.confirmation_method = 'failed'
              confirmationDetail.error = (error as Error).message
              result.warnings.push({
                row: i + 1,
                warning: `Address confirmation failed: ${(error as Error).message}`,
                data: directorRow,
              })
              // Continue with unconfirmed address
            }
          }
          
          // Always add confirmation detail to track what happened
          result.confirmations.push(confirmationDetail)
          
          // Use Edge Function to handle database operations (bypasses schema exposure issue)
          const directorPayload = {
            name: directorRow.dir_full_name!,
            company_number: directorRow.company_number,
            company_name: directorRow.company_name,
            trading_address: (foundAddress || confirmedAddress || directorRow.dir_address_line_1) ? {
              address_line_1: foundAddress?.address_line_1 || confirmedAddress?.address_line_1 || directorRow.dir_address_line_1,
              address_line_2: foundAddress?.address_line_2 || confirmedAddress?.address_line_2 || directorRow.dir_address_line_2 || directorRow.dir_address_line_3,
              locality: foundAddress?.locality || confirmedAddress?.locality || directorRow.dir_town,
              postal_code: foundAddress?.postal_code || confirmedAddress?.postal_code || directorRow.dir_postcode,
              country: foundAddress?.country || confirmedAddress?.country || directorRow.dir_country || 'United Kingdom',
            } : undefined,
            contact_address: (foundAddress || confirmedAddress || directorRow.dir_address_line_1) ? {
              address_line_1: foundAddress?.address_line_1 || confirmedAddress?.address_line_1 || directorRow.dir_address_line_1,
              address_line_2: foundAddress?.address_line_2 || confirmedAddress?.address_line_2 || directorRow.dir_address_line_2 || directorRow.dir_address_line_3,
              locality: foundAddress?.locality || confirmedAddress?.locality || directorRow.dir_town,
              postal_code: foundAddress?.postal_code || confirmedAddress?.postal_code || directorRow.dir_postcode,
              country: foundAddress?.country || confirmedAddress?.country || directorRow.dir_country || 'United Kingdom',
            } : undefined,
            email: directorRow.email,
            phone: directorRow.phone,
            linkedin_url: directorRow.linkedin_url,
            preferred_contact_method: directorRow.preferred_contact_method,
            date_of_birth: directorRow.dir_date_of_birth,
            nationality: directorRow.dir_nationality,
            address_source: (foundAddress || confirmedAddress) ? 'csv_import_apollo_confirmed' : 'csv_import',
            address_verified_at: new Date().toISOString(),
          }

          const { data: { session } } = await supabase.auth.getSession()
          const response = await fetch(`${SUPABASE_URL}/functions/v1/import-directors`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session?.access_token || ''}`,
            },
            body: JSON.stringify({
              practiceId,
              directors: [directorPayload],
            }),
          })

          if (!response.ok) {
            const errorText = await response.text()
            let error
            try {
              error = JSON.parse(errorText)
            } catch {
              error = { error: errorText }
            }
            console.error(`Edge Function error:`, error)
            throw new Error(error.error || `HTTP ${response.status}: ${errorText}`)
          }

          const importResult = await response.json()
          console.log(`Import result for row ${i + 1}:`, importResult)
          
          if (importResult.errors && importResult.errors.length > 0) {
            throw new Error(importResult.errors[0].error)
          }

          if (importResult.updated > 0) {
            result.matched++
            result.updated++
          } else if (importResult.created > 0) {
            result.created++
          }
        } catch (error) {
          const errorMessage = (error as Error).message
          console.error(`Error processing row ${i + 1}:`, errorMessage, error)
          result.errors.push({
            row: i + 1,
            error: errorMessage,
            data: row as Partial<DirectorCSVRow>,
          })
        }
      }

      console.log('Final import result:', {
        total: result.total,
        matched: result.matched,
        updated: result.updated,
        created: result.created,
        confirmed: result.confirmed,
        errors: result.errors.length,
        warnings: result.warnings.length,
      })

      return result
    } catch (error) {
      throw new Error(`CSV import failed: ${(error as Error).message}`)
    }
  },

  /**
   * Parse CSV text into headers and rows
   */
  parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return { headers: [], rows: [] }

    // Parse header - keep original case for mapping, but also store lowercase for lookup
    const headers = this.parseCSVLine(lines[0])
    const rows: Record<string, string>[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i])
      if (values.length === 0) continue

      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        const originalHeader = header.trim()
        const lowerHeader = originalHeader.toLowerCase()
        const value = values[index]?.trim() || ''
        // Store both original and lowercase keys for flexible lookup
        row[originalHeader] = value
        row[lowerHeader] = value
      })
      rows.push(row)
    }

    return { headers, rows }
  },

  /**
   * Parse a single CSV line handling quoted fields
   */
  parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current)
        current = ''
      } else {
        current += char
      }
    }

    // Add last field
    result.push(current)
    return result
  },

  /**
   * Normalize CSV row using detected column mappings
   */
  normalizeRow(
    row: Record<string, string>,
    mapping: ColumnMapping
  ): DirectorCSVRow {
    const getValue = (key: string | undefined) => {
      if (!key) return undefined
      // Try exact match first
      if (row[key]) return row[key]?.trim() || undefined
      // Try lowercase match (CSV parser converts headers to lowercase)
      const lowerKey = key.toLowerCase().trim()
      if (row[lowerKey]) return row[lowerKey]?.trim() || undefined
      // Try case-insensitive match
      const foundKey = Object.keys(row).find(k => k.toLowerCase() === lowerKey)
      if (foundKey) return row[foundKey]?.trim() || undefined
      return undefined
    }

    // Build full name from components or use provided
    let fullName = getValue(mapping.dir_full_name)
    if (!fullName && (mapping.dir_first_name || mapping.dir_surname)) {
      const parts = [
        getValue(mapping.dir_title),
        getValue(mapping.dir_first_name),
        getValue(mapping.dir_middle_names),
        getValue(mapping.dir_surname),
      ].filter(Boolean)
      fullName = parts.join(' ').trim()
    }
    
    // Debug logging
    if (!fullName) {
      console.log('Row data sample:', {
        dir_title: getValue(mapping.dir_title),
        dir_first_name: getValue(mapping.dir_first_name),
        dir_surname: getValue(mapping.dir_surname),
        mapping_keys: Object.keys(mapping),
        row_keys_sample: Object.keys(row).slice(0, 10),
      })
    }

    return {
      company_name: getValue(mapping.company_name),
      company_number: getValue(mapping.company_number) || getValue(mapping.company_number),
      registered_number: getValue(mapping.company_number),
      
      dir_title: getValue(mapping.dir_title),
      dir_first_name: getValue(mapping.dir_first_name),
      dir_middle_names: getValue(mapping.dir_middle_names),
      dir_surname: getValue(mapping.dir_surname),
      dir_full_name: fullName,
      
      dir_address_line_1: getValue(mapping.dir_address_line_1),
      dir_address_line_2: getValue(mapping.dir_address_line_2),
      dir_address_line_3: getValue(mapping.dir_address_line_3),
      dir_town: getValue(mapping.dir_town),
      dir_postcode: getValue(mapping.dir_postcode),
      dir_country: getValue(mapping.dir_country) || 'United Kingdom',
      
      // Registered office address
      registered_office_address_line_1: getValue(mapping.registered_office_address_1),
      registered_office_address_line_2: getValue(mapping.registered_office_address_2),
      registered_office_address_line_3: getValue(mapping.registered_office_address_3),
      registered_office_address_line_4: getValue(mapping.registered_office_address_4),
      registered_office_town: getValue(mapping.registered_office_town),
      registered_office_postcode: getValue(mapping.registered_office_postcode),
      registered_office_country: getValue(mapping.registered_office_country),
      
      dir_date_of_birth: getValue(mapping.dir_date_of_birth),
      dir_nationality: getValue(mapping.dir_nationality),
      dir_position: getValue(mapping.dir_position),
      dir_occupation: getValue(mapping.dir_occupation),
      
      _raw: row,
    }
  },

  /**
   * Confirm director address using Perplexity AI
   */
  async confirmDirectorAddress(
    directorName: string,
    addressData: DirectorCSVRow,
    companyContext?: string
  ): Promise<{
    address_line_1: string
    address_line_2?: string
    locality: string
    postal_code: string
    country: string
    confidence: 'high' | 'medium' | 'low'
  } | null> {
    const { data: { session } } = await supabase.auth.getSession()

    // Build address string from available data
    const addressParts = [
      addressData.dir_address_line_1,
      addressData.dir_address_line_2,
      addressData.dir_address_line_3,
      addressData.dir_town,
      addressData.dir_postcode,
      addressData.dir_country,
    ].filter(Boolean)
    
    const addressString = addressParts.join(', ')

    const response = await fetch(`${SUPABASE_URL}/functions/v1/confirm-director-address`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({
        directorName,
        address: addressString,
        companyContext,
        providedAddress: {
          line1: addressData.dir_address_line_1,
          line2: addressData.dir_address_line_2,
          line3: addressData.dir_address_line_3,
          town: addressData.dir_town,
          postcode: addressData.dir_postcode,
          country: addressData.dir_country,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    return result.confirmedAddress || null
  },

  /**
   * Find director by name, officer_id, or company_number
   */
  async findDirector(row: DirectorCSVRow): Promise<Director | null> {
    if (!row.dir_full_name) return null

    // Try by name + company_number (if provided) - most reliable for CSV imports
    if (row.company_number) {
      const { data: appointment } = await supabase
        .from('outreach.director_appointments')
        .select('director_id, director:directors(*)')
        .eq('company_number', row.company_number)
        .ilike('director:directors.name', `%${row.dir_full_name.split(' ').pop()}%`) // Match on surname
        .limit(5)

      if (appointment && appointment.length > 0) {
        // Find best match by full name similarity
        const bestMatch = appointment.find(a => {
          const director = a.director as any
          if (!director || Array.isArray(director)) return false
          const directorName = director.name || ''
          return directorName.toLowerCase().includes(row.dir_full_name!.toLowerCase()) ||
                 row.dir_full_name!.toLowerCase().includes(directorName.toLowerCase())
        })
        
        if (bestMatch?.director && !Array.isArray(bestMatch.director)) {
          return bestMatch.director as Director
        }
        // Fallback to first match
        if (appointment[0]?.director && !Array.isArray(appointment[0].director)) {
          return appointment[0].director as Director
        }
      }
    }

    // Try by name only (fuzzy match)
    const { data } = await supabase
      .from('outreach.directors')
      .select('*')
      .ilike('name', `%${row.dir_full_name.split(' ').pop()}%`) // Match on surname
      .limit(5)

    if (data && data.length > 0) {
      // Find best match
      const bestMatch = data.find(d => {
        const directorName = d.name.toLowerCase()
        const searchName = row.dir_full_name!.toLowerCase()
        return directorName.includes(searchName) || searchName.includes(directorName)
      })
      
      return bestMatch || data[0]
    }

    return null
  },

  /**
   * Update director with address information
   */
  async updateDirectorAddress(
    directorId: string,
    row: DirectorCSVRow,
    _practiceId: string,
    confirmedAddress?: any
  ): Promise<void> {
    const updateData: any = {
      address_source: 'csv_import',
      address_verified_at: new Date().toISOString(),
    }

    // Use confirmed address if available, otherwise use provided
    const address = confirmedAddress || {
      address_line_1: row.dir_address_line_1,
      address_line_2: row.dir_address_line_2 || row.dir_address_line_3,
      locality: row.dir_town,
      postal_code: row.dir_postcode,
      country: row.dir_country || 'United Kingdom',
    }

    // Build contact address JSONB (this is the director's personal address, not registered office)
    if (address.address_line_1 || address.locality || address.postal_code) {
      updateData.contact_address = {
        address_line_1: address.address_line_1 || null,
        address_line_2: address.address_line_2 || null,
        locality: address.locality || null,
        region: null, // Not typically in director addresses
        postal_code: address.postal_code || null,
        country: address.country || 'United Kingdom',
      }
      
      if (confirmedAddress) {
        updateData.address_source = 'csv_import_apollo_confirmed'
      }
    }

    // Add director details
    if (row.dir_date_of_birth) updateData.date_of_birth = row.dir_date_of_birth
    if (row.dir_nationality) updateData.nationality = row.dir_nationality

    const { error } = await supabase
      .from('outreach.directors')
      .update(updateData)
      .eq('id', directorId)

    if (error) throw error
  },

  /**
   * Create new director with address (if we have enough info)
   */
  async createDirectorWithAddress(
    row: DirectorCSVRow,
    _practiceId: string,
    confirmedAddress?: any
  ): Promise<Director> {
    if (!row.dir_full_name) {
      throw new Error('Director name is required')
    }

    const directorData: any = {
      name: row.dir_full_name,
      address_source: confirmedAddress ? 'csv_import_apollo_confirmed' : 'csv_import',
      address_verified_at: new Date().toISOString(),
    }

    // Use confirmed address if available
    const address = confirmedAddress || {
      address_line_1: row.dir_address_line_1,
      address_line_2: row.dir_address_line_2 || row.dir_address_line_3,
      locality: row.dir_town,
      postal_code: row.dir_postcode,
      country: row.dir_country || 'United Kingdom',
    }

    // Add contact address
    if (address.address_line_1 || address.locality || address.postal_code) {
      directorData.contact_address = {
        address_line_1: address.address_line_1 || null,
        address_line_2: address.address_line_2 || null,
        locality: address.locality || null,
        region: null,
        postal_code: address.postal_code || null,
        country: address.country || 'United Kingdom',
      }
    }

    // Add director details
    if (row.dir_date_of_birth) directorData.date_of_birth = row.dir_date_of_birth
    if (row.dir_nationality) directorData.nationality = row.dir_nationality

    const { data, error } = await supabase
      .from('outreach.directors')
      .insert(directorData)
      .select()
      .single()

    if (error) throw error
    
    // If we have a company_number, create appointment link
    if (row.company_number) {
      const { error: appointmentError } = await supabase
        .from('outreach.director_appointments')
        .insert({
          director_id: data.id,
          company_number: row.company_number,
          role: row.dir_position || 'director',
        })
      // Ignore errors - appointment might already exist
      if (appointmentError && appointmentError.code !== '23505') {
        console.warn('Failed to create appointment:', appointmentError)
      }
    }
    
    return data
  },
}
