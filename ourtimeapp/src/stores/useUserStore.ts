import { create } from 'zustand'
import type { Profile, ListItem, Activity } from '../types'
import { supabase } from '../lib/supabase'

interface UserState {
  profile: Profile | null
  partner: Profile | null
  memoryListId: string | null
  listItems: ListItem[]
  pendingSurprises: Activity[]
  pendingNotifications: number
  loading: boolean
  error: string | null
  fetchProfile: (userId: string) => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<void>
  fetchListItems: () => Promise<void>
  fetchPendingSurprises: () => Promise<void>
  addPoints: (points: number) => void
  incrementStreak: () => void
}

export const useUserStore = create<UserState>((set, get) => ({
  profile: null,
  partner: null,
  memoryListId: null,
  listItems: [],
  pendingSurprises: [],
  pendingNotifications: 0,
  loading: false,
  error: null,

  fetchProfile: async (userId: string) => {
    set({ loading: true, error: null })
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      let partner = null
      if (profile.partner_id) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profile.partner_id)
          .single()
        partner = data
      }

      // Get or create memory list
      let memoryListId = null
      if (profile.partner_id) {
        const { data: list } = await supabase
          .from('memory_lists')
          .select('id')
          .eq('owner_id', userId)
          .eq('about_user_id', profile.partner_id)
          .single()

        if (list) {
          memoryListId = list.id
        } else {
          const { data: newList } = await supabase
            .from('memory_lists')
            .insert({ owner_id: userId, about_user_id: profile.partner_id })
            .select('id')
            .single()
          memoryListId = newList?.id ?? null
        }
      }

      set({ profile, partner, memoryListId, loading: false })
    } catch (err) {
      set({ error: (err as Error).message, loading: false })
    }
  },

  updateProfile: async (updates: Partial<Profile>) => {
    const { profile } = get()
    if (!profile) return
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', profile.id)
      .select()
      .single()
    if (!error && data) {
      set({ profile: data })
    }
  },

  fetchListItems: async () => {
    const { memoryListId } = get()
    if (!memoryListId) return
    const { data } = await supabase
      .from('list_items')
      .select('*')
      .eq('list_id', memoryListId)
      .order('created_at', { ascending: false })
    set({ listItems: data ?? [] })
  },

  fetchPendingSurprises: async () => {
    const { profile } = get()
    if (!profile) return
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('scheduled_for', profile.id)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
    const surprises = data ?? []
    const unread = surprises.filter(a => !a.viewed_at).length
    set({ pendingSurprises: surprises, pendingNotifications: unread })
  },

  addPoints: (points: number) => {
    const { profile } = get()
    if (!profile) return
    const newPoints = profile.points + points
    const newLevel = Math.floor(newPoints / 100) + 1
    set({ profile: { ...profile, points: newPoints, level: newLevel } })
  },

  incrementStreak: () => {
    const { profile } = get()
    if (!profile) return
    set({ profile: { ...profile, streak: profile.streak + 1 } })
  },
}))
