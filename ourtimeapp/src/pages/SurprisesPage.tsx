import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUserStore } from '../stores/useUserStore'
import { useHeartbeat } from '../hooks/useHeartbeat'
import { BottomNav } from '../components/BottomNav'
import { ThankYouModal } from '../components/ThankYouModal'
import type { Activity } from '../types'
import { supabase } from '../lib/supabase'
import { format, isToday, isTomorrow } from 'date-fns'
import { Calendar, Heart, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export function SurprisesPage() {
  const { profile, pendingSurprises, fetchPendingSurprises } = useUserStore()
  const [thankyouActivity, setThankyouActivity] = useState<Activity | null>(null)
  useHeartbeat()

  useEffect(() => {
    fetchPendingSurprises()
    // Mark all as viewed
    if (profile && pendingSurprises.length > 0) {
      pendingSurprises
        .filter(a => !a.viewed_at)
        .forEach(a => {
          supabase
            .from('activities')
            .update({ viewed_at: new Date().toISOString() })
            .eq('id', a.id)
            .then(() => {})
        })
    }
  }, [])

  const formatDate = (date: string) => {
    const d = new Date(date)
    if (isToday(d)) return `Today at ${format(d, 'h:mm a')}`
    if (isTomorrow(d)) return `Tomorrow at ${format(d, 'h:mm a')}`
    return format(d, 'EEEE, MMM d • h:mm a')
  }

  const addToCalendar = async (activity: Activity) => {
    const start = new Date(activity.scheduled_date)
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000)
    const gcalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(activity.title)}&dates=${start.toISOString().replace(/[-:]/g, '').split('.')[0]}Z/${end.toISOString().replace(/[-:]/g, '').split('.')[0]}Z&details=${encodeURIComponent(activity.description ?? '')}`
    window.open(gcalUrl, '_blank')
    await supabase.from('activities').update({ added_to_calendar: true }).eq('id', activity.id)
    toast.success('Opening calendar...')
  }

  return (
    <div className="app-container flex flex-col bg-[#FDF6E3]">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className="px-6 pt-14 pb-4 safe-top">
          <h1 className="font-display text-2xl font-bold text-gray-800">
            Your Surprises 🎁
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {pendingSurprises.length} surprise{pendingSurprises.length !== 1 ? 's' : ''} waiting
          </p>
        </div>

        <div className="px-4 space-y-4">
          <AnimatePresence>
            {pendingSurprises.map((activity, i) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-3xl p-5 border border-rose-100 shadow-sm"
              >
                <div className="flex items-start gap-3 mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-3xl"
                  >
                    💕
                  </motion.div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-lg">{activity.title}</h3>
                    <div className="flex items-center gap-1.5 text-[#E8B4B8] text-sm mt-0.5">
                      <Calendar size={13} />
                      <span>{formatDate(activity.scheduled_date)}</span>
                    </div>
                  </div>
                </div>

                {activity.description && (
                  <div className="bg-rose-50 rounded-2xl p-3 mb-4">
                    <p className="text-gray-600 text-sm italic">"{activity.description}"</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => addToCalendar(activity)}
                    className={`flex-1 py-2.5 px-3 rounded-xl border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      activity.added_to_calendar
                        ? 'border-green-200 bg-green-50 text-green-600'
                        : 'border-rose-200 bg-white text-gray-600 active:bg-rose-50'
                    }`}
                  >
                    {activity.added_to_calendar ? <><Check size={14} /> Added</> : <><Calendar size={14} /> Calendar</>}
                  </button>
                  <button
                    onClick={() => setThankyouActivity(activity)}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#E8B4B8] text-white text-sm font-medium flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
                  >
                    <Heart size={14} /> Thank You
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {pendingSurprises.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🤍</div>
              <p className="text-gray-500 font-medium">No surprises yet</p>
              <p className="text-gray-400 text-sm mt-1">Your partner is planning something special</p>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
      <ThankYouModal
        activity={thankyouActivity}
        onClose={() => setThankyouActivity(null)}
        onSuccess={() => fetchPendingSurprises()}
      />
    </div>
  )
}
