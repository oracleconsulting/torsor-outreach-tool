import { Link, useLocation } from '@tanstack/react-router'
import { Building2, Search, MapPin, Users, Shield, History } from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Building2 },
  { path: '/firm-search', label: 'Firm Search', icon: Search },
  { path: '/address-search', label: 'Address Search', icon: MapPin },
  { path: '/prospects', label: 'Prospects', icon: Users },
  { path: '/covenants', label: 'Covenants', icon: Shield },
  { path: '/history', label: 'History', icon: History },
]

export function Navigation() {
  const location = useLocation()

  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              <span className="font-semibold text-lg">Torsor Outreach</span>
            </Link>
            
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

