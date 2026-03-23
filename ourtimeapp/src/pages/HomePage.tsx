import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserStore } from '../stores/useUserStore'
import { LoadingScreen } from '../components/LoadingScreen'
import { ActiveHomePage } from './ActiveHomePage'
import { ReceiverHomePage } from './ReceiverHomePage'

export function HomePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { profile, fetchProfile, loading } = useUserStore()

  useEffect(() => {
    if (user && !profile) {
      fetchProfile(user.id)
    }
  }, [user, profile, fetchProfile])

  useEffect(() => {
    if (!loading && profile && !profile.partner_id) {
      // Still usable without partner
    }
  }, [loading, profile, navigate])

  if (loading || !profile) return <LoadingScreen />

  if (profile.mode === 'receiver') return <ReceiverHomePage />
  return <ActiveHomePage />
}
