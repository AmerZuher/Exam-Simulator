export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
}

export type ThemeName = 'light' | 'dark' | 'oled' | 'tokyo-night' | 'nord' | 'sepia';

export interface SidebarLink {
  id: string;
  type: 'group' | 'bank' | 'link';
  groupName?: string;
  bankKey?: string;
  mode?: 'exam' | 'study' | 'practice';
  label?: string;
  url?: string;
}

export interface Profile {
  id: string;
  full_name?: string | null;
  tagline?: string | null;
  avatar_url?: string | null;
  theme: ThemeName;
  accent: string;
  accent_custom?: string | null;
  sidebar_collapsed: boolean;
  daily_goal: number;
  review_size: number;
  ai_provider: string;
  ai_model?: string | null;
  ai_api_key?: string | null;
  sidebar_links: SidebarLink[];
  created_at: string;
  updated_at: string;
}
