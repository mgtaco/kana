import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { MNEMONICS } from '../data/mnemonics';
import type { Word } from '../data/words';
import { createMixedQuiz, createQuizFrom, createWordQuizFrom } from '../lib/quiz';
import type { Quiz, QuizConfig, QuizSummary } from '../lib/quiz';
import { lessonKana, reviewKanaFor, wordsFor } from '../lib/lessons';
import type { Lesson, RuleNote } from '../lib/lessons';
import { shuffle } from '../lib/util';
import QuizRunner from './QuizRunner';
import { MnemonicLine } from './Mnemonic';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, RefreshIcon, TargetIcon } from './icons';

import styles from './Lesson.module.css';

interface LessonProps {
  lesson: Lesson;
  index: number;
  /** The lesson after this one, when there is one. */
  nextTitle: string | null;
  /** Lets the shell drop its chrome while a drill is on. */
  onRunningChange: (running: boolean) => void;
  onFinishRound: (summary: QuizSummary, config: QuizConfig) => void;
  onComplete: (accuracy: number) => void;
  onExit: () => void;
  onNext: () => void;
}

type Phase = 'meet' | 'drill' | 'drilled' | 'review' | 'done';

/** Lessons always mix the two directions: recognising and recalling are different. */
const LESSON_CONFIG: QuizConfig = {
  groups: ['basic', 'dakuten', 'combo'],
  mode: 'mixed',
  length: 'all',
  drill: 'characters',
};

/** Words are only worth mixing in once there is a real choice of them. */
const MIN_WORDS_FOR_REVIEW = 8;
const REVIEW_WORDS = 4;

export default function LessonView({
  lesson,
  index,
  nextTitle,
  onRunningChange,
  onFinishRound,
  onComplete,
  onExit,
  onNext,
}: LessonProps) {
  const [phase, setPhase] = useState<Phase>('meet');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [drillAccuracy, setDrillAccuracy] = useState(0);
  const [finalAccuracy, setFinalAccuracy] = useState(0);

  const cards = useMemo(() => buildCards(lesson), [lesson]);
  const readable = useMemo(() => wordsFor(index), [index]);

  const running = phase === 'drill' || phase === 'review';
  useEffect(() => {
    onRunningChange(running);
    return () => onRunningChange(false);
  }, [running, onRunningChange]);

  const startDrill = useCallback(() => {
    const kana = lessonKana(lesson);
    setQuiz(
      kana.length > 0
        ? createQuizFrom(kana, LESSON_CONFIG)
        : createWordQuizFrom(pickWords(readable, 10), { ...LESSON_CONFIG, drill: 'words' }),
    );
    setPhase('drill');
  }, [lesson, readable]);

  const startReview = useCallback(() => {
    const kana = reviewKanaFor(index);
    const words =
      readable.length >= MIN_WORDS_FOR_REVIEW ? pickWords(readable, REVIEW_WORDS) : [];
    setQuiz(createMixedQuiz(kana, words, LESSON_CONFIG));
    setPhase('review');
  }, [index, readable]);

  const finishRound = useCallback(
    (summary: QuizSummary) => {
      const config = quiz?.config ?? LESSON_CONFIG;
      onFinishRound(summary, config);
      if (phase === 'drill') {
        setDrillAccuracy(summary.accuracy);
        setPhase('drilled');
      } else {
        // The review is the last word on how well the lesson went, but skipping
        // it is allowed, so the drill's score stands in when it is skipped.
        setFinalAccuracy(summary.accuracy);
        onComplete(summary.accuracy);
        setPhase('done');
      }
      setQuiz(null);
    },
    [quiz, phase, onFinishRound, onComplete],
  );

  const skipReview = useCallback(() => {
    setFinalAccuracy(drillAccuracy);
    onComplete(drillAccuracy);
    setPhase('done');
  }, [drillAccuracy, onComplete]);

  if ((phase === 'drill' || phase === 'review') && quiz) {
    return <QuizRunner quiz={quiz} onFinish={finishRound} onExit={() => setPhase('meet')} />;
  }

  return (
    <div className={styles.lesson}>
      <div className={styles.head}>
        <button className={styles.back} onClick={onExit}>
          <ArrowLeftIcon size={15} />
          All lessons
        </button>
        <span className={styles.step}>Lesson {index + 1}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'meet' && (
          <motion.div
            key="meet"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Meet lesson={lesson} cards={cards} onDone={startDrill} />
          </motion.div>
        )}

        {phase === 'drilled' && (
          <motion.div
            key="drilled"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Interlude
              eyebrow="Drill done"
              title={`${drillAccuracy}% first try`}
              body={
                readable.length >= MIN_WORDS_FOR_REVIEW
                  ? 'The review mixes these with what you already knew, and a few real words to read.'
                  : 'The review mixes these with the characters from earlier lessons.'
              }
            >
              <button className="btn btn--primary btn--lg" onClick={startReview}>
                <RefreshIcon size={16} />
                Review
              </button>
              <button className="btn btn--ghost" onClick={skipReview}>
                Skip the review
              </button>
            </Interlude>
          </motion.div>
        )}

        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <Interlude
              eyebrow="Lesson complete"
              title={lesson.title}
              body={`${finalAccuracy}% first try. ${
                nextTitle ? `Next up: ${nextTitle}.` : 'That was the last one — the chart is yours.'
              }`}
              tone="success"
            >
              {nextTitle && (
                <button className="btn btn--primary btn--lg" onClick={onNext}>
                  Next lesson
                  <ArrowRightIcon size={16} />
                </button>
              )}
              <button
                className={`btn ${nextTitle ? 'btn--ghost' : 'btn--primary btn--lg'}`}
                onClick={onExit}
              >
                All lessons
              </button>
            </Interlude>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Meet: one card per character ────────────────────────────────────────────

interface Card {
  glyph: string;
  reading: string;
  hint: string;
  emoji?: string;
  note?: string;
  example?: { word: string; romaji: string; meaning: string };
}

function buildCards(lesson: Lesson): Card[] {
  if (lesson.notes?.length) {
    return lesson.notes.map((note: RuleNote) => ({
      glyph: note.glyph,
      reading: note.title,
      hint: '',
      note: note.body,
      example: note.example,
    }));
  }

  return lessonKana(lesson).map((kana) => ({
    glyph: kana.kana,
    reading: kana.romaji,
    hint: MNEMONICS[kana.kana]?.hint ?? '',
    emoji: MNEMONICS[kana.kana]?.emoji,
    example: kana.example,
  }));
}

function Meet({
  lesson,
  cards,
  onDone,
}: {
  lesson: Lesson;
  cards: Card[];
  onDone: () => void;
}) {
  const [at, setAt] = useState(0);
  const [direction, setDirection] = useState(1);

  const step = useCallback(
    (delta: number) => {
      setDirection(delta);
      setAt((current) => Math.min(cards.length - 1, Math.max(0, current + delta)));
    },
    [cards.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step]);

  const card = cards[at];
  const last = at === cards.length - 1;

  return (
    <div className={styles.meet}>
      <div className={styles.intro}>
        <span className="jp-caption">{lesson.japanese}</span>
        <h1 className={styles.title}>{lesson.title}</h1>
        <p className={styles.subtitle}>{lesson.subtitle}</p>
      </div>

      <div className={styles.dots} role="tablist" aria-label="Cards">
        {cards.map((entry, dotIndex) => (
          <button
            key={entry.glyph}
            className={styles.dot}
            data-active={dotIndex === at}
            aria-label={`Card ${dotIndex + 1}: ${entry.glyph}`}
            aria-selected={dotIndex === at}
            role="tab"
            onClick={() => {
              setDirection(dotIndex > at ? 1 : -1);
              setAt(dotIndex);
            }}
          />
        ))}
      </div>

      <div className={styles.cardStage}>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={card.glyph}
            className={`${styles.card} card`}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.16}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60 || info.velocity.x < -450) step(1);
              else if (info.offset.x > 60 || info.velocity.x > 450) step(-1);
            }}
          >
            <span
              className={`${styles.glyph} ${
                [...card.glyph].length > 1 ? styles.glyphWide : ''
              } kana-glyph`}
            >
              {card.glyph}
            </span>
            <span className={styles.reading}>{card.reading}</span>

            {card.hint && (
              <div className={styles.hintRow}>
                {card.emoji && (
                  <span className={styles.emoji} aria-hidden="true">
                    {card.emoji}
                  </span>
                )}
                <MnemonicLine hint={card.hint} className={styles.hintText} />
              </div>
            )}

            {card.note && <p className={styles.note}>{card.note}</p>}

            {card.example && (
              <div className={styles.example}>
                <span className={`${styles.exampleWord} kana-glyph`}>{card.example.word}</span>
                <span className={styles.exampleMeta}>
                  {card.example.romaji} — {card.example.meaning}
                </span>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className={styles.meetNav}>
        <button
          className={`btn ${styles.navBtn}`}
          onClick={() => step(-1)}
          disabled={at === 0}
          aria-label="Previous card"
        >
          <ArrowLeftIcon size={16} />
        </button>

        {last ? (
          <button className="btn btn--primary btn--lg" onClick={onDone}>
            <TargetIcon size={16} />
            Drill these
          </button>
        ) : (
          <button className="btn btn--secondary btn--lg" onClick={() => step(1)}>
            Next
            <ArrowRightIcon size={16} />
          </button>
        )}

        <button
          className={`btn ${styles.navBtn}`}
          onClick={() => step(1)}
          disabled={last}
          aria-label="Next card"
        >
          <ArrowRightIcon size={16} />
        </button>
      </div>

      <p className={styles.meetHint}>
        {at + 1} of {cards.length} · swipe or use the arrow keys
      </p>

      {!last && (
        <button className={`btn btn--ghost ${styles.skipAhead}`} onClick={onDone}>
          Skip ahead to the drill
        </button>
      )}
    </div>
  );
}

// ── The compact screen between phases ───────────────────────────────────────

function Interlude({
  eyebrow,
  title,
  body,
  tone,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  tone?: 'success';
  children: ReactNode;
}) {
  return (
    <div className={`${styles.interlude} card`}>
      <span className={styles.interludeMark} data-tone={tone} aria-hidden="true">
        {tone === 'success' ? <CheckIcon size={20} /> : <TargetIcon size={20} />}
      </span>
      <span className="eyebrow">{eyebrow}</span>
      <h1 className={styles.interludeTitle}>{title}</h1>
      <p className={styles.interludeBody}>{body}</p>
      <div className={styles.interludeActions}>{children}</div>
    </div>
  );
}

function pickWords(words: Word[], count: number): Word[] {
  return shuffle(words).slice(0, Math.min(count, words.length));
}
