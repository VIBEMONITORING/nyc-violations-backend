import { motion } from 'framer-motion'
import { useUserStore } from '../stores/useUserStore'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { BottomNav } from '../components/BottomNav'
import { useNavigate } from 'react-router-dom'
import { format, isToday, isTomorrow } from 'date-fns'

export function ReceiverHomePage() {
  const { profile, partner, pendingSurprises } = useUserStore()
  const navigate = useNavigate()
  useHeartbeat()

  const nextSurprise = pendingSurprises[0]

  const formatDate = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`
    return format(d, 'MMM d, h:mm a')
  }

  return (
    <div className="app-container flex flex-col bg-[#FDF6E3]">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* Header */}
        <div className="px-6 pt-14 pb-8 safe-top">
          <p className="text-[#E8B4B8] text-sm font-medium">Welcome back</p>
          <h1 className="font-display text-3xl font-bold text-gray-800">
            {profile?.display_name} 💕
          </h1>
        </div>

        {/* Heartbeat / next surprise */}
        <div className="px-4 mb-6">
          {nextSurprise ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate('/surprises')}
              className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm cursor-pointer active:scale-98"
            >
              <div className="flex items-center gap-3 mb-4">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-3xl"
                >
                  💕
                </motion.div>
                <div>
                  <div className="font-semibold text-gray-800">Something special is coming!</div>
                  <div className="text-sm text-[#E8B4B8]">{formatDate(nextSurprise.scheduled_date)}</div>
                </div>
              </div>
              <div className="bg-rose-50 rounded-2xl px-4 py-3 text-center">
                <span className="text-sm text-gray-600">Tap to see your surprise 🎁</span>
              </div>
            </motion.div>
          ) : (
            <div className="bg-white rounded-3xl p-6 border border-rose-100 shadow-sm text-center">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-5xl mb-3"
              >
                🤍
              </motion.div>
              <p className="text-gray-500 text-sm">No surprises yet. Tell your partner what you'd love!</p>
            </div>
          )}
        </div>

        {/* Partner card */}
        {partner && (
          <div className="px-4 mb-6">
            <h2 className="font-semibold text-gray-700 mb-3">Thinking of you</h2>
            <div className="bg-white rounded-3xl p-4 border border-rose-100 shadow-sm flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-300 to-orange-400 flex items-center justify-center text-2xl font-bold text-white">
                {partner.display_name[0].toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{partner.display_name}</div>
                <div className="text-sm text-gray-400">Planning something for you ✨</div>
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="ml-auto text-2xl"
              >
                💛
              </motion.div>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="px-4">
          <h2 className="font-semibold text-gray-700 mb-3">Your Story</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-rose-100 text-center">
              <div className="text-2xl font-bold text-[#E8B4B8]">{pendingSurprises.length}</div>
              <div className="text-xs text-gray-500 mt-0.5">Upcoming</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-rose-100 text-center">
              <div className="text-2xl font-bold text-[#A8C686]">
                {profile?.streak ?? 0}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Days together</div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
