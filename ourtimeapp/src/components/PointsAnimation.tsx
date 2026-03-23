import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

interface Props {
  points: number
  visible: boolean
  onComplete?: () => void
}

export function PointsAnimation({ points, visible, onComplete }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={points}
          initial={{ opacity: 1, y: 0, scale: 0.8 }}
          animate={{ opacity: 0, y: -60, scale: 1.2 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          onAnimationComplete={onComplete}
          className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
        >
          <div className="bg-[#FFB800] text-white font-bold text-2xl px-4 py-2 rounded-full shadow-lg">
            +{points} pts ⭐
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function usePointsAnimation() {
  const [state, setState] = useState({ visible: false, points: 0 })

  const show = (points: number) => {
    setState({ visible: true, points })
    setTimeout(() => setState(s => ({ ...s, visible: false })), 1200)
  }

  return { ...state, show }
}
