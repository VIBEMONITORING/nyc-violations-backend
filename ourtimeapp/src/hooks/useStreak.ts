import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'
import { isToday, isYesterday, parseISO } from 'date-fns'

export function useStreak() {
  const { profile, incrementStreak, updateProfile } = useUserStore()

  const checkAndUpdateStreak = useCallback(async () => {
    if (!profile) return
    const lastDate = profile.last_activity_date
    const today = new Date().toISOString().split('T')[0]

    if (lastDate === today) return // Already updated today

    if (lastDate && isYesterday(parseISO(lastDate))) {
      // Extend streak
      const newStreak = profile.streak + 1
      incrementStreak()
      await supabase
        .from('profiles')
        .update({ streak: newStreak, last_activity_date: today })
        .eq('id', profile.id)
    } else if (!lastDate || !isToday(parseISO(lastDate))) {
      // Reset streak
      await supabase
        .from('profiles')
        .update({ streak: 1, last_activity_date: today })
        .eq('id', profile.id)
      await updateProfile({ streak: 1, last_activity_date: today })
    }
  }, [profile, incrementStreak, updateProfile])

  const isAtRisk = useCallback(() => {
    if (!profile?.last_activity_date) return false
    const today = new Date().toISOString().split('T')[0]
    return profile.last_activity_date !== today && profile.streak > 0
  }, [profile])

  return { checkAndUpdateStreak, isAtRisk: isAtRisk(), streak: profile?.streak ?? 0 }
}
