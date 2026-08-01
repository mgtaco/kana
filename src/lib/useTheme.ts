import { useCallback, useEffect, useState } from 'react';
import { THEME_KEY } from './storage';

export type ThemeChoice = 'light' | 'dark';

/** Must match --bg in index.css for each palette. */
const LIGHT_BG = '#f5f1ea';
const DARK_BG = '#14120f';

function readStored(): ThemeChoice | null {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeChoice {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Follows the system theme until the learner picks one, then remembers it.
 * The initial value is also applied by an inline script in index.html so the
 * first paint never flashes the wrong palette.
 */
export function useTheme(): [ThemeChoice, () => void] {
  const [explicit, setExplicit] = useState<ThemeChoice | null>(readStored);
  const [system, setSystem] = useState<ThemeChoice>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystem(event.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = explicit ?? system;

  useEffect(() => {
    if (explicit) document.documentElement.dataset.theme = explicit;
    else delete document.documentElement.dataset.theme;
  }, [explicit]);

  // Keep the mobile browser chrome in step with the theme the app is actually
  // showing, which may not be the system one.
  useEffect(() => {
    const color = theme === 'dark' ? DARK_BG : LIGHT_BG;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.removeAttribute('media');
      meta.content = color;
    });
  }, [theme]);

  const toggle = useCallback(() => {
    const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark';
    setExplicit(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Preference simply won't persist across reloads.
    }
  }, [theme]);

  return [theme, toggle];
}
