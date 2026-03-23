import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/useAuthStore'
import { useUserStore } from './stores/useUserStore'
import { LoadingScreen } from './components/LoadingScreen'

import { SplashPage } from './pages/SplashPage'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { HomePage } from './pages/HomePage'
import { ListPage } from './pages/ListPage'
import { AddItemPage } from './pages/AddItemPage'
import { TrophiesPage } from './pages/TrophiesPage'
import { LeaderboardPage } from './pages/LeaderboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { SurprisesPage } from './pages/SurprisesPage'
import { HistoryPage } from './pages/HistoryPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuthStore()
  if (loading) return <LoadingScreen />
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { initialize, loading } = useAuthStore()
  const { fetchProfile } = useUserStore()
  const { session } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    if (session?.user?.id) {
      fetchProfile(session.user.id)
    }
  }, [session?.user?.id, fetchProfile])

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/" element={<SplashPage />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route
        path="/onboarding"
        element={
          <AuthGuard>
            <OnboardingPage />
          </AuthGuard>
        }
      />
      <Route
        path="/home"
        element={
          <AuthGuard>
            <HomePage />
          </AuthGuard>
        }
      />
      <Route
        path="/list"
        element={
          <AuthGuard>
            <ListPage />
          </AuthGuard>
        }
      />
      <Route
        path="/list/add"
        element={
          <AuthGuard>
            <AddItemPage />
          </AuthGuard>
        }
      />
      <Route
        path="/trophies"
        element={
          <AuthGuard>
            <TrophiesPage />
          </AuthGuard>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <AuthGuard>
            <LeaderboardPage />
          </AuthGuard>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGuard>
            <SettingsPage />
          </AuthGuard>
        }
      />
      <Route
        path="/surprises"
        element={
          <AuthGuard>
            <SurprisesPage />
          </AuthGuard>
        }
      />
      <Route
        path="/history"
        element={
          <AuthGuard>
            <HistoryPage />
          </AuthGuard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              borderRadius: '16px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              fontWeight: '500',
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
