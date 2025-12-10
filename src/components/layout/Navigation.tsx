import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Building2, Search, MapPin, Users, Shield, History, LogOut, Bell, Network } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { usePendingEvents } from '../../hooks/useWatchlist'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Building2 },
  { path: '/firm-search', label: 'Firm Search', icon: Search },
  { path: '/address-search', label: 'Address Search', icon: MapPin },
  { path: '/prospects', label: 'Prospects', icon: Users },
  { path: '/covenants', label: 'Covenants', icon: Shield },
  { path: '/history', label: 'History', icon: History },
  { path: '/events', label: 'Events', icon: Bell },
  { path: '/network', label: 'Network', icon: Network },
]

export function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [practiceId, setPracticeId] = useState<string | undefined>()

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

  const { data: pendingEvents } = usePendingEvents(practiceId)
  const eventCount = pendingEvents?.length || 0

  const handleSignOut = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Torsor Outreach</span>
            </Link>
            
            <div className="flex items-center gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                const isEvents = item.path === '/events'
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative whitespace-nowrap ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                    {isEvents && eventCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {eventCount > 9 ? '9+' : eventCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 hidden sm:inline">
                  {user.email}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

