import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from '../types/user';

const DEFAULTS: Omit<Profile, 'id' | 'created_at' | 'updated_at'> = {
  full_name: null,
  tagline: null,
  avatar_url: null,
  theme: 'light',
  accent: 'indigo',
  accent_custom: null,
  sidebar_collapsed: false,
  daily_goal: 20,
  review_size: 20,
  ai_provider: 'openai',
  ai_model: null,
  ai_api_key: null,
  sidebar_links: [],
};

// Google (and most OAuth providers Supabase supports) exposes the user's
// name/picture under slightly different keys depending on provider and
// Supabase version — check every alias so a fresh profile starts populated
// instead of blank. Only used once, at profile creation — never overwrites a
// name/picture the user has since set for themselves.
function seedFromAuthUser(user?: SupabaseUser): Pick<Profile, 'full_name' | 'avatar_url'> {
  const meta = user?.user_metadata || {};
  return {
    full_name: meta.full_name || meta.name || null,
    avatar_url: meta.avatar_url || meta.picture || null,
  };
}

export const profilesService = {
  async getOrCreateProfile(userId: string, authUser?: SupabaseUser): Promise<Profile> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;

    if (data) return data;

    const { data: created, error: createError } = await supabase
      .from('profiles')
      .insert([{ id: userId, ...DEFAULTS, ...seedFromAuthUser(authUser) }])
      .select()
      .single();
    if (createError) throw createError;
    return created;
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile> {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
