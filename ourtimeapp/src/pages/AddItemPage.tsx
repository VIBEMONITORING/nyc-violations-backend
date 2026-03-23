import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useUserStore } from '../stores/useUserStore'
import { usePoints } from '../hooks/usePoints'
import { useStreak } from '../hooks/useStreak'
import type { ItemCategory } from '../types'
import toast from 'react-hot-toast'

const categories: { value: ItemCategory; label: string; emoji: string }[] = [
  { value: 'experience', label: 'Experience', emoji: '✨' },
  { value: 'gift', label: 'Gift', emoji: '🎁' },
  { value: 'at_home', label: 'At Home', emoji: '🏠' },
  { value: 'food', label: 'Food & Drink', emoji: '🍽️' },
  { value: 'other', label: 'Other', emoji: '💝' },
]

export function AddItemPage() {
  const navigate = useNavigate()
  const { memoryListId, fetchListItems } = useUserStore()
  const { awardPoints } = usePoints()
  const { checkAndUpdateStreak } = useStreak()
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ItemCategory>('other')
  const [context, setContext] = useState('')
  const [link, setLink] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAdd = async () => {
    if (!memoryListId || !title.trim()) return
    setLoading(true)
    try {
      const { error } = await supabase.from('list_items').insert({
        list_id: memoryListId,
        title: title.trim(),
        category,
        context: context.trim() || null,
        link: link.trim() || null,
      })
      if (error) throw error

      const pts = await awardPoints('add_to_list')
      await checkAndUpdateStreak()
      await fetchListItems()
      toast.success(`Added! +${pts} pts ⭐`)
      navigate(-1)
    } catch (err) {
      toast.error('Failed to add item')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container flex flex-col bg-white safe-top">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold">Add to Memory List</h1>
        <span className="ml-auto points-pill">+5 pts</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">What did they mention? *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Spa day, that Japanese restaurant, the blue dress..."
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800]"
            autoFocus
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {categories.map(cat => (
              <button
                key={cat.value}
                onClick={() => setCategory(cat.value)}
                className={`py-2.5 px-2 rounded-2xl border-2 text-center transition-all ${
                  category === cat.value
                    ? 'border-[#FFB800] bg-amber-50'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className="text-xl">{cat.emoji}</div>
                <div className="text-xs mt-0.5 font-medium text-gray-700">{cat.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">
            Context <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={context}
            onChange={e => setContext(e.target.value)}
            placeholder="When they mentioned it, why it matters..."
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800]"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">
            Link <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={link}
            onChange={e => setLink(e.target.value)}
            placeholder="https://..."
            type="url"
            className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-base focus:outline-none focus:border-[#FFB800]"
          />
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleAdd}
          disabled={loading || !title.trim()}
          className="btn-game disabled:opacity-50 mt-4"
        >
          {loading ? 'Adding...' : 'Add to List +5 pts ⭐'}
        </motion.button>
      </div>
    </div>
  )
}
