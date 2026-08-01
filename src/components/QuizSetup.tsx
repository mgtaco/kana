import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

import { GROUP_META, GROUP_ORDER, kanaForGroups } from '../data/hiragana';
import type { KanaGroup } from '../data/hiragana';
import type { QuizConfig, QuizMode } from '../lib/quiz';
import { ArrowRightIcon, CheckIcon, ShuffleIcon, SparkIcon, TargetIcon } from './icons';

import styles from './QuizSetup.module.css';

interface QuizSetupProps {
  initial: QuizConfig;
  onStart: (config: QuizConfig) => void;
  onCancel: () => void;
}

const MODES: { id: QuizMode; title: string; body: string; Icon: typeof TargetIcon }[] = [
  {
    id: 'type',
    title: 'Type the reading',
    body: 'See a character, type its rōmaji. Trains real reading recall.',
    Icon: TargetIcon,
  },
  {
    id: 'choose',
    title: 'Pick the character',
    body: 'See a reading, choose from six characters that look alike.',
    Icon: SparkIcon,
  },
  {
    id: 'mixed',
    title: 'Mix both',
    body: 'Alternates between the two at random. The best test once you know them.',
    Icon: ShuffleIcon,
  },
];

const LENGTHS: (number | 'all')[] = [10, 20, 40, 'all'];

const MODE_SUMMARY: Record<QuizMode, string> = {
  type: 'typing the reading',
  choose: 'picking the character',
  mixed: 'a mix of both',
};

export default function QuizSetup({ initial, onStart, onCancel }: QuizSetupProps) {
  const [groups, setGroups] = useState<KanaGroup[]>(initial.groups);
  const [mode, setMode] = useState<QuizMode>(initial.mode);
  const [length, setLength] = useState<number | 'all'>(initial.length);

  const poolSize = useMemo(() => kanaForGroups(groups).length, [groups]);
  const questionCount = length === 'all' ? poolSize : Math.min(length, poolSize);
  const valid = groups.length > 0;

  const toggleGroup = (group: KanaGroup) => {
    setGroups((current) =>
      current.includes(group)
        ? current.filter((entry) => entry !== group)
        : GROUP_ORDER.filter((entry) => entry === group || current.includes(entry)),
    );
  };

  return (
    <div className={styles.setup}>
      <div className={styles.head}>
        <h1 className={styles.title}>Set up your round</h1>
        <p className={styles.lede}>
          Work through every character once, then anything you got wrong comes back at the end for
          a second look. Only one — a character is never asked a third time.
        </p>
      </div>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Characters</h2>
          <span className={styles.blockHint}>Pick one or more</span>
        </div>
        <div className={styles.setGrid}>
          {GROUP_ORDER.map((group) => {
            const meta = GROUP_META[group];
            const selected = groups.includes(group);
            return (
              <button
                key={group}
                className={styles.setOption}
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => toggleGroup(group)}
              >
                <span className={styles.setLabelRow}>
                  <span className={styles.tick} aria-hidden="true">
                    <CheckIcon size={11} />
                  </span>
                  <span className={styles.setLabel}>{meta.label}</span>
                  <span className={styles.setCount}>{kanaForGroups([group]).length}</span>
                </span>
                <span className={styles.setSample}>{meta.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Mode</h2>
        </div>
        <div className={styles.modeGrid}>
          {MODES.map(({ id, title, body, Icon }) => (
            <button
              key={id}
              className={styles.modeOption}
              data-selected={mode === id}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              <span className={styles.modeIcon}>
                <Icon size={19} />
              </span>
              <span className={styles.modeTitle}>{title}</span>
              <span className={styles.modeBody}>{body}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Round length</h2>
          <span className={styles.blockHint}>{poolSize} available</span>
        </div>
        <div className={styles.chips}>
          {LENGTHS.map((option) => {
            const disabled = typeof option === 'number' && option > poolSize;
            return (
              <button
                key={String(option)}
                className={styles.chip}
                data-selected={length === option}
                aria-pressed={length === option}
                disabled={disabled}
                style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
                onClick={() => setLength(option)}
              >
                {option === 'all' ? `Everything (${poolSize})` : option}
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.footer}>
        {valid ? (
          <p className={styles.summary}>
            {questionCount} characters, {MODE_SUMMARY[mode]}.
          </p>
        ) : (
          <p className={styles.warning}>Choose at least one set of characters.</p>
        )}
        <button className="btn btn--ghost" onClick={onCancel}>
          Back
        </button>
        <motion.button
          className="btn btn--primary btn--lg"
          disabled={!valid}
          onClick={() => onStart({ groups, mode, length })}
          whileTap={valid ? { scale: 0.97 } : undefined}
        >
          Start round
          <ArrowRightIcon size={17} />
        </motion.button>
      </div>
    </div>
  );
}
