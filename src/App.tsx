import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet, redirect, useLocation } from '@tanstack/react-router'
import { Navigation } from './components/layout/Navigation'
import { Toaster } from './components/ui/Toaster'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { FirmSearchPage } from './pages/FirmSearchPage'
import { AddressSearchPage } from './pages/AddressSearchPage'
import { ProspectsPage } from './pages/ProspectsPage'
import { CovenantsPage } from './pages/CovenantsPage'
import { SearchHistoryPage } from './pages/SearchHistoryPage'
import { EventsPage } from './pages/EventsPage'
import { supabase } from './lib/supabase'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

// Helper to check authentication
async function checkAuth(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    return !!session
  } catch {
    return false
  }
}

// Root route with layout
const rootRoute = createRootRoute({
  component: () => {
    return <RootComponent />
  },
})

function RootComponent() {
  const location = useLocation()
  // Don't show navigation on login page
  if (location.pathname === '/login') {
    return <Outlet />
  }
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

// Login route (standalone, no navigation)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: () => <LoginPage />,
  beforeLoad: async () => {
    const authenticated = await checkAuth()
    if (authenticated) {
      throw redirect({ to: '/' })
    }
  },
})

// Protected route helper
const requireAuth = async () => {
  const authenticated = await checkAuth()
  if (!authenticated) {
    throw redirect({ to: '/login' })
  }
}

// Define routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
  beforeLoad: requireAuth,
})

const firmSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/firm-search',
  component: FirmSearchPage,
  beforeLoad: requireAuth,
})

const addressSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/address-search',
  component: AddressSearchPage,
  beforeLoad: requireAuth,
})

const prospectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prospects',
  component: ProspectsPage,
  beforeLoad: requireAuth,
})

const covenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/covenants',
  component: CovenantsPage,
  beforeLoad: requireAuth,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: SearchHistoryPage,
  beforeLoad: requireAuth,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  loginRoute,
  indexRoute,
  firmSearchRoute,
  addressSearchRoute,
  prospectsRoute,
  covenantsRoute,
  historyRoute,
])

// Create router
const router = createRouter({ routeTree })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  )
}

