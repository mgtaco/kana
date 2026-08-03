import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import type { View } from '../App';
import { KANA } from '../data/hiragana';
import { LESSONS, completedCount, nextLesson } from '../lib/lessons';
import type { Drill } from '../lib/quiz';
import { dueCount } from '../lib/review';
import type { Store } from '../lib/storage';
import { masteryOf, overallStats, streakDays } from '../lib/storage';
import type { Mastery } from '../lib/storage';
import { percent } from '../lib/util';
import ConfirmDialog from './ConfirmDialog';
import {
  ArrowRightIcon,
  BoltIcon,
  BookIcon,
  FlameIcon,
  GridIcon,
  RefreshIcon,
  TargetIcon,
} from './icons';

import styles from './Home.module.css';

interface HomeProps {
  store: Store;
  onNavigate: (view: View) => void;
  onOpenLesson: (id: string) => void;
  onQuickDrill: (drill: Drill) => void;
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

export default function Home({
  store,
  onNavigate,
  onOpenLesson,
  onQuickDrill,
  onResetProgress,
}: HomeProps) {
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

  const next = useMemo(() => nextLesson(store), [store]);
  const due = useMemo(() => dueCount(store), [store]);
  const streak = useMemo(() => streakDays(store), [store]);
  const lessonsDone = completedCount(store);

  /**
   * Which of the two homes to show, read straight off the store rather than out
   * of a flag of its own — which is also what makes Reset progress hand back the
   * introduction, exactly as it should.
   */
  const returning =
    store.sessions.length > 0 ||
    Object.keys(store.lessons).length > 0 ||
    Object.keys(store.progress).length > 0;

  const hasProgress = stats.practised > 0;

  return (
    <div className={styles.home}>
      {returning ? (
        <>
          <section className={styles.strip}>
            <StripStat
              icon={<FlameIcon size={15} />}
              value={`${streak}`}
              label="day streak"
              tone={streak > 0 ? 'seal' : undefined}
            />
            <StripStat icon={<RefreshIcon size={15} />} value={`${due}`} label="due for review" />
            <StripStat
              icon={<TargetIcon size={15} />}
              value={`${stats.mastered}`}
              label={`of ${KANA.length} mastered`}
            />
          </section>

          <ContinueCard
            next={next}
            lessonsDone={lessonsDone}
            due={due}
            onOpenLesson={onOpenLesson}
            onReview={() => onQuickDrill('review')}
          />

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>Quick practice</h2>
            </div>
            <div className={styles.quickGrid}>
              <QuickAction
                icon={<RefreshIcon size={17} />}
                label="Review"
                onClick={() => onQuickDrill('review')}
                disabled={!hasProgress}
              />
              <QuickAction
                icon={<BookIcon size={17} />}
                label="Words"
                onClick={() => onQuickDrill('words')}
              />
              <QuickAction
                icon={<BoltIcon size={17} />}
                label="Speed run"
                onClick={() => onQuickDrill('speed')}
              />
              <QuickAction
                icon={<GridIcon size={17} />}
                label="Chart"
                onClick={() => onNavigate('chart')}
              />
              <QuickAction
                icon={<TargetIcon size={17} />}
                label="Quiz"
                onClick={() => onNavigate('setup')}
              />
            </div>
          </section>
        </>
      ) : (
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <span className="jp-caption">ひらがな</span>
            <h1 className={styles.title}>
              Read <span className={styles.titleAccent}>ひらがな</span> without thinking about it.
            </h1>
            <p className={styles.lede}>
              Twenty short lessons take you through all {KANA.length} characters five at a time,
              with a hook for every shape and real words to read as soon as you can read them.
            </p>
            <div className={styles.actions}>
              <button
                className="btn btn--primary btn--lg"
                onClick={() => onOpenLesson(LESSONS[0].id)}
              >
                Start lesson 1 · {LESSONS[0].japanese}
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
                  scale: {
                    type: 'spring',
                    stiffness: 200,
                    damping: 16,
                    delay: 0.15 + delay * 0.12,
                  },
                  y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay },
                }}
              >
                {kana}
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {hasProgress && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Your progress</h2>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {stats.quizzes} {stats.quizzes === 1 ? 'round' : 'rounds'} completed
            </span>
          </div>

          <div className={styles.statGrid}>
            <StatTile value={`${stats.practised}`} label={`of ${KANA.length} characters seen`} />
            <StatTile value={`${lessonsDone}`} label={`of ${LESSONS.length} lessons done`} />
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

      <ConfirmDialog
        open={confirmReset}
        title="Reset all progress?"
        body="Every character's history, your finished lessons and all past round results will be cleared. This can't be undone."
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

/** The big card: whatever the next thing to do actually is. */
function ContinueCard({
  next,
  lessonsDone,
  due,
  onOpenLesson,
  onReview,
}: {
  next: ReturnType<typeof nextLesson>;
  lessonsDone: number;
  due: number;
  onOpenLesson: (id: string) => void;
  onReview: () => void;
}) {
  const finished = next === null;

  return (
    <motion.button
      className={`${styles.continue} card`}
      onClick={() => (finished ? onReview() : onOpenLesson(next.id))}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.continueIcon}>
        {finished ? <RefreshIcon size={20} /> : <BookIcon size={20} />}
      </span>
      <span className={styles.continueBody}>
        <span className="eyebrow">
          {finished ? 'Every lesson done' : lessonsDone === 0 ? 'Start here' : 'Continue'}
        </span>
        <span className={styles.continueTitle}>
          {finished ? 'Review' : `Lesson ${lessonsDone + 1} · ${next.title}`}
        </span>
        <span className={styles.continueSub}>
          {finished
            ? due > 0
              ? `${due} characters want another look.`
              : 'Everything is settled — go again whenever you like.'
            : next.subtitle}
        </span>
      </span>
      <span className={styles.continueArrow} aria-hidden="true">
        <ArrowRightIcon size={18} />
      </span>
    </motion.button>
  );
}

function StripStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  tone?: 'seal';
}) {
  return (
    <div className={`${styles.stripItem} card`}>
      <span className={styles.stripIcon} data-tone={tone}>
        {icon}
      </span>
      <span className={styles.stripValue}>{value}</span>
      <span className={styles.stripLabel}>{label}</span>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={`${styles.quick} card`} onClick={onClick} disabled={disabled}>
      <span className={styles.quickIcon}>{icon}</span>
      <span className={styles.quickLabel}>{label}</span>
    </button>
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
