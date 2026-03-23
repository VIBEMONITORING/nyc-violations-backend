-- OurTimeApp Database Schema
-- Run this in your Supabase SQL editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  mode TEXT CHECK (mode IN ('active', 'receiver', 'balanced')) DEFAULT 'active',
  partner_id UUID REFERENCES profiles(id),
  partner_code TEXT UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 6)),
  points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  last_activity_date DATE,
  level INTEGER DEFAULT 1,
  haptics_enabled BOOLEAN DEFAULT true,
  sounds_enabled BOOLEAN DEFAULT true,
  animations TEXT DEFAULT 'full',
  text_size TEXT DEFAULT 'default',
  push_token_ios TEXT,
  push_token_android TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Memory lists
CREATE TABLE memory_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id) NOT NULL,
  about_user_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id, about_user_id)
);

-- List items
CREATE TABLE list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES memory_lists(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category TEXT CHECK (category IN ('experience', 'gift', 'at_home', 'food', 'other')) DEFAULT 'other',
  context TEXT,
  link TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities (scheduled surprises)
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_by UUID REFERENCES profiles(id) NOT NULL,
  scheduled_for UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMPTZ NOT NULL,
  status TEXT CHECK (status IN ('scheduled', 'completed', 'cancelled')) DEFAULT 'scheduled',
  from_list BOOLEAN DEFAULT false,
  list_item_id UUID REFERENCES list_items(id),
  points_earned INTEGER DEFAULT 0,
  viewed_at TIMESTAMPTZ,
  added_to_calendar BOOLEAN DEFAULT false,
  thank_you_note TEXT,
  thank_you_sent_at TIMESTAMPTZ,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  photo_url TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trophies master list
CREATE TABLE trophies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  requirement_type TEXT NOT NULL,
  requirement_value INTEGER NOT NULL,
  points_awarded INTEGER DEFAULT 20,
  tier INTEGER NOT NULL,
  is_secret BOOLEAN DEFAULT false
);

-- User trophies (earned)
CREATE TABLE user_trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  trophy_id TEXT REFERENCES trophies(id) NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, trophy_id)
);

-- Leaderboard weekly
CREATE TABLE leaderboard_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  points INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  rank INTEGER,
  UNIQUE(user_id, week_start)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_weekly ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view partner profile" ON profiles FOR SELECT USING (
  partner_id = auth.uid() OR id IN (SELECT partner_id FROM profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Memory lists policies
CREATE POLICY "Users can manage own lists" ON memory_lists FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Partners can view lists about them" ON memory_lists FOR SELECT USING (about_user_id = auth.uid());

-- List items policies
CREATE POLICY "Users can manage items in own lists" ON list_items FOR ALL USING (
  list_id IN (SELECT id FROM memory_lists WHERE owner_id = auth.uid())
);
CREATE POLICY "Partners can view items about them" ON list_items FOR SELECT USING (
  list_id IN (SELECT id FROM memory_lists WHERE about_user_id = auth.uid())
);

-- Activities policies
CREATE POLICY "Users can manage own activities" ON activities FOR ALL USING (scheduled_by = auth.uid());
CREATE POLICY "Users can view activities for them" ON activities FOR SELECT USING (scheduled_for = auth.uid());
CREATE POLICY "Receivers can update their activities" ON activities FOR UPDATE USING (scheduled_for = auth.uid());

-- Trophies: public read
CREATE POLICY "Anyone can view trophies" ON trophies FOR SELECT USING (true);

-- User trophies policies
CREATE POLICY "Users can view own trophies" ON user_trophies FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "System can insert trophies" ON user_trophies FOR INSERT WITH CHECK (user_id = auth.uid());

-- Leaderboard: public read
CREATE POLICY "Anyone can view leaderboard" ON leaderboard_weekly FOR SELECT USING (true);
CREATE POLICY "Users can manage own leaderboard" ON leaderboard_weekly FOR ALL USING (user_id = auth.uid());

-- Notifications
CREATE POLICY "Users can manage own notifications" ON notifications FOR ALL USING (user_id = auth.uid());

-- Functions

-- connect_partners: link two profiles bidirectionally
CREATE OR REPLACE FUNCTION connect_partners(p_user_id UUID, p_partner_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_partner_id UUID;
BEGIN
  SELECT id INTO v_partner_id FROM profiles WHERE partner_code = p_partner_code AND id != p_user_id;
  IF v_partner_id IS NULL THEN RETURN FALSE; END IF;
  UPDATE profiles SET partner_id = v_partner_id WHERE id = p_user_id;
  UPDATE profiles SET partner_id = p_user_id WHERE id = v_partner_id;
  RETURN TRUE;
END;
$$;

-- check_trophies: returns newly earned trophies
CREATE OR REPLACE FUNCTION check_trophies(p_user_id UUID)
RETURNS SETOF trophies
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_activities_count INTEGER;
  v_list_items_count INTEGER;
  v_from_list_count INTEGER;
  v_trophy trophies%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id;
  SELECT COUNT(*) INTO v_activities_count FROM activities WHERE scheduled_by = p_user_id AND status = 'completed';
  SELECT COUNT(*) INTO v_list_items_count FROM list_items li
    JOIN memory_lists ml ON ml.id = li.list_id WHERE ml.owner_id = p_user_id;
  SELECT COUNT(*) INTO v_from_list_count FROM activities WHERE scheduled_by = p_user_id AND from_list = true;

  FOR v_trophy IN SELECT * FROM trophies WHERE id NOT IN (
    SELECT trophy_id FROM user_trophies WHERE user_id = p_user_id
  ) AND is_secret = false LOOP
    DECLARE v_earned BOOLEAN := false;
    BEGIN
      CASE v_trophy.requirement_type
        WHEN 'points' THEN v_earned := v_profile.points >= v_trophy.requirement_value;
        WHEN 'streak' THEN v_earned := v_profile.streak >= v_trophy.requirement_value;
        WHEN 'activities_completed' THEN v_earned := v_activities_count >= v_trophy.requirement_value;
        WHEN 'list_items' THEN v_earned := v_list_items_count >= v_trophy.requirement_value;
        WHEN 'from_list_booked' THEN v_earned := v_from_list_count >= v_trophy.requirement_value;
        ELSE v_earned := false;
      END CASE;

      IF v_earned THEN
        INSERT INTO user_trophies (user_id, trophy_id) VALUES (p_user_id, v_trophy.id) ON CONFLICT DO NOTHING;
        UPDATE profiles SET points = points + v_trophy.points_awarded WHERE id = p_user_id;
        RETURN NEXT v_trophy;
      END IF;
    END;
  END LOOP;
END;
$$;

-- Seed trophy data
INSERT INTO trophies (id, name, emoji, description, requirement_type, requirement_value, tier) VALUES
  ('first_spark', 'First Spark', '💕', 'Earn your first points', 'points', 1, 1),
  ('followed_through', 'Followed Through', '✨', 'Complete your first activity', 'activities_completed', 1, 1),
  ('memory_keeper', 'Memory Keeper', '📝', 'Add 3 items to the memory list', 'list_items', 3, 1),
  ('on_fire', 'On Fire', '🔥', 'Maintain a 7-day streak', 'streak', 7, 2),
  ('good_listener', 'Good Listener', '👀', 'Add 10 items to the list', 'list_items', 10, 2),
  ('date_planner', 'Date Planner', '🍷', 'Schedule 5 activities', 'activities_completed', 5, 2),
  ('week_warrior', 'Week Warrior', '⚡', 'Earn 500 points', 'points', 500, 3),
  ('bullseye', 'Bullseye', '🎯', 'Book 5 items from the list', 'from_list_booked', 5, 3),
  ('hopeless_romantic', 'Hopeless Romantic', '💝', 'Earn 1000 points', 'points', 1000, 3),
  ('committed', 'Committed', '💪', 'Maintain a 30-day streak', 'streak', 30, 4),
  ('mind_reader', 'Mind Reader', '💝', 'Book 10 items from the list', 'from_list_booked', 10, 4),
  ('spoiler', 'Spoiler', '💎', 'Earn 3000 points', 'points', 3000, 4),
  ('unstoppable', 'Unstoppable', '🌟', 'Earn 5000 points', 'points', 5000, 5),
  ('legendary', 'Legendary', '👑', 'Earn 10000 points', 'points', 10000, 5)
ON CONFLICT (id) DO NOTHING;

-- Enable realtime for activities table
ALTER PUBLICATION supabase_realtime ADD TABLE activities;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
