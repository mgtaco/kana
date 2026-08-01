import { AnimatePresence, motion } from 'motion/react';

import type { View } from '../App';
import type { ThemeChoice } from '../lib/useTheme';
import { GridIcon, MoonIcon, SunIcon, TargetIcon } from './icons';

import styles from './Header.module.css';

interface HeaderProps {
  view: View;
  theme: ThemeChoice;
  onToggleTheme: () => void;
  onNavigate: (view: View) => void;
}

const TABS = [
  { id: 'chart', label: 'Chart', target: 'chart' as View, Icon: GridIcon, matches: ['chart'] },
  {
    id: 'quiz',
    label: 'Quiz',
    target: 'setup' as View,
    Icon: TargetIcon,
    matches: ['setup', 'results'],
  },
];

export default function Header({ view, theme, onToggleTheme, onNavigate }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <button className={styles.brand} onClick={() => onNavigate('home')} aria-label="Kana home">
          <span className={`${styles.seal} kana-glyph`} aria-hidden="true">
            あ
          </span>
          <span className={styles.wordmark}>
            <span className={styles.wordmarkTitle}>Kana</span>
            <span className={styles.wordmarkSub}>Hiragana</span>
          </span>
        </button>

        <nav className={styles.nav} aria-label="Sections">
          {TABS.map(({ id, label, target, Icon, matches }) => {
            const active = matches.includes(view);
            return (
              <button
                key={id}
                className={styles.tab}
                data-active={active}
                /* The label is hidden on narrow screens, so name the button explicitly. */
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(target)}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    className={styles.tabPill}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <span className={styles.tabLabel}>
                  <Icon size={16} />
                  <span className={styles.tabText}>{label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <button
          className={styles.themeButton}
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              className={styles.themeIcon}
              initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {theme === 'dark' ? <MoonIcon size={17} /> : <SunIcon size={17} />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </header>
  );
}
