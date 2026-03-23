import { motion } from 'framer-motion'

interface Props {
  streak: number
  size?: 'sm' | 'md' | 'lg'
}

export function StreakBadge({ streak, size = 'md' }: Props) {
  if (streak === 0) return null

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5',
  }

  const multiplier = streak >= 30 ? '2x' : streak >= 7 ? '1.5x' : null

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`inline-flex items-center gap-1 bg-orange-500 text-white font-bold rounded-full ${sizes[size]}`}
    >
      <span>🔥</span>
      <span>{streak}</span>
      {multiplier && (
        <span className="bg-white text-orange-500 rounded-full px-1 text-xs ml-0.5">
          {multiplier}
        </span>
      )}
    </motion.div>
  )
}
