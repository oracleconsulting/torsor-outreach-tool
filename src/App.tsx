import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router'
import { Navigation } from './components/layout/Navigation'
import { DashboardPage } from './pages/DashboardPage'
import { FirmSearchPage } from './pages/FirmSearchPage'
import { AddressSearchPage } from './pages/AddressSearchPage'
import { ProspectsPage } from './pages/ProspectsPage'
import { CovenantsPage } from './pages/CovenantsPage'
import { SearchHistoryPage } from './pages/SearchHistoryPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

// Root route with layout
const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  ),
})

// Define routes
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: DashboardPage,
})

const firmSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/firm-search',
  component: FirmSearchPage,
})

const addressSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/address-search',
  component: AddressSearchPage,
})

const prospectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/prospects',
  component: ProspectsPage,
})

const covenantsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/covenants',
  component: CovenantsPage,
})

const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/history',
  component: SearchHistoryPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
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
    </QueryClientProvider>
  )
}

