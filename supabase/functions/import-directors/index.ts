import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const results = {
      created: 0,
      updated: 0,
      errors: [] as Array<{ index: number; error: string }>,
    }

    for (let i = 0; i < directors.length; i++) {
      const director = directors[i]
      
      try {
        if (!director.name) {
          results.errors.push({ index: i, error: 'Director name is required' })
          continue
        }

        // Find existing director - try direct query with service role (should work in Edge Functions)
        let directorId: string | null = null
        
        const { data: existing, error: findError } = await supabase
          .from('outreach.directors')
          .select('id')
          .eq('name', director.name)
          .limit(1)
          .maybeSingle()

        if (existing && !findError) {
          directorId = existing.id
        }

        const directorData: any = {
          name: director.name,
          address_source: director.address_source || 'csv_import',
          address_verified_at: director.address_verified_at || new Date().toISOString(),
        }

        if (director.trading_address) {
          directorData.trading_address = director.trading_address
        }

        if (director.contact_address) {
          directorData.contact_address = director.contact_address
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
          // Update existing - try using outreach.directors syntax with service role
          const { error: updateError } = await supabase
            .from('outreach.directors')
            .update(directorData)
            .eq('id', directorId)

          if (updateError) {
            throw updateError
          }
          results.updated++
        } else {
          // Create new
          const { data: newDirector, error: createError } = await supabase
            .from('outreach.directors')
            .insert(directorData)
            .select()
            .single()

          let newDirectorId: string | null = null

          if (createError) {
            throw createError
          }
          
          newDirectorId = newDirector.id

          // Create appointment if company_number provided
          if (director.company_number && newDirectorId) {
            await supabase
              .from('outreach.director_appointments')
              .insert({
                director_id: newDirectorId,
                company_number: director.company_number,
                role: 'director',
                is_active: true,
              })
              .catch(() => {
                // Ignore duplicate appointment errors
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
