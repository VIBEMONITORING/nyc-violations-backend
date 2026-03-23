import { motion, AnimatePresence } from 'framer-motion'
import type { Trophy } from '../types'


interface Props {
  trophy: Trophy | null
  onDismiss: () => void
}

export function TrophyCelebration({ trophy, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {trophy && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            onClick={e => e.stopPropagation()}
            className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="text-7xl mb-4"
            >
              {trophy.emoji}
            </motion.div>
            <div className="text-yellow-500 font-bold text-sm uppercase tracking-wider mb-2">
              Trophy Unlocked!
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">
              {trophy.name}
            </h2>
            <p className="text-gray-500 mb-4">{trophy.description}</p>
            <div className="points-pill justify-center mb-6">
              <span>+{trophy.points_awarded} pts</span>
            </div>
            <button
              onClick={onDismiss}
              className="btn-game text-base"
            >
              Awesome! 🎉
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
