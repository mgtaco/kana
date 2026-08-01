import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import type { Kana } from '../data/hiragana';
import { isCorrectRomaji, teachableAlternates } from '../lib/romaji';
import { scheduleRetry, summarize } from '../lib/quiz';
import type { Answer, Question, Quiz, QuizSummary } from '../lib/quiz';
import { percent } from '../lib/util';
import ConfirmDialog from './ConfirmDialog';
import { ArrowRightIcon, CheckIcon, CrossIcon, FlameIcon, RefreshIcon } from './icons';

import styles from './QuizRunner.module.css';

interface QuizRunnerProps {
  quiz: Quiz;
  onFinish: (summary: QuizSummary) => void;
  onExit: () => void;
}

interface Feedback {
  correct: boolean;
  given: string;
  /** The character was missed and will come back once more this round. */
  requeued: boolean;
}

interface State {
  queue: Question[];
  answers: Answer[];
  /** Characters that have left the queue for good — drives the progress bar. */
  resolved: number;
  feedback: Feedback | null;
  startedAt: number;
  questionStartedAt: number;
  endedAt: number | null;
}

type Action =
  | { type: 'answer'; given: string; correct: boolean; at: number }
  | { type: 'advance'; quiz: Quiz; at: number };

function init(quiz: Quiz): State {
  const now = Date.now();
  return {
    queue: quiz.queue,
    answers: [],
    resolved: 0,
    feedback: null,
    startedAt: now,
    questionStartedAt: now,
    endedAt: null,
  };
}

function reducer(state: State, action: Action): State {
  const current = state.queue[0];
  if (!current) return state;

  switch (action.type) {
    case 'answer': {
      if (state.feedback) return state;
      const requeued = !action.correct && !current.isRetry;
      const answer: Answer = {
        kana: current.kana,
        mode: current.mode,
        isRetry: current.isRetry,
        correct: action.correct,
        given: action.given,
        elapsedMs: action.at - state.questionStartedAt,
      };
      return {
        ...state,
        answers: [...state.answers, answer],
        resolved: state.resolved + (requeued ? 0 : 1),
        feedback: { correct: action.correct, given: action.given, requeued },
      };
    }

    case 'advance': {
      if (!state.feedback) return state;
      let rest = state.queue.slice(1);
      if (state.feedback.requeued) rest = scheduleRetry(rest, current, action.quiz);
      if (rest.length === 0) {
        return { ...state, queue: [], feedback: null, endedAt: action.at };
      }
      return { ...state, queue: rest, feedback: null, questionStartedAt: action.at };
    }

    default:
      return state;
  }
}

export default function QuizRunner({ quiz, onFinish, onExit }: QuizRunnerProps) {
  const [state, dispatch] = useReducer(reducer, quiz, init);
  const [confirmExit, setConfirmExit] = useState(false);
  const finishedRef = useRef(false);

  const current = state.queue[0];
  const { feedback } = state;

  const advance = useCallback(() => {
    dispatch({ type: 'advance', quiz, at: Date.now() });
  }, [quiz]);

  const answer = useCallback((given: string, correct: boolean) => {
    dispatch({ type: 'answer', given, correct, at: Date.now() });
  }, []);

  // Hand the finished round up exactly once.
  useEffect(() => {
    if (!state.endedAt || finishedRef.current) return;
    finishedRef.current = true;
    onFinish(summarize(state.answers, state.endedAt - state.startedAt));
  }, [state.endedAt, state.answers, state.startedAt, onFinish]);

  // A correct answer moves on by itself; a miss waits so the answer can be read.
  useEffect(() => {
    if (!feedback?.correct) return;
    const timer = setTimeout(advance, 720);
    return () => clearTimeout(timer);
  }, [feedback, advance]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (confirmExit) return;
      if (event.key === 'Escape') {
        setConfirmExit(true);
        return;
      }
      if (feedback) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          advance();
        }
        return;
      }
      if (current?.mode === 'choose') {
        const index = Number(event.key) - 1;
        const choice = current.choices[index];
        if (choice) {
          event.preventDefault();
          answer(choice.kana, choice.romaji === current.kana.romaji);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmExit, feedback, current, advance, answer]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = state.answers.length - 1; i >= 0; i--) {
      if (!state.answers[i].correct) break;
      count += 1;
    }
    return count;
  }, [state.answers]);

  if (!current) return <div className={styles.runner} />;

  const progress = percent(state.resolved, quiz.totalUnique);

  return (
    <div className={styles.runner}>
      <div className={styles.bar}>
        <button className={styles.exit} onClick={() => setConfirmExit(true)} aria-label="End round">
          <CrossIcon size={17} />
        </button>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={state.resolved}
          aria-valuemin={0}
          aria-valuemax={quiz.totalUnique}
          aria-label="Round progress"
        >
          <motion.div
            className={styles.progressFill}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 220, damping: 32 }}
          />
        </div>

        <div className={styles.counter}>
          <AnimatePresence>
            {streak >= 3 && (
              <motion.span
                className={styles.streak}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <FlameIcon size={13} />
                {streak}
              </motion.span>
            )}
          </AnimatePresence>
          <span>
            {state.resolved}
            <span className="muted">/{quiz.totalUnique}</span>
          </span>
        </div>
      </div>

      <div className={styles.stage}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.key}
            className={styles.card}
            initial={{ opacity: 0, x: 24, scale: 0.98 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -24, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            {current.isRetry && (
              <span className={styles.retryBadge}>
                <RefreshIcon size={12} />
                Second look
              </span>
            )}

            {current.mode === 'type' ? (
              <TypeCard question={current} feedback={feedback} onAnswer={answer} onNext={advance} />
            ) : (
              <ChooseCard question={current} feedback={feedback} onAnswer={answer} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className={styles.feedbackSlot} aria-live="polite">
          <AnimatePresence mode="wait">
            {feedback && (
              <FeedbackPanel key={current.key} question={current} feedback={feedback} />
            )}
          </AnimatePresence>
        </div>

        {current.mode === 'choose' && (
          <div className={styles.actions}>
            <AnimatePresence>
              {feedback && !feedback.correct && (
                <motion.button
                  className="btn btn--primary btn--block"
                  onClick={advance}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  autoFocus
                >
                  Continue
                  <ArrowRightIcon size={17} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}

        <p className={styles.hint}>
          {current.mode === 'choose'
            ? 'Press 1–6 to answer · Enter to continue'
            : 'Enter to check · Enter again to continue'}
        </p>
      </div>

      <ConfirmDialog
        open={confirmExit}
        title="End this round?"
        body="Your answers so far will be discarded and nothing is added to your progress."
        confirmLabel="End round"
        cancelLabel="Keep going"
        tone="danger"
        onConfirm={onExit}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
}

// ── Typing question ─────────────────────────────────────────────────────────

interface CardProps {
  question: Question;
  feedback: Feedback | null;
  onAnswer: (given: string, correct: boolean) => void;
}

function TypeCard({ question, feedback, onAnswer, onNext }: CardProps & { onNext: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const state = feedback ? (feedback.correct ? 'correct' : 'wrong') : undefined;
  const glyphLength = [...question.kana.kana].length;

  return (
    <>
      <motion.div
        className={styles.glyphWrap}
        data-state={state}
        animate={state ?? 'idle'}
        variants={{
          idle: { x: 0 },
          correct: { scale: [1, 1.035, 1] },
          wrong: { x: [0, -10, 9, -6, 4, 0] },
        }}
        transition={{ duration: 0.42, ease: 'easeInOut' }}
      >
        <span
          className={`${styles.glyph} ${glyphLength > 1 ? styles.glyphDouble : styles.glyphSingle} kana-glyph`}
        >
          {question.kana.kana}
        </span>
      </motion.div>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (feedback || !value.trim()) return;
          onAnswer(value.trim(), isCorrectRomaji(question.kana, value));
        }}
      >
        <input
          ref={inputRef}
          className={styles.input}
          data-state={state}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={Boolean(feedback)}
          placeholder="type the rōmaji"
          aria-label="Rōmaji reading"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
        />
        {feedback ? (
          <button type="button" className="btn btn--primary" onClick={onNext} autoFocus>
            Next
            <ArrowRightIcon size={16} />
          </button>
        ) : (
          <button type="submit" className="btn btn--primary" disabled={!value.trim()}>
            Check
          </button>
        )}
      </form>
    </>
  );
}

// ── Multiple-choice question ────────────────────────────────────────────────

function ChooseCard({ question, feedback, onAnswer }: CardProps) {
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (choice: Kana) => {
    if (feedback) return;
    setPicked(choice.kana);
    onAnswer(choice.kana, choice.romaji === question.kana.romaji);
  };

  const stateFor = (choice: Kana): string | undefined => {
    if (!feedback) return undefined;
    if (choice.kana === question.kana.kana) return 'correct';
    if (choice.kana === picked) return 'wrong';
    return 'dim';
  };

  return (
    <>
      <motion.div
        className={styles.glyphWrap}
        data-state={feedback ? (feedback.correct ? 'correct' : 'wrong') : undefined}
        animate={feedback ? (feedback.correct ? 'correct' : 'wrong') : 'idle'}
        variants={{
          idle: { x: 0 },
          correct: { scale: [1, 1.035, 1] },
          wrong: { x: [0, -10, 9, -6, 4, 0] },
        }}
        transition={{ duration: 0.42, ease: 'easeInOut' }}
      >
        <div>
          <span className={styles.promptRomaji}>{question.kana.romaji}</span>
          <span className={styles.promptHint}>Which character is this?</span>
        </div>
      </motion.div>

      <div className={styles.choices}>
        {question.choices.map((choice, index) => {
          const choiceState = stateFor(choice);
          return (
            <motion.button
              key={choice.kana}
              className={`${styles.choice} kana-glyph`}
              data-state={choiceState}
              disabled={Boolean(feedback)}
              onClick={() => choose(choice)}
              aria-label={`Option ${index + 1}`}
              whileHover={feedback ? undefined : { y: -3 }}
              whileTap={feedback ? undefined : { scale: 0.95 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: choiceState === 'dim' ? 0.4 : 1, y: 0 }}
              transition={{ duration: 0.24, delay: 0.03 * index, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.choiceKey} aria-hidden="true">
                {index + 1}
              </span>
              {choice.kana}
              {choiceState === 'correct' && (
                <motion.span
                  className={styles.choiceMark}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                >
                  <CheckIcon size={15} />
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </div>
    </>
  );
}

// ── Feedback ────────────────────────────────────────────────────────────────

function FeedbackPanel({ question, feedback }: { question: Question; feedback: Feedback }) {
  const { kana } = question;
  const alternates = teachableAlternates(kana);

  const detail = feedback.correct
    ? alternates.length
      ? `also written ${alternates.join(', ')}`
      : kana.example.word + ' — ' + kana.example.meaning
    : question.mode === 'type'
      ? `You typed “${feedback.given}”`
      : `You picked ${feedback.given}`;

  return (
    <motion.div
      className={styles.feedback}
      data-tone={feedback.correct ? 'correct' : 'wrong'}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className={styles.feedbackIcon}>
        {feedback.correct ? <CheckIcon size={15} /> : <CrossIcon size={15} />}
      </span>
      <span className={styles.feedbackText}>
        <span className={styles.feedbackTitle}>
          <span className={styles.feedbackGlyph}>{kana.kana}</span>
          {' — '}
          <span className={styles.feedbackAnswer}>{kana.romaji}</span>
        </span>
        <span className={styles.feedbackDetail}>
          {detail}
          {feedback.requeued && ' · comes back at the end'}
        </span>
      </span>
    </motion.div>
  );
}
