import { motion, AnimatePresence } from 'framer-motion'
import { useEffect } from 'react'

interface Props {
  visible: boolean
  note?: string
  onDismiss: () => void
}

export function ThankYouCelebration({ visible, note, onDismiss }: Props) {
  useEffect(() => {
    if (visible) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 200])
      setTimeout(onDismiss, 4000)
    }
  }, [visible, onDismiss])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
        >
          <motion.div
            initial={{ scale: 0, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: 50 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1, 1.3, 1] }}
              transition={{ duration: 1, repeat: 2 }}
              className="text-7xl mb-4"
            >
              💝
            </motion.div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
              Thank You Received!
            </h2>
            {note && (
              <p className="text-gray-600 italic mb-4">"{note}"</p>
            )}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className="text-4xl font-bold text-[#FFB800] mb-2"
            >
              +50 pts ⭐
            </motion.div>
            <p className="text-gray-400 text-sm">Your partner appreciates you!</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
