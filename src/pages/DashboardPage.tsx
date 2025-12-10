import { useState, useEffect } from 'react'
import { Building2, Search, MapPin, Users, Bell, Network } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useProspectStats } from '../hooks/useProspects'
import { useAuth } from '../hooks/useAuth'
import { usePendingEvents } from '../hooks/useWatchlist'
import { supabase } from '../lib/supabase'

export function DashboardPage() {
  const { user } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()
  const { data: stats } = useProspectStats(practiceId)
  const { data: pendingEvents } = usePendingEvents(practiceId)

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Discover potential clients through Companies House data mining
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Prospects"
          value={stats?.total.toString() || '0'}
          icon={Users}
        />
        <StatCard
          title="New This Week"
          value="0"
          icon={Building2}
        />
        <StatCard
          title="Average Score"
          value={stats?.averageScore.toFixed(1) || '0'}
          icon={Search}
        />
        <StatCard
          title="Conversion Rate"
          value={`${stats?.conversionRate.toFixed(1) || '0'}%`}
          icon={MapPin}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <QuickActionCard
          title="Search by Firm"
          description="Enter an accounting firm's company number to discover all companies at their address"
          href="/firm-search"
          icon={Search}
        />
        <QuickActionCard
          title="Search by Address"
          description="Search for companies by postcode or address to find potential clients"
          href="/address-search"
          icon={MapPin}
        />
        <QuickActionCard
          title="Event-Triggered Outreach"
          description={`Monitor companies for trigger events (accounts overdue, director changes, anniversaries). ${pendingEvents && pendingEvents.length > 0 ? `${pendingEvents.length} pending events.` : ''}`}
          href="/events"
          icon={Bell}
          badge={pendingEvents && pendingEvents.length > 0 ? pendingEvents.length : undefined}
        />
        <QuickActionCard
          title="Director Network"
          description="Discover warm introduction opportunities through shared directors with your existing clients"
          href="/network"
          icon={Network}
        />
      </div>
    </div>
  )
}

function StatCard({ title, value, icon: Icon }: { title: string; value: string; icon: any }) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  )
}

function QuickActionCard({ title, description, href, icon: Icon, badge }: any) {
  return (
    <Link
      to={href}
      className="bg-white rounded-lg border p-6 hover:border-primary hover:shadow-md transition-all relative"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{title}</h3>
            {badge && badge > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-1">{description}</p>
        </div>
      </div>
    </Link>
  )
}
