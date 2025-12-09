import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface DetectEventsRequest {
  practiceId: string
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
    const { practiceId }: DetectEventsRequest = await req.json()

    if (!practiceId) {
      return new Response(
        JSON.stringify({ error: 'practiceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Get all watched companies
    const { data: watchlist, error: watchlistError } = await supabase
      .from('outreach.watchlist')
      .select('*')
      .eq('practice_id', practiceId)
      .eq('is_active', true)

    if (watchlistError) throw watchlistError

    if (!watchlist || watchlist.length === 0) {
      return new Response(
        JSON.stringify({ checked: 0, eventsDetected: 0, events: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const detectedEvents: any[] = []

    for (const item of watchlist) {
      try {
        // Get company profile
        const companyResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
          body: JSON.stringify({
            action: 'getCompany',
            companyNumber: item.company_number,
          }),
        })

        if (!companyResponse.ok) continue

        const company = await companyResponse.json()

        // Check each event type
        for (const eventType of item.events_to_watch || []) {
          let event: any = null

          switch (eventType) {
            case 'accounts_overdue': {
              const dueDate = company.accounts?.next_due
              if (dueDate && new Date(dueDate) < new Date()) {
                const daysOverdue = Math.floor(
                  (Date.now() - new Date(dueDate).getTime()) / (1000 * 60 * 60 * 24)
                )

                // Check if we already triggered this
                const { data: existing } = await supabase
                  .from('outreach.triggered_events')
                  .select('id')
                  .eq('practice_id', practiceId)
                  .eq('company_number', item.company_number)
                  .eq('event_type', 'accounts_overdue')
                  .eq('outreach_status', 'pending')
                  .single()

                if (!existing) {
                  event = {
                    practice_id: practiceId,
                    company_number: item.company_number,
                    event_type: 'accounts_overdue',
                    event_data: {
                      dueDate,
                      daysOverdue,
                      companyName: company.company_name,
                    },
                  }
                }
              }
              break
            }

            case 'director_change': {
              const officersResponse = await fetch(`${SUPABASE_URL}/functions/v1/companies-house`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                },
                body: JSON.stringify({
                  action: 'getCompanyOfficers',
                  companyNumber: item.company_number,
                  includeResigned: true,
                }),
              })

              if (officersResponse.ok) {
                const officers = await officersResponse.json()
                const sevenDaysAgo = new Date()
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

                const recentChanges = officers.filter((o: any) => {
                  const date = o.appointed_on || o.resigned_on
                  return date && new Date(date) > sevenDaysAgo
                })

                if (recentChanges.length > 0) {
                  const { data: existing } = await supabase
                    .from('outreach.triggered_events')
                    .select('id')
                    .eq('practice_id', practiceId)
                    .eq('company_number', item.company_number)
                    .eq('event_type', 'director_change')
                    .gte('triggered_at', sevenDaysAgo.toISOString())
                    .single()

                  if (!existing) {
                    event = {
                      practice_id: practiceId,
                      company_number: item.company_number,
                      event_type: 'director_change',
                      event_data: {
                        changes: recentChanges.map((o: any) => ({
                          name: o.name,
                          role: o.officer_role,
                          type: o.resigned_on ? 'resignation' : 'appointment',
                          date: o.appointed_on || o.resigned_on,
                        })),
                        companyName: company.company_name,
                      },
                    }
                  }
                }
              }
              break
            }

            case 'anniversary': {
              const incDate = company.date_of_creation || company.incorporation_date
              if (incDate) {
                const years = Math.floor(
                  (Date.now() - new Date(incDate).getTime()) / (1000 * 60 * 60 * 24 * 365)
                )

                const incDateObj = new Date(incDate)
                const today = new Date()
                const dayOfYear = Math.floor(
                  (incDateObj.getTime() - new Date(incDateObj.getFullYear(), 0, 0).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
                const todayDayOfYear = Math.floor(
                  (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
                    (1000 * 60 * 60 * 24)
                )

                // Check if anniversary is within next 7 days
                if (Math.abs(dayOfYear - todayDayOfYear) <= 7 && years >= 1) {
                  // Only trigger on milestone years
                  if ([1, 3, 5, 10, 15, 20, 25, 30, 40, 50].includes(years)) {
                    const { data: existing } = await supabase
                      .from('outreach.triggered_events')
                      .select('id')
                      .eq('practice_id', practiceId)
                      .eq('company_number', item.company_number)
                      .eq('event_type', 'anniversary')
                      .eq('event_data->>years', years.toString())
                      .single()

                    if (!existing) {
                      event = {
                        practice_id: practiceId,
                        company_number: item.company_number,
                        event_type: 'anniversary',
                        event_data: {
                          years,
                          incorporationDate: incDate,
                          companyName: company.company_name,
                        },
                      }
                    }
                  }
                }
              }
              break
            }
          }

          if (event) {
            detectedEvents.push(event)
          }
        }

        // Update last checked
        await supabase
          .from('outreach.watchlist')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', item.id)
      } catch (error) {
        console.error(`Error checking ${item.company_number}:`, error)
      }
    }

    // Insert detected events
    if (detectedEvents.length > 0) {
      await supabase.from('outreach.triggered_events').insert(detectedEvents)
    }

    return new Response(
      JSON.stringify({
        checked: watchlist.length,
        eventsDetected: detectedEvents.length,
        events: detectedEvents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

