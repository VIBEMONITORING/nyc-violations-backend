import { useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'

export function useHeartbeat() {
  const { profile, fetchPendingSurprises } = useUserStore()

  const refresh = useCallback(() => {
    fetchPendingSurprises()
  }, [fetchPendingSurprises])

  useEffect(() => {
    if (!profile?.id) return

    refresh()

    const channel = supabase
      .channel(`activities:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
          filter: `scheduled_for=eq.${profile.id}`,
        },
        () => refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, refresh])
}
