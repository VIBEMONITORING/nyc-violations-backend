import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUserStore } from '../stores/useUserStore'
import { BottomNav } from '../components/BottomNav'
import { StreakBadge } from '../components/StreakBadge'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry } from '../types'
import { startOfWeek } from 'date-fns'

export function LeaderboardPage() {
  const { profile } = useUserStore()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const weekStart = startOfWeek(new Date()).toISOString().split('T')[0]
    supabase
      .from('leaderboard_weekly')
      .select('*, profile:profiles(display_name, username, avatar_url, streak)')
      .eq('week_start', weekStart)
      .order('points', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setEntries(data ?? [])
        setLoading(false)
      })
  }, [])

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="app-container flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className="px-6 pt-14 pb-4 safe-top bg-gradient-to-b from-amber-50 to-white">
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Leaderboard 🏆
          </h1>
          <p className="text-gray-500 text-sm mt-1">This week's top planners</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏆</div>
            <p className="text-gray-500 font-medium">No data yet this week</p>
            <p className="text-gray-400 text-sm mt-1">Start earning points to appear here!</p>
          </div>
        ) : (
          <div className="px-4 space-y-2">
            {entries.map((entry, i) => {
              const isMe = entry.user_id === profile?.id
              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`flex items-center gap-4 p-4 rounded-2xl border ${
                    isMe
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="w-8 text-center">
                    {i < 3 ? (
                      <span className="text-2xl">{medals[i]}</span>
                    ) : (
                      <span className="text-gray-400 font-bold">{i + 1}</span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-white font-bold">
                    {(entry.profile as any)?.display_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      {(entry.profile as any)?.display_name ?? 'Unknown'}
                      {isMe && <span className="ml-2 text-xs text-amber-600 font-medium">You</span>}
                    </div>
                    <StreakBadge streak={(entry.profile as any)?.streak ?? 0} size="sm" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#FFB800]">{entry.points}</div>
                    <div className="text-xs text-gray-400">pts</div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  )
}
