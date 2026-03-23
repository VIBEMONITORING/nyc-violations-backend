import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'
import type { PointAction } from '../types'
import { POINT_VALUES, STREAK_MULTIPLIERS } from '../types'

export function usePoints() {
  const { profile, addPoints } = useUserStore()

  const getMultiplier = useCallback(() => {
    if (!profile) return 1
    if (profile.streak >= 30) return STREAK_MULTIPLIERS.thirty_days
    if (profile.streak >= 7) return STREAK_MULTIPLIERS.seven_days
    return 1
  }, [profile])

  const awardPoints = useCallback(async (action: PointAction): Promise<number> => {
    if (!profile) return 0
    const base = POINT_VALUES[action]
    const multiplier = getMultiplier()
    const final = Math.round(base * multiplier)

    // Update local state immediately
    addPoints(final)

    // Update DB
    await supabase
      .from('profiles')
      .update({ points: profile.points + final, updated_at: new Date().toISOString() })
      .eq('id', profile.id)

    // Haptics feedback
    if (profile.haptics_enabled && navigator.vibrate) {
      navigator.vibrate(action === 'thank_you_received' ? [100, 50, 100] : 50)
    }

    return final
  }, [profile, addPoints, getMultiplier])

  return { awardPoints, getMultiplier, currentMultiplier: getMultiplier() }
}
