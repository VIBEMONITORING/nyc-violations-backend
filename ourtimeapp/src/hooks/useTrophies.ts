import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'
import type { Trophy } from '../types'

export function useTrophies() {
  const { profile } = useUserStore()
  const [newTrophy, setNewTrophy] = useState<Trophy | null>(null)

  const checkTrophies = useCallback(async () => {
    if (!profile) return
    try {
      const { data } = await supabase.rpc('check_trophies', { p_user_id: profile.id })
      if (data && data.length > 0) {
        setNewTrophy(data[0])
        return data[0]
      }
    } catch {
      // RPC not available yet, skip
    }
    return null
  }, [profile])

  const dismissTrophy = useCallback(() => setNewTrophy(null), [])

  return { checkTrophies, newTrophy, dismissTrophy }
}
