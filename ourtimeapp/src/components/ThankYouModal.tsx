import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Activity } from '../types'
import toast from 'react-hot-toast'

interface Props {
  activity: Activity | null
  onClose: () => void
  onSuccess: () => void
}

export function ThankYouModal({ activity, onClose, onSuccess }: Props) {
  const [note, setNote] = useState('')
  const [rating, setRating] = useState(5)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!activity) return
    setLoading(true)
    try {
      await supabase
        .from('activities')
        .update({
          thank_you_note: note.trim() || null,
          thank_you_sent_at: new Date().toISOString(),
          rating,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', activity.id)

      // Create notification for partner
      await supabase.from('notifications').insert({
        user_id: activity.scheduled_by,
        type: 'thank_you',
        title: 'Thank You Received! 💝',
        body: note.trim() || 'Your partner is grateful for your thoughtfulness!',
        data: { activity_id: activity.id, note, rating },
      })

      onSuccess()
      onClose()
      toast.success('Thank you sent! 💕')
    } catch {
      toast.error('Failed to send thank you')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      {activity && (
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
            className="bg-[#FDF6E3] rounded-t-3xl p-6 w-full max-w-[430px] safe-bottom"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-xl font-semibold text-gray-800">
                Send Thank You 💕
              </h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-rose-100">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-4 border border-rose-100">
              <div className="font-medium text-gray-800">{activity.title}</div>
            </div>

            <div className="mb-4">
              <label className="text-sm font-medium text-gray-600 mb-2 block">How was it?</label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`text-3xl transition-transform active:scale-90 ${
                      star <= rating ? '' : 'opacity-30'
                    }`}
                  >
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="text-sm font-medium text-gray-600 mb-1 block">
                Personal message (optional)
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Thank you so much for..."
                rows={3}
                className="w-full border border-rose-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-[#E8B4B8] resize-none bg-white"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={loading}
              className="btn-gift disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send with Love 💌'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
