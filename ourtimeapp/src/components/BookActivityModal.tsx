import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Calendar, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'
import { usePoints } from '../hooks/usePoints'
import { useStreak } from '../hooks/useStreak'
import type { ListItem } from '../types'
import { format, addDays } from 'date-fns'
import toast from 'react-hot-toast'

interface Props {
  item?: ListItem
  onClose: () => void
  onSuccess: (points: number) => void
}

export function BookActivityModal({ item, onClose, onSuccess }: Props) {
  const { profile, partner } = useUserStore()
  const { awardPoints } = usePoints()
  const { checkAndUpdateStreak } = useStreak()
  const [title, setTitle] = useState(item?.title ?? '')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd'T'HH:mm"))
  const [loading, setLoading] = useState(false)

  const handleBook = async () => {
    if (!profile || !partner || !title.trim()) return
    setLoading(true)
    try {
      const isFromList = !!item
      const action = isFromList ? 'schedule_from_list' : 'schedule_activity'

      const { error } = await supabase.from('activities').insert({
        scheduled_by: profile.id,
        scheduled_for: partner.id,
        title: title.trim(),
        description: description.trim() || null,
        scheduled_date: new Date(date).toISOString(),
        from_list: isFromList,
        list_item_id: item?.id ?? null,
      })

      if (error) throw error

      // Mark list item completed
      if (item) {
        await supabase
          .from('list_items')
          .update({ is_completed: true, completed_at: new Date().toISOString() })
          .eq('id', item.id)
      }

      const pts = await awardPoints(action)
      await checkAndUpdateStreak()
      onSuccess(pts)
      onClose()
      toast.success(`Activity booked! +${pts} pts`, { icon: '🎉' })
    } catch (err) {
      toast.error('Failed to book activity')
    } finally {
      setLoading(false)
    }
  }

  const pointsPreview = item ? 30 : 10

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={e => e.stopPropagation()}
          className="bg-white rounded-t-3xl p-6 w-full max-w-[430px] safe-bottom"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-display text-xl font-semibold">
              {item ? 'Book from List 🎯' : 'Schedule Surprise 🗓️'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            {!item && (
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Activity</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Spa day, dinner, movie night..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800]"
                />
              </div>
            )}

            {item && (
              <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">
                  {item.category === 'experience' ? '✨' :
                   item.category === 'gift' ? '🎁' :
                   item.category === 'food' ? '🍽️' :
                   item.category === 'at_home' ? '🏠' : '💝'}
                </span>
                <div>
                  <div className="font-semibold text-gray-900">{item.title}</div>
                  {item.context && <div className="text-sm text-gray-500">{item.context}</div>}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block flex items-center gap-1">
                <Calendar size={14} /> Date & Time
              </label>
              <input
                type="datetime-local"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800]"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block flex items-center gap-1">
                <FileText size={14} /> Personal note (optional)
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Why you're doing this, what to expect..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800] resize-none"
              />
            </div>

            <button
              onClick={handleBook}
              disabled={loading || !title.trim()}
              className="btn-game disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Booking...' : `Book +${pointsPreview} pts 🎉`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
