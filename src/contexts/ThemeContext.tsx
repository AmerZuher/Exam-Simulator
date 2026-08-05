import { createContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useProfile } from '../hooks/useProfile';
import type { ThemeName } from '../types/user';

export const ACCENTS: Record<string, { a: string; b: string }> = {
  indigo: { a: '#6366f1', b: '#8b5cf6' },
  emerald: { a: '#10b981', b: '#14b8a6' },
  amber: { a: '#f59e0b', b: '#f97316' },
  rose: { a: '#f43f5e', b: '#ec4899' },
  cyan: { a: '#06b6d4', b: '#3b82f6' },
  purple: { a: '#a855f7', b: '#ec4899' },
  sky: { a: '#7aa2f7', b: '#7dcfff' },
  mint: { a: '#9ece6a', b: '#5eead4' },
  coral: { a: '#f7768e', b: '#fb923c' },
  gold: { a: '#ff9e64', b: '#fbbf24' },
};

export const THEMES: ThemeName[] = ['light', 'dark', 'oled', 'tokyo-night', 'nord', 'sepia'];
export const LIGHT_THEMES: ThemeName[] = ['light', 'sepia'];

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function isHex(v: string | null | undefined): boolean {
  return /^#?[0-9a-f]{6}$/i.test(String(v || '').trim());
}

export function normHex(v: string): string {
  const s = String(v || '').trim().replace(/^#/, '');
  return `#${s.toLowerCase()}`;
}

/** Derives the gradient companion colour by nudging the hue forward — keeps a
 * custom accent looking like the built-in pairs. */
function companion(hex: string): string {
  const [r, g, b] = hexRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  h = (h + 28) % 360;
  const l2 = Math.min(0.72, l + 0.06);
  const c = (1 - Math.abs(2 * l2 - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l2 - c / 2;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return `#${rgb.map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

interface ThemeContextType {
  theme: ThemeName;
  accent: string;
  accentCustom: string | null;
  sidebarCollapsed: boolean;
  setTheme: (theme: ThemeName) => void;
  setAccent: (accent: string) => void;
  setCustomAccent: (hex: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleTheme: () => void;
  accentPair: () => { a: string; b: string };
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function accentPairFor(accent: string, accentCustom: string | null) {
  if (accent === 'custom' && isHex(accentCustom)) {
    const a = normHex(accentCustom!);
    return { a, b: companion(a) };
  }
  return ACCENTS[accent] || ACCENTS.indigo;
}

function applyTheme(theme: ThemeName, accent: string, accentCustom: string | null) {
  document.body.dataset.theme = THEMES.includes(theme) ? theme : 'light';

  const pair = accentPairFor(accent, accentCustom);
  const dark = !LIGHT_THEMES.includes(document.body.dataset.theme as ThemeName);
  const [r, g, b] = hexRgb(pair.a);
  const root = document.documentElement.style;
  root.setProperty('--acc', pair.a);
  root.setProperty('--acc-2', pair.b);
  root.setProperty('--acc-rgb', `${r},${g},${b}`);
  root.setProperty('--acc-soft', `rgba(${r},${g},${b},${dark ? 0.18 : 0.11})`);
  root.setProperty('--acc-softer', `rgba(${r},${g},${b},${dark ? 0.10 : 0.06})`);
  root.setProperty('--acc-line', `rgba(${r},${g},${b},${dark ? 0.45 : 0.32})`);
  root.setProperty('--acc-glow', `0 8px ${dark ? '26px' : '22px'} -8px rgba(${r},${g},${b},${dark ? 0.6 : 0.55})`);
}

const CACHE_KEY = 'exampro-theme-cache';

interface ThemeCache {
  theme: ThemeName;
  accent: string;
  accentCustom: string | null;
  sidebarCollapsed: boolean;
}

function readCache(): ThemeCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { theme: 'light', accent: 'indigo', accentCustom: null, sidebarCollapsed: false };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { profile, update } = useProfile();
  const cache = useRef(readCache());

  const [theme, setThemeState] = useState<ThemeName>(cache.current.theme);
  const [accent, setAccentState] = useState<string>(cache.current.accent);
  const [accentCustom, setAccentCustomState] = useState<string | null>(cache.current.accentCustom);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(cache.current.sidebarCollapsed);
  const syncedFromProfile = useRef(false);

  // Instant paint on mount, before Supabase responds.
  useEffect(() => {
    applyTheme(theme, accent, accentCustom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the profile loads, it becomes the source of truth (once, per sign-in).
  useEffect(() => {
    if (!profile || syncedFromProfile.current) return;
    syncedFromProfile.current = true;
    setThemeState(profile.theme);
    setAccentState(profile.accent);
    setAccentCustomState(profile.accent_custom ?? null);
    setSidebarCollapsedState(profile.sidebar_collapsed);
    applyTheme(profile.theme, profile.accent, profile.accent_custom ?? null);
  }, [profile]);

  useEffect(() => {
    if (!user) syncedFromProfile.current = false;
  }, [user?.id]);

  useEffect(() => {
    applyTheme(theme, accent, accentCustom);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ theme, accent, accentCustom, sidebarCollapsed }));
  }, [theme, accent, accentCustom, sidebarCollapsed]);

  const setTheme = (next: ThemeName) => {
    setThemeState(next);
    if (user) update({ theme: next });
  };

  const setAccent = (next: string) => {
    setAccentState(next);
    if (user) update({ accent: next });
  };

  const setCustomAccent = (hex: string) => {
    if (!isHex(hex)) return;
    const norm = normHex(hex);
    setAccentCustomState(norm);
    setAccentState('custom');
    if (user) update({ accent: 'custom', accent_custom: norm });
  };

  const setSidebarCollapsed = (next: boolean) => {
    setSidebarCollapsedState(next);
    if (user) update({ sidebar_collapsed: next });
  };

  const toggleTheme = () => {
    setTheme(LIGHT_THEMES.includes(theme) ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accent,
        accentCustom,
        sidebarCollapsed,
        setTheme,
        setAccent,
        setCustomAccent,
        setSidebarCollapsed,
        toggleTheme,
        accentPair: () => accentPairFor(accent, accentCustom),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
