import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import type { KanaOutcome, QuizConfig, QuizSummary } from '../lib/quiz';
import { formatDuration, formatSeconds } from '../lib/util';
import { CheckIcon, ClockIcon, FlameIcon, RefreshIcon, TargetIcon } from './icons';

import styles from './Results.module.css';

interface ResultsProps {
  summary: QuizSummary;
  config: QuizConfig;
  onPractiseMissed: () => void;
  onRepeat: () => void;
  onChangeSettings: () => void;
  onHome: () => void;
}

const RING_RADIUS = 54;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function headlineFor(accuracy: number, missed: number): { title: string; body: string } {
  if (accuracy === 100) {
    return { title: 'Flawless round.', body: 'Every character first try. Time to add a new set.' };
  }
  if (accuracy >= 90) {
    return { title: 'Excellent.', body: `Only ${missed} slipped through — and you saw them again.` };
  }
  if (accuracy >= 75) {
    return { title: 'Solid round.', body: 'The shapes are landing. A few more passes will lock it in.' };
  }
  if (accuracy >= 50) {
    return {
      title: 'Getting there.',
      body: 'More than half are yours already. Short, frequent rounds beat long ones.',
    };
  }
  return { title: 'Early days.', body: 'Try a shorter round over one row of the chart, then widen out.' };
}

/** Counts a number up on mount — used for the score so it lands with the ring. */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const frame = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutCubic
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration]);

  return value;
}

export default function Results({
  summary,
  config,
  onPractiseMissed,
  onRepeat,
  onChangeSettings,
  onHome,
}: ResultsProps) {
  const displayed = useCountUp(summary.accuracy);
  const headline = headlineFor(summary.accuracy, summary.missed.length);
  const solid = summary.outcomes.filter((outcome) => outcome.firstTryCorrect);

  return (
    <div className={styles.results}>
      <motion.section
        className={`${styles.score} card`}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.ring}>
          <svg className={styles.ringSvg} viewBox="0 0 128 128" aria-hidden="true">
            <circle
              className={styles.ringTrack}
              cx="64"
              cy="64"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
            />
            <motion.circle
              className={styles.ringValue}
              cx="64"
              cy="64"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeDasharray={RING_CIRCUMFERENCE}
              initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
              animate={{
                strokeDashoffset: RING_CIRCUMFERENCE * (1 - summary.accuracy / 100),
              }}
              transition={{ duration: 0.95, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            />
          </svg>
          <div className={styles.ringLabel}>
            <span className={styles.ringNumber}>{displayed}%</span>
            <span className={styles.ringCaption}>first try</span>
          </div>
        </div>

        <div className={styles.scoreText}>
          <h1 className={styles.headline}>{headline.title}</h1>
          <p className={styles.subline}>{headline.body}</p>
          <p className={styles.subline}>
            {summary.firstTryCorrect} of {summary.totalUnique} characters right first time
            {summary.totalAnswers > summary.totalUnique &&
              ` · ${summary.totalAnswers - summary.totalUnique} review ${
                summary.totalAnswers - summary.totalUnique === 1 ? 'card' : 'cards'
              }`}
            .
          </p>
        </div>
      </motion.section>

      <div className={styles.statGrid}>
        <Stat
          index={0}
          icon={<TargetIcon size={15} />}
          value={`${summary.totalUnique}`}
          label="characters drilled"
        />
        <Stat
          index={1}
          icon={<FlameIcon size={15} />}
          value={`${summary.bestStreak}`}
          label="best streak"
        />
        <Stat
          index={2}
          icon={<ClockIcon size={15} />}
          value={formatDuration(summary.elapsedMs)}
          label="total time"
        />
        <Stat
          index={3}
          icon={<ClockIcon size={15} />}
          value={formatSeconds(summary.avgMs)}
          label="per answer"
        />
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>
            {summary.missed.length > 0 ? 'What tripped you up' : 'Nothing tripped you up'}
          </h2>
          {summary.missed.length > 0 && (
            <span className={styles.sectionNote}>
              {summary.missed.filter((outcome) => outcome.recovered).length} of{' '}
              {summary.missed.length} came back right on the second look
            </span>
          )}
        </div>

        {summary.missed.length > 0 ? (
          <div className={styles.missList}>
            {summary.missed.map((outcome, index) => (
              <MissRow key={outcome.kana.kana} outcome={outcome} index={index} />
            ))}
          </div>
        ) : (
          <div className={`${styles.empty} card`}>
            A clean sweep — every character answered correctly the first time it appeared.
          </div>
        )}
      </section>

      {solid.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Solid</h2>
            <span className={styles.sectionNote}>
              {solid.length} {solid.length === 1 ? 'character' : 'characters'} answered first try
            </span>
          </div>
          <div className={styles.solidRow}>
            {solid.map((outcome, index) => (
              <motion.span
                key={outcome.kana.kana}
                className={`${styles.solidChip} kana-glyph`}
                title={outcome.kana.romaji}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.28,
                  delay: 0.25 + Math.min(index, 30) * 0.012,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {outcome.kana.kana}
              </motion.span>
            ))}
          </div>
        </section>
      )}

      <div className={styles.actions}>
        {summary.missed.length > 0 && (
          <button className="btn btn--primary btn--lg" onClick={onPractiseMissed}>
            <RefreshIcon size={16} />
            Practise the {summary.missed.length} you missed
          </button>
        )}
        <button
          className={`btn ${summary.missed.length > 0 ? 'btn--secondary' : 'btn--primary'} btn--lg`}
          onClick={onRepeat}
        >
          <CheckIcon size={16} />
          New round, same settings
        </button>
        <button className="btn btn--ghost" onClick={onChangeSettings}>
          Change settings
        </button>
        <button className={`btn btn--ghost ${styles.spacer}`} onClick={onHome}>
          Done
        </button>
        <span className="sr-only">
          Round mode: {config.mode}. Sets: {config.groups.join(', ')}.
        </span>
      </div>
    </div>
  );
}

function Stat({
  icon,
  value,
  label,
  index,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  index: number;
}) {
  return (
    <motion.div
      className={`${styles.stat} card`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: 0.08 + index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.statTop}>{icon}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </motion.div>
  );
}

function MissRow({ outcome, index }: { outcome: KanaOutcome; index: number }) {
  const wrong = outcome.wrongAnswers.filter(Boolean);
  const parts: string[] = [];
  if (outcome.skips > 0) parts.push(outcome.skips > 1 ? 'skipped twice' : 'skipped');
  if (wrong.length > 0) parts.push(`you said ${wrong.map((w) => `“${w}”`).join(', ')}`);
  const detail = parts.join(' · ');

  return (
    <motion.div
      className={styles.miss}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 + index * 0.04, ease: [0.22, 1, 0.36, 1] }}
    >
      <span
        className={`${styles.missGlyph} ${
          [...outcome.kana.kana].length > 1 ? styles.missGlyphWide : ''
        } kana-glyph`}
      >
        {outcome.kana.kana}
      </span>
      <span className={styles.missBody}>
        <span className={styles.missRomaji}>{outcome.kana.romaji}</span>
        {detail && <span className={styles.missDetail}>{detail}</span>}
      </span>
      <span
        className={`${styles.missTag} ${
          outcome.recovered ? styles.missTagRecovered : styles.missTagMissed
        }`}
      >
        {outcome.recovered ? 'got it on review' : 'still missed'}
      </span>
    </motion.div>
  );
}
