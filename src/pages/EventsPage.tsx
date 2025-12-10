import { useState } from 'react'
import { usePendingEvents, useEventsByType, useDetectEvents } from '../hooks/useWatchlist'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useEffect } from 'react'
import { Calendar, Users, Building2, AlertCircle, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useGenerateOutreach } from '../hooks/useOutreach'
import { OutreachGenerator } from '../components/outreach/OutreachGenerator'

export function EventsPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showGenerator, setShowGenerator] = useState(false)

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

  const { data: allEvents } = usePendingEvents(practiceId)
  const { data: eventsByType } = useEventsByType(practiceId, selectedType)
  const detectEvents = useDetectEvents()
  const generateOutreach = useGenerateOutreach()

  const events = selectedType === 'all' ? allEvents : eventsByType

  const eventTypeCounts = {
    all: allEvents?.length || 0,
    accounts_overdue: allEvents?.filter((e) => e.event_type === 'accounts_overdue').length || 0,
    director_change: allEvents?.filter((e) => e.event_type === 'director_change').length || 0,
    anniversary: allEvents?.filter((e) => e.event_type === 'anniversary').length || 0,
  }

  const handleDetectEvents = async () => {
    if (!practiceId) return
    try {
      const result = await detectEvents.mutateAsync(practiceId)
      toast.success(`Checked ${result.checked} companies, found ${result.eventsDetected} events`)
    } catch (error: any) {
      toast.error('Error detecting events: ' + error.message)
    }
  }

  const handleGenerateDraft = (event: any) => {
    setSelectedEvent(event)
    setShowGenerator(true)
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'accounts_overdue':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'director_change':
        return <Users className="h-5 w-5 text-blue-500" />
      case 'anniversary':
        return <Calendar className="h-5 w-5 text-green-500" />
      default:
        return <Building2 className="h-5 w-5 text-gray-500" />
    }
  }

  const getEventLabel = (type: string) => {
    switch (type) {
      case 'accounts_overdue':
        return 'Accounts Overdue'
      case 'director_change':
        return 'Director Change'
      case 'anniversary':
        return 'Anniversary'
      default:
        return type
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Event-Triggered Outreach</h1>
          <p className="text-gray-600 mt-2">Recent events detected in your watchlist</p>
        </div>
        <button
          onClick={handleDetectEvents}
          disabled={detectEvents.isPending}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {detectEvents.isPending ? 'Detecting...' : 'Detect Events Now'}
        </button>
      </div>

      {/* Event Type Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setSelectedType('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            selectedType === 'all'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All ({eventTypeCounts.all})
        </button>
        <button
          onClick={() => setSelectedType('accounts_overdue')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            selectedType === 'accounts_overdue'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Accounts Overdue ({eventTypeCounts.accounts_overdue})
        </button>
        <button
          onClick={() => setSelectedType('director_change')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            selectedType === 'director_change'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Director Changes ({eventTypeCounts.director_change})
        </button>
        <button
          onClick={() => setSelectedType('anniversary')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            selectedType === 'anniversary'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Anniversaries ({eventTypeCounts.anniversary})
        </button>
      </div>

      {/* Events Table */}
      {!events || events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No pending events. Add companies to your watchlist to start tracking events.
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Triggered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {events.map((event: any) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{event.company?.company_name || event.company_number}</div>
                    <div className="text-sm text-gray-500">{event.company_number}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.event_type)}
                      <span className="text-sm font-medium">{getEventLabel(event.event_type)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <EventDetails event={event} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(event.triggered_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleGenerateDraft(event)}
                        disabled={generateOutreach.isPending}
                        className="flex items-center gap-1 px-3 py-1 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                      >
                        <Sparkles className="h-3 w-3" />
                        Draft
                      </button>
                      <button
                        className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                      >
                        Skip
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outreach Generator Modal */}
      {showGenerator && selectedEvent && practiceId && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => {
                setShowGenerator(false)
                setSelectedEvent(null)
              }}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-6 py-4 border-b flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  Generate Outreach for {selectedEvent.company?.company_name || selectedEvent.company_number}
                </h2>
                <button
                  onClick={() => {
                    setShowGenerator(false)
                    setSelectedEvent(null)
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                <OutreachGenerator
                  practiceId={practiceId}
                  companyNumber={selectedEvent.company_number}
                  companyName={selectedEvent.company?.company_name || selectedEvent.company_number}
                  triggerEvent={selectedEvent}
                  onDraftGenerated={(draft) => {
                    toast.success('Draft generated!')
                    // Optionally mark event as handled
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EventDetails({ event }: { event: any }) {
  const data = event.event_data || {}

  if (event.event_type === 'accounts_overdue') {
    return (
      <div className="text-sm">
        <div className="font-medium text-red-600">{data.daysOverdue} days overdue</div>
        <div className="text-gray-500">Due: {new Date(data.dueDate).toLocaleDateString()}</div>
      </div>
    )
  }

  if (event.event_type === 'director_change') {
    return (
      <div className="text-sm space-y-1">
        {data.changes?.map((change: any, idx: number) => (
          <div key={idx}>
            <span className="font-medium">{change.name}</span> - {change.type === 'appointment' ? 'Appointed' : 'Resigned'} as {change.role}
          </div>
        ))}
      </div>
    )
  }

  if (event.event_type === 'anniversary') {
    return (
      <div className="text-sm">
        <div className="font-medium text-green-600">{data.years} year anniversary</div>
        <div className="text-gray-500">Incorporated: {new Date(data.incorporationDate).toLocaleDateString()}</div>
      </div>
    )
  }

  return <div className="text-sm text-gray-500">{JSON.stringify(data)}</div>
}

