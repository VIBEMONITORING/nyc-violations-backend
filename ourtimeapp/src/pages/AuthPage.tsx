import { useState } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { Mail, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

export function AuthPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 safe-top">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">💕</div>
            <h1 className="font-display text-3xl font-bold text-gray-900">Welcome</h1>
            <p className="text-gray-500 mt-2">Sign in to continue your love story</p>
          </div>

          {!sent ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="your@email.com"
                  className="w-full border-2 border-gray-100 rounded-2xl pl-12 pr-4 py-4 text-base focus:outline-none focus:border-[#FFB800] transition-colors"
                />
              </div>
              <button
                onClick={handleSend}
                disabled={loading || !email.trim()}
                className="btn-game flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Sending...' : (
                  <>Send Magic Link <ArrowRight size={18} /></>
                )}
              </button>
              <p className="text-center text-xs text-gray-400 mt-4">
                No password needed. We'll email you a secure link.
              </p>
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="text-5xl mb-4">📬</div>
              <h2 className="font-display text-xl font-semibold text-gray-900 mb-2">
                Check your inbox!
              </h2>
              <p className="text-gray-500 mb-6">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-[#FFB800] font-medium underline"
              >
                Use a different email
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
