export type UserMode = 'active' | 'receiver' | 'balanced'
export type ItemCategory = 'experience' | 'gift' | 'at_home' | 'food' | 'other'
export type ActivityStatus = 'scheduled' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  display_name: string
  username: string
  avatar_url?: string
  mode: UserMode
  partner_id?: string
  partner_code: string
  points: number
  streak: number
  last_activity_date?: string
  level: number
  haptics_enabled: boolean
  sounds_enabled: boolean
  animations: string
  text_size: string
  created_at: string
  updated_at: string
}

export interface MemoryList {
  id: string
  owner_id: string
  about_user_id: string
  created_at: string
}

export interface ListItem {
  id: string
  list_id: string
  title: string
  category: ItemCategory
  context?: string
  link?: string
  is_completed: boolean
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Activity {
  id: string
  scheduled_by: string
  scheduled_for: string
  title: string
  description?: string
  scheduled_date: string
  status: ActivityStatus
  from_list: boolean
  list_item_id?: string
  points_earned: number
  viewed_at?: string
  added_to_calendar: boolean
  thank_you_note?: string
  thank_you_sent_at?: string
  rating?: number
  photo_url?: string
  completed_at?: string
  created_at: string
  updated_at: string
}

export interface Trophy {
  id: string
  name: string
  emoji: string
  description: string
  requirement_type: string
  requirement_value: number
  points_awarded: number
  tier: number
  is_secret: boolean
}

export interface UserTrophy {
  id: string
  user_id: string
  trophy_id: string
  earned_at: string
  trophy?: Trophy
}

export interface Notification {
  id: string
  user_id: string
  type: 'surprise' | 'thank_you' | 'streak_warning' | 'leaderboard' | 'trophy'
  title: string
  body: string
  data?: Record<string, unknown>
  read_at?: string
  created_at: string
}

export interface LeaderboardEntry {
  id: string
  user_id: string
  week_start: string
  points: number
  streak: number
  rank?: number
  profile?: Profile
}

export type PointAction =
  | 'add_to_list'
  | 'schedule_activity'
  | 'schedule_from_list'
  | 'buy_gift_from_list'
  | 'complete_activity'
  | 'same_day_bonus'
  | 'daily_streak_bonus'
  | 'trophy_earned'
  | 'thank_you_received'

export const POINT_VALUES: Record<PointAction, number> = {
  add_to_list: 5,
  schedule_activity: 10,
  schedule_from_list: 30,
  buy_gift_from_list: 35,
  complete_activity: 15,
  same_day_bonus: 5,
  daily_streak_bonus: 3,
  trophy_earned: 20,
  thank_you_received: 50,
}

export const STREAK_MULTIPLIERS = {
  seven_days: 1.5,
  thirty_days: 2.0,
}
