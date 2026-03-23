import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/useAuthStore'
import { useUserStore } from '../stores/useUserStore'
import { BottomNav } from '../components/BottomNav'
import type { UserMode } from '../types'
import { Copy, Check, LogOut, Vibrate, Volume2 } from 'lucide-react'
import toast from 'react-hot-toast'

export function SettingsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuthStore()
  const { profile, partner, updateProfile } = useUserStore()
  const [copied, setCopied] = useState(false)

  const copyCode = () => {
    navigator.clipboard.writeText(profile?.partner_code ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Code copied!')
  }

  const switchMode = async (mode: UserMode) => {
    await updateProfile({ mode })
    toast.success(`Switched to ${mode} mode`)
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/auth', { replace: true })
  }

  const isReceiver = profile?.mode === 'receiver'

  return (
    <div className={`app-container flex flex-col ${isReceiver ? 'bg-[#FDF6E3]' : 'bg-white'}`}>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <div className={`px-6 pt-14 pb-6 safe-top ${isReceiver ? '' : ''}`}>
          <h1 className="font-display text-2xl font-bold text-gray-900">Settings</h1>
        </div>

        {/* Profile section */}
        <div className="px-4 mb-6">
          <div className={`${isReceiver ? 'bg-white border-rose-100' : 'card-game'} rounded-3xl p-5 flex items-center gap-4`}>
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
              isReceiver
                ? 'bg-gradient-to-br from-rose-300 to-pink-400'
                : 'bg-gradient-to-br from-amber-400 to-orange-400'
            }`}>
              {profile?.display_name[0].toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-lg">{profile?.display_name}</div>
              <div className="text-gray-500 text-sm">@{profile?.username}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-[#FFB800]">{profile?.points} pts</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs text-gray-500">Level {profile?.level}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Partner code */}
        <div className="px-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Partner</h2>
          <div className={`${isReceiver ? 'bg-white border border-rose-100' : 'card-game'} rounded-2xl p-4`}>
            {partner ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-300 to-pink-400 flex items-center justify-center text-white font-bold">
                  {partner.display_name[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{partner.display_name}</div>
                  <div className="text-sm text-green-500 font-medium">● Connected</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-2">
                <p className="text-gray-500 text-sm mb-3">No partner connected yet</p>
                <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-400 mb-0.5">Your Code</div>
                    <div className="font-bold text-2xl tracking-widest text-gray-800">
                      {profile?.partner_code}
                    </div>
                  </div>
                  <button onClick={copyCode} className="p-2 rounded-full bg-white border border-amber-200">
                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} className="text-gray-500" />}
                  </button>
                </div>
              </div>
            )}
            {partner && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-400 mb-0.5">Your Partner Code</div>
                <div className="flex items-center justify-between">
                  <div className="font-bold text-lg tracking-widest text-gray-800">
                    {profile?.partner_code}
                  </div>
                  <button onClick={copyCode} className="p-2 rounded-full hover:bg-gray-100">
                    {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-500" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mode switcher */}
        <div className="px-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Mode</h2>
          <div className={`${isReceiver ? 'bg-white border border-rose-100' : 'card-game'} rounded-2xl p-1`}>
            {[
              { value: 'active' as UserMode, label: 'Planner', emoji: '🎮', desc: 'Game mode' },
              { value: 'receiver' as UserMode, label: 'Receiver', emoji: '🎁', desc: 'Gift mode' },
              { value: 'balanced' as UserMode, label: 'Both', emoji: '⚖️', desc: 'Balanced' },
            ].map(m => (
              <button
                key={m.value}
                onClick={() => switchMode(m.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  profile?.mode === m.value
                    ? isReceiver ? 'bg-rose-50' : 'bg-amber-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <div className="flex-1 text-left">
                  <div className="font-medium text-gray-900">{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
                {profile?.mode === m.value && (
                  <Check size={16} className={isReceiver ? 'text-[#E8B4B8]' : 'text-[#FFB800]'} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Preferences */}
        <div className="px-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wide">Preferences</h2>
          <div className={`${isReceiver ? 'bg-white border border-rose-100' : 'card-game'} rounded-2xl divide-y divide-gray-50`}>
            {[
              { icon: Vibrate, label: 'Haptics', key: 'haptics_enabled', value: profile?.haptics_enabled },
              { icon: Volume2, label: 'Sounds', key: 'sounds_enabled', value: profile?.sounds_enabled },
            ].map(({ icon: Icon, label, key, value }) => (
              <button
                key={key}
                onClick={() => updateProfile({ [key]: !value })}
                className="w-full flex items-center gap-3 p-4"
              >
                <Icon size={20} className="text-gray-500" />
                <span className="flex-1 text-left text-gray-800 font-medium">{label}</span>
                <div className={`w-11 h-6 rounded-full transition-colors ${
                  value
                    ? isReceiver ? 'bg-[#E8B4B8]' : 'bg-[#FFB800]'
                    : 'bg-gray-200'
                } relative`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
                    value ? 'translate-x-5' : 'translate-x-0.5'
                  } shadow`} />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Sign out */}
        <div className="px-4 mb-4">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 p-4 text-red-500 bg-red-50 rounded-2xl active:scale-95 transition-transform"
          >
            <LogOut size={20} />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        <div className="text-center text-xs text-gray-300 pb-4">
          OurTimeApp v1.0.0
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
