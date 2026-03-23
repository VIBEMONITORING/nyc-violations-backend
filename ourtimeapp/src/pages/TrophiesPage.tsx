import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUserStore } from '../stores/useUserStore'
import { BottomNav } from '../components/BottomNav'
import { supabase } from '../lib/supabase'
import type { Trophy, UserTrophy } from '../types'
import { Lock } from 'lucide-react'

const ALL_TROPHIES: Trophy[] = [
  // Tier 1
  { id: 'first_spark', name: 'First Spark', emoji: '💕', description: 'Earn your first points', requirement_type: 'points', requirement_value: 1, points_awarded: 20, tier: 1, is_secret: false },
  { id: 'followed_through', name: 'Followed Through', emoji: '✨', description: 'Complete your first activity', requirement_type: 'activities_completed', requirement_value: 1, points_awarded: 20, tier: 1, is_secret: false },
  { id: 'memory_keeper', name: 'Memory Keeper', emoji: '📝', description: 'Add 3 items to the memory list', requirement_type: 'list_items', requirement_value: 3, points_awarded: 20, tier: 1, is_secret: false },
  // Tier 2
  { id: 'on_fire', name: 'On Fire', emoji: '🔥', description: 'Maintain a 7-day streak', requirement_type: 'streak', requirement_value: 7, points_awarded: 20, tier: 2, is_secret: false },
  { id: 'good_listener', name: 'Good Listener', emoji: '👀', description: 'Add 10 items to the list', requirement_type: 'list_items', requirement_value: 10, points_awarded: 20, tier: 2, is_secret: false },
  { id: 'pamper_pro', name: 'Pamper Pro', emoji: '💆', description: 'Book 3 experience activities', requirement_type: 'experiences_booked', requirement_value: 3, points_awarded: 20, tier: 2, is_secret: false },
  { id: 'date_planner', name: 'Date Planner', emoji: '🍷', description: 'Schedule 5 activities', requirement_type: 'activities_scheduled', requirement_value: 5, points_awarded: 20, tier: 2, is_secret: false },
  // Tier 3
  { id: 'week_warrior', name: 'Week Warrior', emoji: '🔥', description: 'Earn 500 points', requirement_type: 'points', requirement_value: 500, points_awarded: 20, tier: 3, is_secret: false },
  { id: 'bullseye', name: 'Bullseye', emoji: '🎯', description: 'Book 5 items from the list', requirement_type: 'from_list_booked', requirement_value: 5, points_awarded: 20, tier: 3, is_secret: false },
  { id: 'gift_giver', name: 'Gift Giver', emoji: '🎁', description: 'Buy 3 gifts from the list', requirement_type: 'gifts_bought', requirement_value: 3, points_awarded: 20, tier: 3, is_secret: false },
  { id: 'hopeless_romantic', name: 'Hopeless Romantic', emoji: '💝', description: 'Earn 1000 points', requirement_type: 'points', requirement_value: 1000, points_awarded: 20, tier: 3, is_secret: false },
  // Tier 4
  { id: 'committed', name: 'Committed', emoji: '💪', description: 'Maintain a 30-day streak', requirement_type: 'streak', requirement_value: 30, points_awarded: 20, tier: 4, is_secret: false },
  { id: 'mind_reader', name: 'Mind Reader', emoji: '💝', description: 'Book 10 items from the list', requirement_type: 'from_list_booked', requirement_value: 10, points_awarded: 20, tier: 4, is_secret: false },
  { id: 'spoiler', name: 'Spoiler', emoji: '💎', description: 'Earn 3000 points', requirement_type: 'points', requirement_value: 3000, points_awarded: 20, tier: 4, is_secret: false },
  // Tier 5
  { id: 'unstoppable', name: 'Unstoppable', emoji: '🌟', description: 'Earn 5000 points', requirement_type: 'points', requirement_value: 5000, points_awarded: 20, tier: 5, is_secret: false },
  { id: 'legendary', name: 'Legendary', emoji: '👑', description: 'Earn 10000 points', requirement_type: 'points', requirement_value: 10000, points_awarded: 20, tier: 5, is_secret: false },
  { id: 'century_club', name: 'Century Club', emoji: '💯', description: 'Schedule 100 activities', requirement_type: 'activities_scheduled', requirement_value: 100, points_awarded: 20, tier: 5, is_secret: false },
  // Secret
  { id: 'night_owl', name: 'Night Owl', emoji: '🦉', description: '???', requirement_type: 'secret', requirement_value: 0, points_awarded: 20, tier: 0, is_secret: true },
  { id: 'early_bird', name: 'Early Bird', emoji: '☀️', description: '???', requirement_type: 'secret', requirement_value: 0, points_awarded: 20, tier: 0, is_secret: true },
  { id: 'spontaneous', name: 'Spontaneous', emoji: '🎲', description: '???', requirement_type: 'secret', requirement_value: 0, points_awarded: 20, tier: 0, is_secret: true },
]

export function TrophiesPage() {
  const { profile } = useUserStore()
  const [earned, setEarned] = useState<UserTrophy[]>([])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('user_trophies')
      .select('*, trophy:trophies(*)')
      .eq('user_id', profile.id)
      .then(({ data }) => setEarned(data ?? []))
  }, [profile])

  const earnedIds = new Set(earned.map(e => e.trophy_id))
  const tierTrophies = [1, 2, 3, 4, 5].map(tier =>
    ALL_TROPHIES.filter(t => t.tier === tier && !t.is_secret)
  )
  const secretTrophies = ALL_TROPHIES.filter(t => t.is_secret)

  return (
    <div className="app-container flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className="px-6 pt-14 pb-4 safe-top bg-gradient-to-b from-purple-50 to-white">
          <h1 className="font-display text-2xl font-bold text-gray-900">
            Trophy Case 🏆
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {earned.length} / {ALL_TROPHIES.length} earned
          </p>
          <div className="flex gap-2 mt-3">
            <div className="flex-1 bg-white rounded-2xl p-3 border border-purple-100 text-center shadow-sm">
              <div className="text-2xl font-bold text-purple-600">{earned.length}</div>
              <div className="text-xs text-gray-400">Earned</div>
            </div>
            <div className="flex-1 bg-white rounded-2xl p-3 border border-purple-100 text-center shadow-sm">
              <div className="text-2xl font-bold text-gray-300">{ALL_TROPHIES.length - earned.length}</div>
              <div className="text-xs text-gray-400">Locked</div>
            </div>
          </div>
        </div>

        {tierTrophies.map((trophies, i) => (
          <div key={i} className="px-4 mb-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Tier {i + 1}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {trophies.map(trophy => {
                const isEarned = earnedIds.has(trophy.id)
                return (
                  <motion.div
                    key={trophy.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-2xl p-3 text-center border ${
                      isEarned
                        ? 'bg-purple-50 border-purple-200'
                        : 'bg-gray-50 border-gray-100'
                    }`}
                  >
                    <div className={`text-3xl mb-1 ${isEarned ? '' : 'grayscale opacity-30'}`}>
                      {trophy.emoji}
                    </div>
                    <div className={`text-xs font-semibold ${isEarned ? 'text-gray-800' : 'text-gray-400'}`}>
                      {trophy.name}
                    </div>
                    {!isEarned && (
                      <Lock size={10} className="mx-auto mt-1 text-gray-300" />
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>
        ))}

        <div className="px-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Secret Trophies
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {secretTrophies.map(trophy => {
              const isEarned = earnedIds.has(trophy.id)
              return (
                <div
                  key={trophy.id}
                  className={`rounded-2xl p-3 text-center border ${
                    isEarned ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className={`text-3xl mb-1 ${isEarned ? '' : 'grayscale opacity-20'}`}>
                    {isEarned ? trophy.emoji : '❓'}
                  </div>
                  <div className={`text-xs font-semibold ${isEarned ? 'text-gray-800' : 'text-gray-300'}`}>
                    {isEarned ? trophy.name : '???'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
