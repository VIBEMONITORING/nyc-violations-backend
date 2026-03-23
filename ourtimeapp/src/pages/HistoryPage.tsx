import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useUserStore } from '../stores/useUserStore'
import { BottomNav } from '../components/BottomNav'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'
import { format } from 'date-fns'
import { Star } from 'lucide-react'

export function HistoryPage() {
  const { profile } = useUserStore()
  const [history, setHistory] = useState<Activity[]>([])

  useEffect(() => {
    if (!profile) return
    supabase
      .from('activities')
      .select('*')
      .eq('scheduled_for', profile.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .then(({ data }) => setHistory(data ?? []))
  }, [profile])

  return (
    <div className="app-container flex flex-col bg-[#FDF6E3]">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className="px-6 pt-14 pb-4 safe-top">
          <h1 className="font-display text-2xl font-bold text-gray-800">
            Memory Book 📖
          </h1>
          <p className="text-gray-500 text-sm mt-1">Your beautiful moments</p>
        </div>

        <div className="px-4 space-y-3">
          {history.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-3xl p-4 border border-rose-100 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">💕</div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(item.completed_at ?? item.scheduled_date), 'MMMM d, yyyy')}
                  </div>
                  {item.rating && (
                    <div className="flex gap-0.5 mt-1">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                  )}
                  {item.thank_you_note && (
                    <div className="mt-2 text-sm text-gray-500 italic">"{item.thank_you_note}"</div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {history.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📖</div>
              <p className="text-gray-500 font-medium">No memories yet</p>
              <p className="text-gray-400 text-sm mt-1">Your story is just beginning</p>
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
