import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const DATABASE_URL = Deno.env.get('DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL')!

interface ImportDirectorsRequest {
  practiceId: string
  directors: Array<{
    name: string
    company_number?: string
    company_name?: string
    trading_address?: any
    contact_address?: any
    email?: string
    phone?: string
    linkedin_url?: string
    preferred_contact_method?: string
    date_of_birth?: string
    nationality?: string
    address_source?: string
    address_verified_at?: string
  }>
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { practiceId, directors }: ImportDirectorsRequest = await req.json()

    if (!practiceId || !directors || directors.length === 0) {
      return new Response(
        JSON.stringify({ error: 'practiceId and directors array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    // Use Postgres client for direct database access
    const client = new Client(DATABASE_URL)
    await client.connect()

    try {
      for (let i = 0; i < directors.length; i++) {
        const director = directors[i]
        
        try {
          if (!director.name) {
            results.errors.push({ index: i, error: 'Director name is required' })
            continue
          }

          // Find existing director by name
          const findResult = await client.queryObject<{ id: string }>(
            `SELECT id FROM outreach.directors WHERE name = $1 LIMIT 1`,
            [director.name]
          )

          const directorId = findResult.rows.length > 0 ? findResult.rows[0].id : null

          const directorData: any = {
            name: director.name,
            address_source: director.address_source || 'csv_import',
            address_verified_at: director.address_verified_at || new Date().toISOString(),
          }

          if (director.trading_address) {
            directorData.trading_address = JSON.stringify(director.trading_address)
          }

          if (director.contact_address) {
            directorData.contact_address = JSON.stringify(director.contact_address)
          }

          if (director.email) directorData.email = director.email
          if (director.phone) directorData.phone = director.phone
          if (director.linkedin_url) directorData.linkedin_url = director.linkedin_url
          if (director.preferred_contact_method) {
            directorData.preferred_contact_method = director.preferred_contact_method
          }
          if (director.date_of_birth) directorData.date_of_birth = director.date_of_birth
          if (director.nationality) directorData.nationality = director.nationality

          if (directorId) {
            // Update existing
            const updateFields = Object.keys(directorData)
              .map((key, idx) => `${key} = $${idx + 2}`)
              .join(', ')
            
            await client.queryObject(
              `UPDATE outreach.directors SET ${updateFields} WHERE id = $1`,
              [directorId, ...Object.values(directorData)]
            )
            results.updated++
          } else {
            // Create new
            const insertFields = Object.keys(directorData).join(', ')
            const insertValues = Object.keys(directorData)
              .map((_, idx) => `$${idx + 1}`)
              .join(', ')
            
            const insertResult = await client.queryObject<{ id: string }>(
              `INSERT INTO outreach.directors (${insertFields}) VALUES (${insertValues}) RETURNING id`,
              Object.values(directorData)
            )

            const newDirectorId = insertResult.rows[0].id

            // Create appointment if company_number provided
            if (director.company_number && newDirectorId) {
              await client.queryObject(
                `INSERT INTO outreach.director_appointments (director_id, company_number, role, is_active)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (director_id, company_number, role) DO NOTHING`,
                [newDirectorId, director.company_number, 'director', true]
              ).catch(() => {
                // Ignore errors
              })
            }
            results.created++
          }
        } catch (error) {
          results.errors.push({
            index: i,
            error: (error as Error).message,
          })
        }
      }
    } finally {
      await client.end()
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error importing directors:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
