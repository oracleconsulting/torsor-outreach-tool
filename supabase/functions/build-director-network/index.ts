import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface BuildNetworkRequest {
  practiceId: string
  companyNumber: string
}

serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  }

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { practiceId, companyNumber }: BuildNetworkRequest = await req.json()

    if (!practiceId || !companyNumber) {
      return new Response(
        JSON.stringify({ error: 'practiceId and companyNumber are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // 1. Get company officers from Companies House
    const companiesHouseResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        action: 'getCompanyOfficers',
        companyNumber,
        includeResigned: false,
      }),
    })

    if (!companiesHouseResponse.ok) {
      throw new Error(`Failed to fetch officers: ${companiesHouseResponse.statusText}`)
    }

    const officers = await companiesHouseResponse.json()

    if (!officers || officers.length === 0) {
      return new Response(
        JSON.stringify({ networks: [], message: 'No officers found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Filter to active directors
    const activeDirectors = officers.filter(
      (o: any) =>
        !o.resigned_on &&
        ['director', 'llp member', 'secretary'].includes(o.officer_role?.toLowerCase() || '')
    )

    const networks: any[] = []

    for (const officer of activeDirectors) {
      // 2. Get or create director record
      let directorId: string

      const officerId = officer.links?.officer?.appointments?.split('/').pop()

      if (officerId) {
        // Check if director exists
        const { data: existing } = await supabase
          .from('outreach.directors')
          .select('id')
          .eq('officer_id', officerId)
          .single()

        if (existing) {
          directorId = existing.id
        } else {
          // Create new director
          const { data: newDirector, error } = await supabase
            .from('outreach.directors')
            .insert({
              officer_id: officerId,
              name: officer.name,
              date_of_birth: officer.date_of_birth?.month
                ? `${officer.date_of_birth.month}/${officer.date_of_birth.year}`
                : undefined,
              nationality: officer.nationality,
            })
            .select('id')
            .single()

          if (error) throw error
          directorId = newDirector.id
        }
      } else {
        // No officer ID, create by name only
        const { data: existing } = await supabase
          .from('outreach.directors')
          .select('id')
          .eq('name', officer.name)
          .is('officer_id', null)
          .single()

        if (existing) {
          directorId = existing.id
        } else {
          const { data: newDirector, error } = await supabase
            .from('outreach.directors')
            .insert({
              name: officer.name,
              date_of_birth: officer.date_of_birth?.month
                ? `${officer.date_of_birth.month}/${officer.date_of_birth.year}`
                : undefined,
              nationality: officer.nationality,
            })
            .select('id')
            .single()

          if (error) throw error
          directorId = newDirector.id
        }
      }

      // 3. Save current appointment
      await supabase.from('outreach.director_appointments').upsert(
        {
          director_id: directorId,
          company_number: companyNumber,
          role: officer.officer_role,
          appointed_on: officer.appointed_on,
          resigned_on: officer.resigned_on,
        },
        {
          onConflict: 'director_id,company_number,role',
        }
      )

      // 4. Get all appointments for this director
      let otherAppointments: any[] = []

      if (officer.links?.officer?.appointments) {
        try {
          const appointmentsResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              action: 'getOfficerAppointments',
              officerId: officer.links.officer.appointments,
            }),
          })

          if (appointmentsResponse.ok) {
            const appointmentsData = await appointmentsResponse.json()

            if (appointmentsData.items) {
              // Filter to active appointments excluding current client
              const activeAppointments = appointmentsData.items.filter(
                (a: any) =>
                  a.appointed_to?.company_number !== companyNumber && !a.resigned_on
              )

              // Get company details for each
              for (const appt of activeAppointments) {
                const companyNum = appt.appointed_to?.company_number
                if (!companyNum) continue

                try {
                  const companyResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    },
                    body: JSON.stringify({
                      action: 'getCompany',
                      companyNumber: companyNum,
                    }),
                  })

                  if (companyResponse.ok) {
                    const company = await companyResponse.json()

                    otherAppointments.push({
                      company_number: companyNum,
                      company_name: company.company_name || appt.appointed_to?.company_name || '',
                      role: appt.officer_role,
                      appointed_on: appt.appointed_on,
                      resigned_on: appt.resigned_on,
                      is_active: !appt.resigned_on,
                      sector: company.sic_codes?.[0],
                      status: company.company_status,
                    })

                    // Save appointment to database
                    await supabase.from('outreach.director_appointments').upsert(
                      {
                        director_id: directorId,
                        company_number: companyNum,
                        role: appt.officer_role,
                        appointed_on: appt.appointed_on,
                        resigned_on: appt.resigned_on,
                      },
                      {
                        onConflict: 'director_id,company_number,role',
                      }
                    )
                  }
                } catch (error) {
                  console.error(`Error fetching company ${companyNum}:`, error)
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching appointments for ${officer.name}:`, error)
        }
      }

      // 5. Store network connections
      for (const opp of otherAppointments.filter(
        (a) => a.is_active && a.status === 'active'
      )) {
        await supabase.from('outreach.director_networks').upsert(
          {
            practice_id: practiceId,
            source_company: companyNumber,
            target_company: opp.company_number,
            connection_type: 'direct',
            connecting_directors: [directorId],
            connection_strength: 1,
            target_company_name: opp.company_name,
            target_sector: opp.sector,
            last_updated: new Date().toISOString(),
          },
          {
            onConflict: 'practice_id,source_company,target_company',
          }
        )
      }

      networks.push({
        directorId,
        directorName: officer.name,
        appointments: otherAppointments,
        totalCompanies: otherAppointments.length + 1,
        activeCompanies: otherAppointments.filter((a) => a.is_active).length,
        yourClients: [companyNumber],
        opportunities: otherAppointments
          .filter((a) => a.is_active && a.status === 'active')
          .map((a) => ({
            company_number: a.company_number,
            company_name: a.company_name,
            connection_strength: 'direct',
            connection_path: [officer.name],
            source_client: companyNumber,
            connecting_directors: [directorId],
            sector: a.sector,
            status: a.status,
          })),
      })
    }

    return new Response(
      JSON.stringify({ networks, totalOpportunities: networks.reduce((sum, n) => sum + n.opportunities.length, 0) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

