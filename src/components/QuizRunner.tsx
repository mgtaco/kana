import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import type { Kana } from '../data/hiragana';
import { NO_BEARINGS, inkBearings } from '../lib/ink';
import { isCorrectRomaji, teachableAlternates } from '../lib/romaji';
import { scheduleRetry, summarize } from '../lib/quiz';
import type { Answer, Question, Quiz, QuizSummary, Verdict } from '../lib/quiz';
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
  verdict: Verdict;
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
  | { type: 'answer'; given: string; verdict: Verdict; at: number }
  | { type: 'advance'; quiz: Quiz; at: number };

/** Drives both the prompt sliding aside and the answer sliding out behind it. */
const REVEAL_SPRING = { type: 'spring', stiffness: 360, damping: 32 } as const;

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
      const requeued = action.verdict !== 'correct' && !current.isRetry;
      const answer: Answer = {
        kana: current.kana,
        mode: current.mode,
        isRetry: current.isRetry,
        verdict: action.verdict,
        given: action.given,
        elapsedMs: action.at - state.questionStartedAt,
      };
      return {
        ...state,
        answers: [...state.answers, answer],
        resolved: state.resolved + (requeued ? 0 : 1),
        feedback: { verdict: action.verdict, given: action.given, requeued },
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

  const answer = useCallback((given: string, verdict: Verdict) => {
    dispatch({ type: 'answer', given, verdict, at: Date.now() });
  }, []);

  const skip = useCallback(() => answer('', 'skipped'), [answer]);

  // Hand the finished round up exactly once.
  useEffect(() => {
    if (!state.endedAt || finishedRef.current) return;
    finishedRef.current = true;
    onFinish(summarize(state.answers, state.endedAt - state.startedAt));
  }, [state.endedAt, state.answers, state.startedAt, onFinish]);

  // A correct answer moves on by itself; anything else waits so the reveal can
  // be read.
  useEffect(() => {
    if (feedback?.verdict !== 'correct') return;
    const timer = setTimeout(advance, 900);
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
          answer(choice.kana, choice.romaji === current.kana.romaji ? 'correct' : 'wrong');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmExit, feedback, current, advance, answer]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = state.answers.length - 1; i >= 0; i--) {
      if (state.answers[i].verdict !== 'correct') break;
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

            <QuestionCard question={current} feedback={feedback} />

            {current.mode === 'type' ? (
              <TypeAnswer question={current} feedback={feedback} onAnswer={answer} onNext={advance} />
            ) : (
              <ChoiceGrid question={current} feedback={feedback} onAnswer={answer} />
            )}
          </motion.div>
        </AnimatePresence>

        <div className={styles.actions}>
          <AnimatePresence mode="wait" initial={false}>
            {!feedback ? (
              <motion.button
                key="skip"
                className={`btn ${styles.skip}`}
                onClick={skip}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                I don&rsquo;t know
              </motion.button>
            ) : current.mode === 'choose' && feedback.verdict !== 'correct' ? (
              <motion.button
                key="continue"
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
            ) : null}
          </AnimatePresence>
        </div>

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

// ── The card: prompt, and the answer revealed beside it ─────────────────────

/**
 * Holds the question and, once answered, the answer itself. The prompt slides
 * aside to make room and the answer slides out from behind it — the prompt is
 * painted on an opaque background so the answer really is hidden underneath
 * until it moves.
 */
/**
 * Trims each element's layout box back to its ink, so that centring the pair
 * puts equal space either side of what you can actually see. Re-measured when
 * the question changes, when the viewport resizes (the type scale is in vw)
 * and once web fonts have loaded.
 */
function useInkMargins(
  promptRef: RefObject<HTMLElement | null>,
  answerRef: RefObject<HTMLElement | null>,
  questionKey: string,
) {
  const [margins, setMargins] = useState({ prompt: NO_BEARINGS, answer: NO_BEARINGS });

  useLayoutEffect(() => {
    const measure = () => {
      const prompt = promptRef.current;
      const answer = answerRef.current;
      if (!prompt || !answer) return;
      setMargins({ prompt: inkBearings(prompt), answer: inkBearings(answer) });
    };

    measure();
    // Again after paint, in case metrics were not final on the first pass.
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
    };
  }, [promptRef, answerRef, questionKey]);

  return margins;
}

function QuestionCard({ question, feedback }: { question: Question; feedback: Feedback | null }) {
  const isType = question.mode === 'type';
  const { kana } = question;
  const wide = [...kana.kana].length > 1;

  const promptRef = useRef<HTMLSpanElement>(null);
  const answerRef = useRef<HTMLSpanElement>(null);
  const margins = useInkMargins(promptRef, answerRef, question.key);

  const promptClass = isType
    ? `${styles.promptKana} ${wide ? styles.promptKanaWide : ''} kana-glyph`
    : styles.promptRomaji;
  const answerClass = isType
    ? styles.answerRomaji
    : `${styles.answerKana} ${wide ? styles.answerKanaWide : ''} kana-glyph`;

  return (
    <div className={styles.glyphWrap} data-verdict={feedback?.verdict}>
      <div className={styles.revealRow}>
        <motion.span
          ref={promptRef}
          layout
          className={`${styles.prompt} ${promptClass}`}
          style={
            {
              marginLeft: -margins.prompt.left,
              marginRight: -margins.prompt.right,
              '--ink-left': `${margins.prompt.left}px`,
              '--ink-right': `${margins.prompt.right}px`,
            } as CSSProperties
          }
          transition={REVEAL_SPRING}
        >
          {isType ? kana.kana : kana.romaji}
        </motion.span>

        {/* Always mounted so it can be measured, and so that revealing it is a
            plain transform rather than a mount — it is simply parked out of
            flow, invisible, behind the prompt until then. */}
        <motion.span
          ref={answerRef}
          className={`${styles.answer} ${answerClass}`}
          data-verdict={feedback?.verdict}
          data-idle={!feedback}
          aria-hidden={!feedback}
          style={{ marginLeft: -margins.answer.left, marginRight: -margins.answer.right }}
          initial={false}
          animate={feedback ? { x: '0%', opacity: 1 } : { x: '-115%', opacity: 0 }}
          transition={REVEAL_SPRING}
        >
          {isType ? kana.romaji : kana.kana}
        </motion.span>
      </div>

      <div className={styles.caption} aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={feedback ? 'verdict' : 'ask'}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            {feedback ? <VerdictCaption question={question} feedback={feedback} /> : !isType && 'Which character is this?'}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

const VERDICT_WORD: Record<Verdict, string> = {
  correct: 'Correct',
  wrong: 'Not quite',
  skipped: 'Skipped',
};

function VerdictCaption({ question, feedback }: { question: Question; feedback: Feedback }) {
  const alternates = teachableAlternates(question.kana);

  const detail: string[] = [];
  if (feedback.verdict === 'wrong') {
    detail.push(
      question.mode === 'type' ? `you typed “${feedback.given}”` : `you picked ${feedback.given}`,
    );
  }
  if (feedback.verdict === 'correct' && alternates.length) {
    detail.push(`also written ${alternates.join(', ')}`);
  }
  if (feedback.requeued) detail.push('comes back at the end');

  return (
    <>
      <span className={styles.verdictWord} data-verdict={feedback.verdict}>
        {VERDICT_WORD[feedback.verdict]}
      </span>
      {detail.length > 0 && ` · ${detail.join(' · ')}`}
    </>
  );
}

// ── Typing input ────────────────────────────────────────────────────────────

interface AnswerProps {
  question: Question;
  feedback: Feedback | null;
  onAnswer: (given: string, verdict: Verdict) => void;
}

function TypeAnswer({
  question,
  feedback,
  onAnswer,
  onNext,
}: AnswerProps & { onNext: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (feedback || !value.trim()) return;
        onAnswer(value.trim(), isCorrectRomaji(question.kana, value) ? 'correct' : 'wrong');
      }}
    >
      <input
        ref={inputRef}
        className={styles.input}
        data-verdict={feedback?.verdict}
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
  );
}

// ── Multiple choice ─────────────────────────────────────────────────────────

function ChoiceGrid({ question, feedback, onAnswer }: AnswerProps) {
  const [picked, setPicked] = useState<string | null>(null);

  const choose = (choice: Kana) => {
    if (feedback) return;
    setPicked(choice.kana);
    onAnswer(choice.kana, choice.romaji === question.kana.romaji ? 'correct' : 'wrong');
  };

  const stateFor = (choice: Kana): string | undefined => {
    if (!feedback) return undefined;
    // Green always means "this is the character", whatever the verdict was.
    if (choice.kana === question.kana.kana) return 'correct';
    if (choice.kana === picked) return 'wrong';
    return 'dim';
  };

  return (
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
  );
}
