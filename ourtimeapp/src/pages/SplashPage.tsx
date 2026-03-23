import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'

export function SplashPage() {
  const navigate = useNavigate()
  const { session, loading } = useAuthStore()

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        if (session) {
          navigate('/home', { replace: true })
        } else {
          navigate('/auth', { replace: true })
        }
      }, 2000)
    }
  }, [session, loading, navigate])

  return (
    <div className="app-container flex flex-col items-center justify-center bg-white">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="text-8xl"
        >
          💕
        </motion.div>
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gray-900">OurTime</h1>
          <p className="text-gray-400 mt-1">Together, thoughtfully</p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-16 flex gap-2"
      >
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            animate={{ scale: [1, 1.5, 1] }}
            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
            className="w-2 h-2 rounded-full bg-[#FFB800]"
          />
        ))}
      </motion.div>
    </div>
  )
}
