import { motion } from 'framer-motion'

export function LoadingScreen() {
  return (
    <div className="app-container flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          className="text-6xl"
        >
          💕
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-gray-400 font-display text-lg"
        >
          Loading...
        </motion.p>
      </div>
    </div>
  )
}
