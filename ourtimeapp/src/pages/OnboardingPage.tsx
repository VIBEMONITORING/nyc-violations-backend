import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserStore } from '../stores/useUserStore'
import type { UserMode } from '../types'
import { ArrowRight, ArrowLeft, Users, Heart, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

const steps = ['name', 'mode', 'partner'] as const
type Step = typeof steps[number]

export function OnboardingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { fetchProfile } = useUserStore()
  const [step, setStep] = useState<Step>('name')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [mode, setMode] = useState<UserMode>('active')
  const [partnerCode, setPartnerCode] = useState('')
  const [loading, setLoading] = useState(false)

  const stepIndex = steps.indexOf(step)

  const handleNameNext = async () => {
    if (!displayName.trim() || !username.trim()) return
    setStep('mode')
  }

  const handleModeNext = () => setStep('partner')

  const handleComplete = async (skipPartner = false) => {
    if (!user) return
    setLoading(true)
    try {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          display_name: displayName.trim(),
          username: username.trim().toLowerCase(),
          mode,
          points: 0,
          streak: 0,
          level: 1,
          haptics_enabled: true,
          sounds_enabled: true,
          animations: 'full',
          text_size: 'default',
        })

      if (profileError) throw profileError

      // Connect partner
      if (!skipPartner && partnerCode.trim()) {
        const { data, error } = await supabase
          .rpc('connect_partners', {
            p_user_id: user.id,
            p_partner_code: partnerCode.trim().toUpperCase(),
          })

        if (error || !data) {
          toast.error('Partner code not found. You can add it later in Settings.')
        }
      }

      await fetchProfile(user.id)
      navigate('/home', { replace: true })
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container flex flex-col safe-top safe-bottom">
      {/* Progress */}
      <div className="flex gap-2 px-6 pt-6">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= stepIndex ? 'bg-[#FFB800]' : 'bg-gray-100'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 'name' && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 flex flex-col px-6 pt-10"
          >
            <div className="text-5xl mb-6">👋</div>
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">
              Nice to meet you!
            </h1>
            <p className="text-gray-500 mb-8">Let's set up your profile</p>

            <div className="space-y-4 flex-1">
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Display Name</label>
                <input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-[#FFB800]"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600 mb-1 block">Username</label>
                <input
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                  placeholder="@username"
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-base focus:outline-none focus:border-[#FFB800]"
                />
              </div>
            </div>

            <button
              onClick={handleNameNext}
              disabled={!displayName.trim() || !username.trim()}
              className="btn-game flex items-center justify-center gap-2 mt-6 disabled:opacity-50"
            >
              Continue <ArrowRight size={18} />
            </button>
          </motion.div>
        )}

        {step === 'mode' && (
          <motion.div
            key="mode"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 flex flex-col px-6 pt-10"
          >
            <div className="text-5xl mb-6">💑</div>
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">
              Your role in love
            </h1>
            <p className="text-gray-500 mb-8">You can always switch later</p>

            <div className="space-y-3 flex-1">
              {[
                {
                  value: 'active' as UserMode,
                  icon: Sparkles,
                  title: 'The Planner',
                  desc: 'I love planning surprises and earning points',
                  color: 'border-[#FFB800] bg-amber-50',
                  tag: '🎮 Game Mode',
                },
                {
                  value: 'receiver' as UserMode,
                  icon: Heart,
                  title: 'The Receiver',
                  desc: 'I love receiving thoughtful surprises',
                  color: 'border-[#E8B4B8] bg-rose-50',
                  tag: '🎁 Gift Mode',
                },
                {
                  value: 'balanced' as UserMode,
                  icon: Users,
                  title: 'Both',
                  desc: 'We both plan and receive equally',
                  color: 'border-purple-300 bg-purple-50',
                  tag: '⚖️ Balanced',
                },
              ].map(({ value, icon: Icon, title, desc, color, tag }) => (
                <button
                  key={value}
                  onClick={() => setMode(value)}
                  className={`w-full border-2 rounded-2xl p-4 text-left transition-all ${
                    mode === value ? color : 'border-gray-100 bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon size={22} className={mode === value ? 'text-gray-700' : 'text-gray-400'} />
                    <div>
                      <div className="font-semibold text-gray-900">{title}</div>
                      <div className="text-sm text-gray-500">{desc}</div>
                      <div className="text-xs mt-1 font-medium text-gray-400">{tag}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep('name')}
                className="p-4 border-2 border-gray-100 rounded-2xl"
              >
                <ArrowLeft size={18} />
              </button>
              <button onClick={handleModeNext} className="btn-game flex-1 flex items-center justify-center gap-2">
                Continue <ArrowRight size={18} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 'partner' && (
          <motion.div
            key="partner"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            className="flex-1 flex flex-col px-6 pt-10"
          >
            <div className="text-5xl mb-6">🔗</div>
            <h1 className="font-display text-3xl font-bold text-gray-900 mb-2">
              Connect your partner
            </h1>
            <p className="text-gray-500 mb-8">
              Ask your partner for their 6-digit code from Settings
            </p>

            <div className="flex-1">
              <input
                value={partnerCode}
                onChange={e => setPartnerCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="ABC123"
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-4 text-center text-2xl font-bold tracking-widest focus:outline-none focus:border-[#FFB800] uppercase"
              />
              <p className="text-center text-sm text-gray-400 mt-3">
                Your partner can find their code in Settings → Partner Code
              </p>
            </div>

            <div className="space-y-3 mt-6">
              <button
                onClick={() => handleComplete(false)}
                disabled={loading}
                className="btn-game flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Setting up...' : (
                  <>Connect & Start! <ArrowRight size={18} /></>
                )}
              </button>
              <button
                onClick={() => handleComplete(true)}
                className="w-full text-gray-400 py-3 text-sm underline"
              >
                Skip for now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
