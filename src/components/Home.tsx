import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

import type { View } from '../App';
import { KANA } from '../data/hiragana';
import type { Store } from '../lib/storage';
import { masteryOf, overallStats } from '../lib/storage';
import type { Mastery } from '../lib/storage';
import { percent } from '../lib/util';
import ConfirmDialog from './ConfirmDialog';
import { ArrowRightIcon, GridIcon, SparkIcon, TargetIcon } from './icons';

import styles from './Home.module.css';

interface HomeProps {
  store: Store;
  onNavigate: (view: View) => void;
  onResetProgress: () => void;
}

const FLOATERS = [
  { kana: 'き', className: styles.tileA, delay: 0 },
  { kana: 'ぬ', className: styles.tileB, delay: 0.7 },
  { kana: 'ま', className: styles.tileC, delay: 1.4 },
  { kana: 'ろ', className: styles.tileD, delay: 2.1 },
];

const MASTERY_COLORS: Record<Exclude<Mastery, 'new'>, string> = {
  mastered: 'var(--success)',
  familiar: 'var(--accent)',
  learning: 'var(--seal)',
};

const MASTERY_ORDER: Exclude<Mastery, 'new'>[] = ['mastered', 'familiar', 'learning'];

const MASTERY_TEXT: Record<Exclude<Mastery, 'new'>, string> = {
  mastered: 'Mastered',
  familiar: 'Getting there',
  learning: 'Still learning',
};

export default function Home({ store, onNavigate, onResetProgress }: HomeProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const stats = useMemo(() => overallStats(store), [store]);
  const breakdown = useMemo(() => {
    const counts: Record<Exclude<Mastery, 'new'>, number> = {
      mastered: 0,
      familiar: 0,
      learning: 0,
    };
    for (const entry of KANA) {
      const level = masteryOf(store.progress[entry.kana]);
      if (level !== 'new') counts[level] += 1;
    }
    return counts;
  }, [store]);

  const hasProgress = stats.practised > 0;

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className="jp-caption">ひらがな</span>
          <h1 className={styles.title}>
            Read <span className={styles.titleAccent}>ひらがな</span> without thinking about it.
          </h1>
          <p className={styles.lede}>
            All {KANA.length} characters in one readable chart, plus two drills that train recall in
            both directions. Anything you miss comes back before the round is over.
          </p>
          <div className={styles.actions}>
            <button className="btn btn--primary btn--lg" onClick={() => onNavigate('setup')}>
              Start a quiz
              <ArrowRightIcon size={17} />
            </button>
            <button className="btn btn--secondary btn--lg" onClick={() => onNavigate('chart')}>
              <GridIcon size={17} />
              Browse the chart
            </button>
          </div>
        </div>

        <div className={styles.art} aria-hidden="true">
          <div className={styles.artGlow} />
          <motion.div
            className={`${styles.tile} ${styles.tileMain} kana-glyph`}
            initial={{ opacity: 0, scale: 0.85, rotate: -6 }}
            animate={{ opacity: 1, scale: 1, rotate: -3 }}
            transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.05 }}
          >
            あ
          </motion.div>
          {FLOATERS.map(({ kana, className, delay }) => (
            <motion.div
              key={kana}
              className={`${styles.tile} ${styles.tileSmall} ${className} kana-glyph`}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1, y: [0, -7, 0] }}
              transition={{
                opacity: { duration: 0.4, delay: 0.15 + delay * 0.12 },
                scale: { type: 'spring', stiffness: 200, damping: 16, delay: 0.15 + delay * 0.12 },
                y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay },
              }}
            >
              {kana}
            </motion.div>
          ))}
        </div>
      </section>

      {hasProgress && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Your progress</h2>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {stats.quizzes} {stats.quizzes === 1 ? 'quiz' : 'quizzes'} completed
            </span>
          </div>

          <div className={styles.statGrid}>
            <StatTile value={`${stats.practised}`} label={`of ${KANA.length} characters seen`} />
            <StatTile value={`${stats.mastered}`} label="mastered" />
            <StatTile value={`${stats.bestAccuracy}%`} label="best round" />
            <StatTile
              value={`${percent(stats.mastered, KANA.length)}%`}
              label="of the syllabary solid"
            />
          </div>

          <div className={styles.masteryBar} role="img" aria-label="Mastery breakdown">
            {MASTERY_ORDER.map((level) => (
              <motion.div
                key={level}
                className={styles.masterySeg}
                style={{ background: MASTERY_COLORS[level] }}
                initial={{ width: 0 }}
                animate={{ width: `${percent(breakdown[level], KANA.length)}%` }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              />
            ))}
          </div>
          <div className={styles.masteryLegend}>
            {MASTERY_ORDER.map((level) => (
              <span key={level} className={styles.legendItem}>
                <span
                  className={styles.legendDot}
                  style={{ background: MASTERY_COLORS[level] }}
                  aria-hidden="true"
                />
                {MASTERY_TEXT[level]} · {breakdown[level]}
              </span>
            ))}
            <span className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: 'var(--surface-3)', border: '1px solid var(--line-strong)' }}
                aria-hidden="true"
              />
              Not seen yet · {KANA.length - stats.practised}
            </span>
          </div>

          <div className={styles.resetRow}>
            <button className="btn btn--ghost" onClick={() => setConfirmReset(true)}>
              Reset progress
            </button>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Two ways to drill</h2>
        </div>
        <div className={styles.modeGrid}>
          <button className={`${styles.mode} card`} onClick={() => onNavigate('setup')}>
            <span className={styles.modeIcon}>
              <TargetIcon size={18} />
            </span>
            <span className={styles.modeTitle}>Recall — type the reading</span>
            <span className={styles.modeBody}>
              A character fills the screen and you type its rōmaji. The harder direction, and the
              one that makes reading stick.
            </span>
            <span className={`${styles.modeSample} kana-glyph`}>ふ → fu</span>
          </button>

          <button className={`${styles.mode} card`} onClick={() => onNavigate('setup')}>
            <span className={styles.modeIcon}>
              <SparkIcon size={18} />
            </span>
            <span className={styles.modeTitle}>Recognise — pick the character</span>
            <span className={styles.modeBody}>
              You see a reading and choose from six characters. Look-alikes are deliberately put
              side by side.
            </span>
            <span className={`${styles.modeSample} kana-glyph`}>nu → ぬ め わ ね れ</span>
          </button>
        </div>
      </section>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all progress?"
        body="Every character's history and all past round results will be cleared. This can't be undone."
        confirmLabel="Reset everything"
        tone="danger"
        onConfirm={() => {
          onResetProgress();
          setConfirmReset(false);
        }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <motion.div
      className={`${styles.stat} card`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </motion.div>
  );
}
