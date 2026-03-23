import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, List, Trophy, BarChart2, Settings, Heart } from 'lucide-react'
import { useUserStore } from '../stores/useUserStore'
import { motion } from 'framer-motion'

export function BottomNav() {
  const location = useLocation()
  const { profile, pendingNotifications } = useUserStore()
  const isReceiver = profile?.mode === 'receiver'

  type NavItem = { to: string; icon: React.ComponentType<{ size: number; strokeWidth: number }>; label: string; badge?: number }

  const gameNav: NavItem[] = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/list', icon: List, label: 'List' },
    { to: '/trophies', icon: Trophy, label: 'Trophies' },
    { to: '/leaderboard', icon: BarChart2, label: 'Rank' },
    { to: '/settings', icon: Settings, label: 'You' },
  ]

  const receiverNav: NavItem[] = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/surprises', icon: Heart, label: 'Surprises', badge: pendingNotifications },
    { to: '/history', icon: List, label: 'Memories' },
    { to: '/settings', icon: Settings, label: 'You' },
  ]

  const navItems = isReceiver ? receiverNav : gameNav

  return (
    <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] safe-bottom border-t ${
      isReceiver ? 'bg-[#FDF6E3] border-rose-100' : 'bg-white border-amber-100'
    } z-40`}>
      <div className="flex justify-around items-center py-2 px-2">
        {navItems.map(({ to, icon: Icon, label, badge }) => {
          const active = location.pathname === to
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors relative ${
                active
                  ? isReceiver ? 'text-[#E8B4B8]' : 'text-[#FFB800]'
                  : 'text-gray-400'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                {badge && badge > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
                  >
                    {badge > 9 ? '9+' : badge}
                  </motion.div>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className={`absolute -bottom-2 w-1 h-1 rounded-full ${
                    isReceiver ? 'bg-[#E8B4B8]' : 'bg-[#FFB800]'
                  }`}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
