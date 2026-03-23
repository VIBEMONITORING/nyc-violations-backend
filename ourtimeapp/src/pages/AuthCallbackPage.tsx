import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingScreen } from '../components/LoadingScreen'

export function AuthCallbackPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          navigate('/home', { replace: true })
        } else {
          navigate('/onboarding', { replace: true })
        }
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [navigate])

  return <LoadingScreen />
}
