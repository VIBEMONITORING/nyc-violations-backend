import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/useUserStore'
import { usePoints } from '../hooks/usePoints'
import { useStreak } from '../hooks/useStreak'
import { useTrophies } from '../hooks/useTrophies'
import { StreakBadge } from '../components/StreakBadge'
import { PointsAnimation, usePointsAnimation } from '../components/PointsAnimation'
import { TrophyCelebration } from '../components/TrophyCelebration'
import { BookActivityModal } from '../components/BookActivityModal'
import { BottomNav } from '../components/BottomNav'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'
import { format } from 'date-fns'
import { Plus, Calendar, Zap } from 'lucide-react'

export function ActiveHomePage() {
  const navigate = useNavigate()
  const { profile, partner } = useUserStore()
  const { currentMultiplier } = usePoints()
  const { checkTrophies, newTrophy, dismissTrophy } = useTrophies()
  const { isAtRisk } = useStreak()
  const pointsAnim = usePointsAnimation()
  const [showBook, setShowBook] = useState(false)
  const [recentActivities, setRecentActivities] = useState<Activity[]>([])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('activities')
      .select('*')
      .eq('scheduled_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecentActivities(data ?? []))
  }, [profile])

  const level = profile?.level ?? 1
  const points = profile?.points ?? 0
  const nextLevelPoints = level * 100
  const progress = (points % 100) / 100

  return (
    <div className="app-container flex flex-col bg-white">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* Header */}
        <div className="bg-[#FFB800] px-6 pt-14 pb-8 safe-top">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-amber-800 text-sm font-medium">Hey {profile?.display_name}!</p>
              <h1 className="font-display text-2xl font-bold text-white">
                Make them smile 💛
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StreakBadge streak={profile?.streak ?? 0} />
              {currentMultiplier > 1 && (
                <span className="text-xs bg-amber-800 text-amber-100 px-2 py-0.5 rounded-full font-bold">
                  {currentMultiplier}x BOOST
                </span>
              )}
            </div>
          </div>

          {/* Level Progress */}
          <div className="bg-amber-600/30 rounded-2xl p-3">
            <div className="flex justify-between text-white text-sm mb-1.5">
              <span className="font-semibold">Level {level}</span>
              <span>{points} pts</span>
            </div>
            <div className="h-2 bg-amber-700/40 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="h-full bg-white rounded-full"
              />
            </div>
            <div className="text-right text-amber-100 text-xs mt-1">{nextLevelPoints} pts next level</div>
          </div>
        </div>

        {/* At-risk streak warning */}
        {isAtRisk && profile && profile.streak > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-4 bg-orange-50 border border-orange-200 rounded-2xl p-3 flex items-center gap-3"
          >
            <span className="text-2xl">⚠️</span>
            <div>
              <div className="font-semibold text-orange-800 text-sm">Streak at risk!</div>
              <div className="text-orange-600 text-xs">Do something today to keep your {profile.streak}-day streak</div>
            </div>
          </motion.div>
        )}

        {/* Quick actions */}
        <div className="px-4 mt-6">
          <h2 className="font-semibold text-gray-800 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBook(true)}
              className="card-game flex flex-col items-center gap-2 py-5"
            >
              <Calendar size={28} className="text-[#FFB800]" />
              <span className="font-semibold text-sm text-gray-800">Book Surprise</span>
              <span className="points-pill">+10 pts</span>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/list')}
              className="card-game flex flex-col items-center gap-2 py-5"
            >
              <Zap size={28} className="text-purple-500" />
              <span className="font-semibold text-sm text-gray-800">From List</span>
              <span className="points-pill">+30 pts</span>
            </motion.button>
          </div>
        </div>

        {/* Partner card */}
        {partner && (
          <div className="px-4 mt-6">
            <h2 className="font-semibold text-gray-800 mb-3">Your Partner</h2>
            <div className="card-game flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center text-2xl font-bold text-white">
                {partner.display_name[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{partner.display_name}</div>
                <div className="text-sm text-gray-500">@{partner.username}</div>
                <div className="text-xs text-green-500 font-medium mt-0.5">● Connected</div>
              </div>
            </div>
          </div>
        )}

        {/* Recent activities */}
        {recentActivities.length > 0 && (
          <div className="px-4 mt-6 mb-4">
            <h2 className="font-semibold text-gray-800 mb-3">Recent Surprises</h2>
            <div className="space-y-2">
              {recentActivities.map(activity => (
                <div key={activity.id} className="card-game flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{activity.title}</div>
                    <div className="text-xs text-gray-400">
                      {format(new Date(activity.scheduled_date), 'MMM d, h:mm a')}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      activity.status === 'completed' ? 'bg-green-50 text-green-600' :
                      activity.status === 'cancelled' ? 'bg-red-50 text-red-500' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {activity.status}
                    </span>
                    {activity.points_earned > 0 && (
                      <span className="text-xs text-amber-600 font-bold">+{activity.points_earned}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FAB */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => navigate('/list/add')}
        className="fixed bottom-24 right-4 w-14 h-14 bg-[#FFB800] rounded-full shadow-lg flex items-center justify-center z-30"
      >
        <Plus size={24} className="text-white" />
      </motion.button>

      <BottomNav />
      <PointsAnimation points={pointsAnim.points} visible={pointsAnim.visible} />
      <TrophyCelebration trophy={newTrophy} onDismiss={dismissTrophy} />

      {showBook && (
        <BookActivityModal
          onClose={() => setShowBook(false)}
          onSuccess={pts => {
            pointsAnim.show(pts)
            checkTrophies()
          }}
        />
      )}
    </div>
  )
}
