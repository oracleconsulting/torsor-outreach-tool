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

        // Use REST API directly with schema in URL path
        // This bypasses PostgREST's schema-qualified table name limitation
        const restUrl = `${SUPABASE_URL}/rest/v1`
        const headers = {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.pgjson.object+json',
          'Prefer': 'return=representation',
        }

        // Find existing director using REST API with schema header
        const findResponse = await fetch(
          `${restUrl}/directors?name=eq.${encodeURIComponent(director.name)}&select=id&limit=1`,
          {
            headers: {
              ...headers,
              'Accept-Profile': 'outreach', // This tells PostgREST to use the outreach schema
            },
          }
        )

        let directorId: string | null = null
        if (findResponse.ok) {
          const existing = await findResponse.json()
          if (Array.isArray(existing) && existing.length > 0) {
            directorId = existing[0].id
          } else if (existing && existing.id) {
            directorId = existing.id
          }
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
          // Update existing
          const updateResponse = await fetch(
            `${restUrl}/directors?id=eq.${directorId}`,
            {
              method: 'PATCH',
              headers: {
                ...headers,
                'Accept-Profile': 'outreach',
                'Content-Profile': 'outreach',
              },
              body: JSON.stringify(directorData),
            }
          )

          if (!updateResponse.ok) {
            const errorText = await updateResponse.text()
            throw new Error(`Update failed: ${errorText}`)
          }
          results.updated++
        } else {
          // Create new
          const createResponse = await fetch(
            `${restUrl}/directors`,
            {
              method: 'POST',
              headers: {
                ...headers,
                'Accept-Profile': 'outreach',
                'Content-Profile': 'outreach',
              },
              body: JSON.stringify(directorData),
            }
          )

          if (!createResponse.ok) {
            const errorText = await createResponse.text()
            throw new Error(`Create failed: ${errorText}`)
          }

          const newDirector = await createResponse.json()
          directorId = Array.isArray(newDirector) ? newDirector[0]?.id : newDirector?.id

          // Create appointment if company_number provided
          if (director.company_number && directorId) {
            await fetch(
              `${restUrl}/director_appointments`,
              {
                method: 'POST',
                headers: {
                  ...headers,
                  'Accept-Profile': 'outreach',
                  'Content-Profile': 'outreach',
                },
                body: JSON.stringify({
                  director_id: directorId,
                  company_number: director.company_number,
                  role: 'director',
                  is_active: true,
                }),
              }
            ).catch(() => {
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
