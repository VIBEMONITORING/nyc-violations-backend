import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useUserStore } from '../stores/useUserStore'
import { BottomNav } from '../components/BottomNav'
import { BookActivityModal } from '../components/BookActivityModal'
import { PointsAnimation, usePointsAnimation } from '../components/PointsAnimation'
import type { ListItem, ItemCategory } from '../types'
import { Plus, Check } from 'lucide-react'

const categoryEmoji: Record<ItemCategory, string> = {
  experience: '✨',
  gift: '🎁',
  at_home: '🏠',
  food: '🍽️',
  other: '💝',
}

const categoryColors: Record<ItemCategory, string> = {
  experience: 'bg-purple-50 text-purple-700',
  gift: 'bg-amber-50 text-amber-700',
  at_home: 'bg-blue-50 text-blue-700',
  food: 'bg-green-50 text-green-700',
  other: 'bg-rose-50 text-rose-700',
}

export function ListPage() {
  const navigate = useNavigate()
  const { listItems, fetchListItems, profile } = useUserStore()
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null)
  const [filter, setFilter] = useState<ItemCategory | 'all'>('all')
  const pointsAnim = usePointsAnimation()

  useEffect(() => {
    fetchListItems()
  }, [fetchListItems])

  const filtered = filter === 'all'
    ? listItems
    : listItems.filter(i => i.category === filter)

  const pending = filtered.filter(i => !i.is_completed)
  const completed = filtered.filter(i => i.is_completed)

  const isReceiver = profile?.mode === 'receiver'

  return (
    <div className={`app-container flex flex-col ${isReceiver ? 'bg-[#FDF6E3]' : 'bg-white'}`}>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {/* Header */}
        <div className={`px-6 pt-14 pb-4 safe-top ${isReceiver ? '' : ''}`}>
          <h1 className="font-display text-2xl font-bold text-gray-900">
            {isReceiver ? 'Wish List 🌟' : 'Memory List 📝'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isReceiver
              ? 'Things you\'ve mentioned wanting'
              : 'Things your partner mentioned wanting'}
          </p>
        </div>

        {/* Category filter */}
        <div className="px-4 mb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {(['all', 'experience', 'gift', 'at_home', 'food', 'other'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === cat
                    ? isReceiver ? 'bg-[#E8B4B8] text-white' : 'bg-[#FFB800] text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {cat === 'all' ? 'All' : `${categoryEmoji[cat]} ${cat.replace('_', ' ')}`}
              </button>
            ))}
          </div>
        </div>

        {/* Pending items */}
        {pending.length > 0 && (
          <div className="px-4 mb-4">
            <div className="space-y-2">
              <AnimatePresence>
                {pending.map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className={`rounded-2xl p-4 border ${
                      isReceiver ? 'bg-white border-rose-100' : 'card-game'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{categoryEmoji[item.category]}</span>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{item.title}</div>
                        {item.context && (
                          <div className="text-xs text-gray-400 mt-0.5 italic">"{item.context}"</div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${categoryColors[item.category]}`}>
                          {item.category.replace('_', ' ')}
                        </span>
                      </div>
                      {!isReceiver && (
                        <button
                          onClick={() => setSelectedItem(item)}
                          className="bg-[#FFB800] text-white text-xs font-bold px-3 py-1.5 rounded-full active:scale-95 transition-transform whitespace-nowrap"
                        >
                          Book +30
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Empty state */}
        {pending.length === 0 && (
          <div className="px-4 py-12 text-center">
            <div className="text-5xl mb-3">📝</div>
            <p className="text-gray-500 font-medium">No items yet</p>
            <p className="text-gray-400 text-sm mt-1">
              {isReceiver ? 'Your partner hasn\'t added anything yet' : 'Add things your partner mentions wanting'}
            </p>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="px-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-2 flex items-center gap-1">
              <Check size={14} /> Completed ({completed.length})
            </h3>
            <div className="space-y-2">
              {completed.map(item => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded-2xl p-3 flex items-center gap-3 opacity-60"
                >
                  <span className="text-xl">{categoryEmoji[item.category]}</span>
                  <div className="flex-1 line-through text-gray-400 text-sm">{item.title}</div>
                  <Check size={16} className="text-green-500" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isReceiver && (
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/list/add')}
          className="fixed bottom-24 right-4 w-14 h-14 bg-[#FFB800] rounded-full shadow-lg flex items-center justify-center z-30"
        >
          <Plus size={24} className="text-white" />
        </motion.button>
      )}

      <BottomNav />
      <PointsAnimation points={pointsAnim.points} visible={pointsAnim.visible} />

      {selectedItem && (
        <BookActivityModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSuccess={pts => {
            pointsAnim.show(pts)
            setSelectedItem(null)
            fetchListItems()
          }}
        />
      )}
    </div>
  )
}
