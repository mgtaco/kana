import { useMemo, useState } from 'react';
import { motion } from 'motion/react';

import { GROUP_META, GROUP_ORDER, kanaForGroups } from '../data/hiragana';
import type { KanaGroup } from '../data/hiragana';
import { WORDS, wordsReadableWith } from '../data/words';
import type { Drill, QuizConfig, QuizMode } from '../lib/quiz';
import { dueCount } from '../lib/review';
import type { Store } from '../lib/storage';
import { metCharacters } from '../lib/storage';
import {
  ArrowRightIcon,
  BoltIcon,
  BookIcon,
  CheckIcon,
  RefreshIcon,
  ShuffleIcon,
  SparkIcon,
  TargetIcon,
} from './icons';

import styles from './QuizSetup.module.css';

interface QuizSetupProps {
  initial: QuizConfig;
  store: Store;
  onStart: (config: QuizConfig) => void;
  onCancel: () => void;
}

const DRILLS: { id: Drill; title: string; body: string; Icon: typeof TargetIcon }[] = [
  {
    id: 'characters',
    title: 'Characters',
    body: 'One character at a time, from the sets you choose.',
    Icon: TargetIcon,
  },
  {
    id: 'words',
    title: 'Words',
    body: 'Read a whole word — small tsu, long vowels and all.',
    Icon: BookIcon,
  },
  {
    id: 'speed',
    title: 'Speed run',
    body: 'As many as you can before the clock runs out.',
    Icon: BoltIcon,
  },
  {
    id: 'review',
    title: 'Review',
    body: 'Weighted to whatever you are weakest and coldest on.',
    Icon: RefreshIcon,
  },
];

const MODES: { id: QuizMode; title: string; body: string; wordBody: string; Icon: typeof TargetIcon }[] = [
  {
    id: 'type',
    title: 'Type the reading',
    body: 'See a character, type its rōmaji. Trains real reading recall.',
    wordBody: 'See a word, type the whole reading.',
    Icon: TargetIcon,
  },
  {
    id: 'choose',
    title: 'Pick the answer',
    body: 'See a reading, choose from six characters that look alike.',
    wordBody: 'See a word, choose from four meanings.',
    Icon: SparkIcon,
  },
  {
    id: 'mixed',
    title: 'Mix both',
    body: 'Alternates between the two at random. The best test once you know them.',
    wordBody: 'Alternates between reading and meaning at random.',
    Icon: ShuffleIcon,
  },
];

const LENGTHS: (number | 'all')[] = [10, 20, 40, 'all'];
const DURATIONS = [30_000, 60_000, 120_000];

const MODE_SUMMARY: Record<QuizMode, string> = {
  type: 'typing the reading',
  choose: 'picking the answer',
  mixed: 'a mix of both',
};

export default function QuizSetup({ initial, store, onStart, onCancel }: QuizSetupProps) {
  const [drill, setDrill] = useState<Drill>(initial.drill);
  const [groups, setGroups] = useState<KanaGroup[]>(initial.groups);
  const [mode, setMode] = useState<QuizMode>(initial.mode);
  const [length, setLength] = useState<number | 'all'>(initial.length);
  const [knownOnly, setKnownOnly] = useState(initial.wordsKnownOnly ?? true);
  const [sprintMs, setSprintMs] = useState(initial.sprintMs ?? 60_000);

  const met = useMemo(() => metCharacters(store), [store]);
  const due = useMemo(() => dueCount(store), [store]);
  const readableWords = useMemo(
    () => (knownOnly ? wordsReadableWith(met).length : Infinity),
    [knownOnly, met],
  );

  const hasProgress = met.size > 0;
  const available = DRILLS.filter((entry) => entry.id !== 'review' || hasProgress);

  const poolSize = useMemo(() => kanaForGroups(groups).length, [groups]);
  const questionCount = length === 'all' ? poolSize : Math.min(length, poolSize);

  const chooseDrill = (id: Drill) => {
    setDrill(id);
    // "Everything" over three hundred words is not a round, it is an afternoon.
    if (id === 'words' && length === 'all') setLength(20);
  };
  const valid = drill === 'characters' || drill === 'speed' ? groups.length > 0 : true;

  const toggleGroup = (group: KanaGroup) => {
    setGroups((current) =>
      current.includes(group)
        ? current.filter((entry) => entry !== group)
        : GROUP_ORDER.filter((entry) => entry === group || current.includes(entry)),
    );
  };

  const start = () =>
    onStart({
      drill,
      groups,
      mode,
      length,
      wordsKnownOnly: knownOnly,
      sprintMs,
    });

  return (
    <div className={styles.setup}>
      <div className={styles.head}>
        <h1 className={styles.title}>Practise</h1>
        <p className={styles.lede}>
          Four ways to drill what the lessons have taught you. Everything but the speed run brings
          back anything you miss once, at the end of the round, for a second look.
        </p>
      </div>

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>What to drill</h2>
        </div>
        <div className={styles.modeGrid}>
          {available.map(({ id, title, body, Icon }) => (
            <button
              key={id}
              className={styles.modeOption}
              data-selected={drill === id}
              aria-pressed={drill === id}
              onClick={() => chooseDrill(id)}
            >
              <span className={styles.modeIcon}>
                <Icon size={19} />
              </span>
              <span className={styles.modeTitle}>{title}</span>
              <span className={styles.modeBody}>
                {id === 'review' && due > 0 ? `${due} need another look.` : body}
              </span>
            </button>
          ))}
        </div>
      </section>

      {drill === 'words' ? (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>Which words</h2>
          </div>
          <button
            className={styles.toggleRow}
            data-selected={knownOnly}
            aria-pressed={knownOnly}
            onClick={() => setKnownOnly((current) => !current)}
          >
            <span className={styles.tick} aria-hidden="true">
              <CheckIcon size={11} />
            </span>
            <span className={styles.toggleBody}>
              <span className={styles.toggleLabel}>Only characters I&rsquo;ve met</span>
              <span className={styles.toggleHint}>
                {knownOnly
                  ? `${readableWords} word${readableWords === 1 ? '' : 's'} you can read right now.`
                  : 'Every word in the list, including ones using characters you have not seen.'}
              </span>
            </span>
          </button>
        </section>
      ) : drill === 'review' ? (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>Which characters</h2>
          </div>
          <p className={styles.note}>
            Chosen for you: whatever you have got wrong most often, and whatever you have not seen
            for longest. Look-alikes you are shaky on are pulled in together, so they turn up in the
            same round.
          </p>
        </section>
      ) : (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>Which characters</h2>
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
      )}

      <section className={styles.block}>
        <div className={styles.blockHead}>
          <h2 className={styles.blockTitle}>Mode</h2>
        </div>
        <div className={styles.modeGrid}>
          {MODES.map(({ id, title, body, wordBody, Icon }) => (
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
              <span className={styles.modeBody}>{drill === 'words' ? wordBody : body}</span>
            </button>
          ))}
        </div>
      </section>

      {drill === 'speed' ? (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>How long</h2>
            <span className={styles.blockHint}>No second looks — the clock decides</span>
          </div>
          <div className={styles.chips}>
            {DURATIONS.map((option) => (
              <button
                key={option}
                className={styles.chip}
                data-selected={sprintMs === option}
                aria-pressed={sprintMs === option}
                onClick={() => setSprintMs(option)}
              >
                {option / 1000} seconds
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.block}>
          <div className={styles.blockHead}>
            <h2 className={styles.blockTitle}>Round length</h2>
            {drill === 'characters' && <span className={styles.blockHint}>{poolSize} available</span>}
          </div>
          <div className={styles.chips}>
            {LENGTHS.map((option) => {
              const disabled =
                drill === 'characters' && typeof option === 'number' && option > poolSize;
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
                  {option === 'all'
                    ? drill === 'words'
                      ? `Everything (${readableWords === Infinity ? WORDS.length : readableWords})`
                      : `Everything (${poolSize})`
                    : option}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <div className={styles.footer}>
        {valid ? (
          <p className={styles.summary}>
            {drill === 'speed'
              ? `${sprintMs / 1000} seconds of characters, ${MODE_SUMMARY[mode]}.`
              : drill === 'words'
                ? `Words, ${MODE_SUMMARY[mode]}.`
                : drill === 'review'
                  ? `Your weakest characters, ${MODE_SUMMARY[mode]}.`
                  : `${questionCount} characters, ${MODE_SUMMARY[mode]}.`}
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
          onClick={start}
          whileTap={valid ? { scale: 0.97 } : undefined}
        >
          Start round
          <ArrowRightIcon size={17} />
        </motion.button>
      </div>
    </div>
  );
}
