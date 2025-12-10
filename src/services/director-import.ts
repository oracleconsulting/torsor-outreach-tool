import { supabase } from '../lib/supabase'
import type { Director } from '../types/directors'

export interface DirectorCSVRow {
  // Required fields for matching
  name: string
  officer_id?: string
  company_number?: string // If provided, helps match to specific appointment
  
  // Address fields
  trading_address_line_1?: string
  trading_address_line_2?: string
  trading_locality?: string
  trading_region?: string
  trading_postal_code?: string
  trading_country?: string
  
  contact_address_line_1?: string
  contact_address_line_2?: string
  contact_locality?: string
  contact_region?: string
  contact_postal_code?: string
  contact_country?: string
  
  // Contact details
  email?: string
  phone?: string
  linkedin_url?: string
  preferred_contact_method?: 'email' | 'phone' | 'address' | 'linkedin'
}

export interface ImportResult {
  total: number
  matched: number
  updated: number
  created: number
  errors: Array<{ row: number; error: string; data: DirectorCSVRow }>
}

export const directorImport = {
  /**
   * Parse CSV file and import director addresses
   */
  async importFromCSV(
    file: File,
    practiceId: string
  ): Promise<ImportResult> {
    const result: ImportResult = {
      total: 0,
      matched: 0,
      updated: 0,
      created: 0,
      errors: [],
    }

    try {
      // Parse CSV
      const text = await file.text()
      const rows = this.parseCSV(text)
      result.total = rows.length

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        try {
          const directorRow = this.normalizeRow(row)
          
          // Find matching director
          const director = await this.findDirector(directorRow)
          
          if (director) {
            // Update existing director
            await this.updateDirectorAddress(director.id, directorRow, practiceId)
            result.matched++
            result.updated++
          } else {
            // Create new director if we have enough info
            if (directorRow.name) {
              await this.createDirectorWithAddress(directorRow, practiceId)
              result.created++
            } else {
              result.errors.push({
                row: i + 1,
                error: 'No matching director found and insufficient data to create new',
                data: directorRow,
              })
            }
          }
        } catch (error) {
          result.errors.push({
            row: i + 1,
            error: (error as Error).message,
            data: row as DirectorCSVRow,
          })
        }
      }

      return result
    } catch (error) {
      throw new Error(`CSV import failed: ${(error as Error).message}`)
    }
  },

  /**
   * Parse CSV text into rows
   */
  parseCSV(text: string): Record<string, string>[] {
    const lines = text.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return []

    // Parse header
    const headers = this.parseCSVLine(lines[0])
    const rows: Record<string, string>[] = []

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i])
      if (values.length === 0) continue

      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header.trim().toLowerCase()] = values[index]?.trim() || ''
      })
      rows.push(row)
    }

    return rows
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
   * Normalize CSV row to DirectorCSVRow format
   */
  normalizeRow(row: Record<string, string>): DirectorCSVRow {
    return {
      name: row.name || row.director_name || row.full_name || '',
      officer_id: row.officer_id || row.officerid || undefined,
      company_number: row.company_number || row.companynumber || undefined,
      
      trading_address_line_1: row.trading_address_line_1 || row.trading_address || row.business_address_line_1 || undefined,
      trading_address_line_2: row.trading_address_line_2 || row.business_address_line_2 || undefined,
      trading_locality: row.trading_locality || row.trading_city || row.business_city || undefined,
      trading_region: row.trading_region || row.trading_county || row.business_region || undefined,
      trading_postal_code: row.trading_postal_code || row.trading_postcode || row.business_postcode || undefined,
      trading_country: row.trading_country || row.business_country || 'United Kingdom',
      
      contact_address_line_1: row.contact_address_line_1 || row.contact_address || row.address_line_1 || undefined,
      contact_address_line_2: row.contact_address_line_2 || row.address_line_2 || undefined,
      contact_locality: row.contact_locality || row.contact_city || row.city || undefined,
      contact_region: row.contact_region || row.contact_county || row.county || undefined,
      contact_postal_code: row.contact_postal_code || row.contact_postcode || row.postcode || undefined,
      contact_country: row.contact_country || row.country || 'United Kingdom',
      
      email: row.email || row.email_address || undefined,
      phone: row.phone || row.phone_number || row.mobile || row.telephone || undefined,
      linkedin_url: row.linkedin_url || row.linkedin || row.linkedin_profile || undefined,
      preferred_contact_method: (row.preferred_contact_method || row.contact_method || 'email') as any,
    }
  },

  /**
   * Find director by name, officer_id, or company_number
   */
  async findDirector(row: DirectorCSVRow): Promise<Director | null> {
    // Try by officer_id first (most reliable)
    if (row.officer_id) {
      const { data } = await supabase
        .from('outreach.directors')
        .select('*')
        .eq('officer_id', row.officer_id)
        .single()
      
      if (data) return data
    }

    // Try by name + company_number (if provided)
    if (row.name && row.company_number) {
      // Find director through appointment
      const { data: appointment } = await supabase
        .from('outreach.director_appointments')
        .select('director_id, director:directors(*)')
        .eq('company_number', row.company_number)
        .ilike('director:directors.name', `%${row.name}%`)
        .single()
      
      if (appointment?.director) return appointment.director as Director
    }

    // Try by name only (fuzzy match)
    if (row.name) {
      const { data } = await supabase
        .from('outreach.directors')
        .select('*')
        .ilike('name', `%${row.name}%`)
        .limit(1)
        .single()
      
      if (data) return data
    }

    return null
  },

  /**
   * Update director with address information
   */
  async updateDirectorAddress(
    directorId: string,
    row: DirectorCSVRow,
    practiceId: string
  ): Promise<void> {
    const updateData: any = {
      address_source: 'csv_import',
      address_verified_at: new Date().toISOString(),
    }

    // Build trading address JSONB
    if (
      row.trading_address_line_1 ||
      row.trading_locality ||
      row.trading_postal_code
    ) {
      updateData.trading_address = {
        address_line_1: row.trading_address_line_1 || null,
        address_line_2: row.trading_address_line_2 || null,
        locality: row.trading_locality || null,
        region: row.trading_region || null,
        postal_code: row.trading_postal_code || null,
        country: row.trading_country || 'United Kingdom',
      }
    }

    // Build contact address JSONB
    if (
      row.contact_address_line_1 ||
      row.contact_locality ||
      row.contact_postal_code
    ) {
      updateData.contact_address = {
        address_line_1: row.contact_address_line_1 || null,
        address_line_2: row.contact_address_line_2 || null,
        locality: row.contact_locality || null,
        region: row.contact_region || null,
        postal_code: row.contact_postal_code || null,
        country: row.contact_country || 'United Kingdom',
      }
    }

    // Add contact details
    if (row.email) updateData.email = row.email
    if (row.phone) updateData.phone = row.phone
    if (row.linkedin_url) updateData.linkedin_url = row.linkedin_url
    if (row.preferred_contact_method) {
      updateData.preferred_contact_method = row.preferred_contact_method
    }

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
    practiceId: string
  ): Promise<Director> {
    const directorData: any = {
      name: row.name,
      officer_id: row.officer_id || undefined,
      address_source: 'csv_import',
      address_verified_at: new Date().toISOString(),
    }

    // Add addresses if provided
    if (
      row.trading_address_line_1 ||
      row.trading_locality ||
      row.trading_postal_code
    ) {
      directorData.trading_address = {
        address_line_1: row.trading_address_line_1 || null,
        address_line_2: row.trading_address_line_2 || null,
        locality: row.trading_locality || null,
        region: row.trading_region || null,
        postal_code: row.trading_postal_code || null,
        country: row.trading_country || 'United Kingdom',
      }
    }

    if (
      row.contact_address_line_1 ||
      row.contact_locality ||
      row.contact_postal_code
    ) {
      directorData.contact_address = {
        address_line_1: row.contact_address_line_1 || null,
        address_line_2: row.contact_address_line_2 || null,
        locality: row.contact_locality || null,
        region: row.contact_region || null,
        postal_code: row.contact_postal_code || null,
        country: row.contact_country || 'United Kingdom',
      }
    }

    // Add contact details
    if (row.email) directorData.email = row.email
    if (row.phone) directorData.phone = row.phone
    if (row.linkedin_url) directorData.linkedin_url = row.linkedin_url
    if (row.preferred_contact_method) {
      directorData.preferred_contact_method = row.preferred_contact_method
    }

    const { data, error } = await supabase
      .from('outreach.directors')
      .insert(directorData)
      .select()
      .single()

    if (error) throw error
    return data
  },
}

