import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, RefObject } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import type { Kana } from '../data/hiragana';
import type { Word } from '../data/words';
import { MNEMONICS } from '../data/mnemonics';
import { NO_BEARINGS, inkBearings } from '../lib/ink';
import { isCorrectWordReading } from '../lib/kanaText';
import { isCorrectRomaji, teachableAlternates } from '../lib/romaji';
import { scheduleRetry, subjectOf, summarize } from '../lib/quiz';
import type { Answer, Question, Quiz, QuizSummary, Verdict } from '../lib/quiz';
import { percent } from '../lib/util';
import ConfirmDialog from './ConfirmDialog';
import { MnemonicLine } from './Mnemonic';
import { ArrowRightIcon, CheckIcon, ClockIcon, CrossIcon, FlameIcon, RefreshIcon } from './icons';

import styles from './QuizRunner.module.css';

interface QuizRunnerProps {
  quiz: Quiz;
  onFinish: (summary: QuizSummary) => void;
  onExit: () => void;
}

interface Feedback {
  verdict: Verdict;
  given: string;
  /** The subject was missed and will come back once more this round. */
  requeued: boolean;
}

interface State {
  queue: Question[];
  answers: Answer[];
  /** Subjects that have left the queue for good — drives the progress bar. */
  resolved: number;
  feedback: Feedback | null;
  /** False in a speed run, where the round is over before a second look. */
  retries: boolean;
  startedAt: number;
  questionStartedAt: number;
  endedAt: number | null;
}

type Action =
  | { type: 'answer'; given: string; verdict: Verdict; at: number }
  | { type: 'advance'; quiz: Quiz; at: number }
  | { type: 'end'; at: number };

/** Drives both the prompt sliding aside and the answer sliding out behind it. */
const REVEAL_SPRING = { type: 'spring', stiffness: 360, damping: 32 } as const;

/**
 * Reports how far the browser has slid the visible part of the page away from
 * the top of the layout, which it does to bring a focused field towards the
 * middle of the screen whether or not the field needed moving. The round puts
 * it straight back (QuizRunner.module.css, .runner); this only has to keep the
 * figure current.
 */
function useVisualViewportOffset() {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let current = -1;

    // Read and applied as-is, with nothing smoothing or delaying it. This is
    // not an animation of ours but a correction to someone else's, and it is
    // only a correction for as long as it is up to date.
    const track = () => {
      const offset = Math.round(viewport.offsetTop);
      if (offset === current) return;
      current = offset;
      root.style.setProperty('--viewport-offset', `${offset}px`);
    };

    track();
    viewport.addEventListener('resize', track);
    viewport.addEventListener('scroll', track);

    return () => {
      viewport.removeEventListener('resize', track);
      viewport.removeEventListener('scroll', track);
      root.style.removeProperty('--viewport-offset');
    };
  }, []);
}

function init(quiz: Quiz): State {
  const now = Date.now();
  return {
    queue: quiz.queue,
    answers: [],
    resolved: 0,
    feedback: null,
    retries: !quiz.sprintMs,
    startedAt: now,
    questionStartedAt: now,
    endedAt: null,
  };
}

function reducer(state: State, action: Action): State {
  if (action.type === 'end') {
    return state.endedAt ? state : { ...state, queue: [], feedback: null, endedAt: action.at };
  }

  const current = state.queue[0];
  if (!current) return state;

  switch (action.type) {
    case 'answer': {
      if (state.feedback) return state;
      const requeued = state.retries && action.verdict !== 'correct' && !current.isRetry;
      const answer: Answer = {
        subject: subjectOf(current),
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

/** Milliseconds left on a speed run's clock, ticking often enough to look live. */
function useCountdown(startedAt: number, sprintMs: number | undefined, stopped: boolean): number {
  const [remaining, setRemaining] = useState(sprintMs ?? 0);

  useEffect(() => {
    if (!sprintMs || stopped) return;
    const tick = () => setRemaining(Math.max(0, sprintMs - (Date.now() - startedAt)));
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [startedAt, sprintMs, stopped]);

  return remaining;
}

export default function QuizRunner({ quiz, onFinish, onExit }: QuizRunnerProps) {
  const [state, dispatch] = useReducer(reducer, quiz, init);
  const [confirmExit, setConfirmExit] = useState(false);
  const finishedRef = useRef(false);

  useVisualViewportOffset();

  const current = state.queue[0];
  const { feedback } = state;

  const advance = useCallback(() => {
    dispatch({ type: 'advance', quiz, at: Date.now() });
  }, [quiz]);

  const answer = useCallback((given: string, verdict: Verdict) => {
    dispatch({ type: 'answer', given, verdict, at: Date.now() });
  }, []);

  const skip = useCallback(() => answer('', 'skipped'), [answer]);

  const remaining = useCountdown(state.startedAt, quiz.sprintMs, state.endedAt !== null);

  // The clock, not the queue, ends a speed run.
  useEffect(() => {
    if (!quiz.sprintMs || state.endedAt || remaining > 0) return;
    dispatch({ type: 'end', at: Date.now() });
  }, [quiz.sprintMs, remaining, state.endedAt]);

  // Hand the finished round up exactly once.
  useEffect(() => {
    if (!state.endedAt || finishedRef.current) return;
    finishedRef.current = true;
    onFinish(summarize(state.answers, state.endedAt - state.startedAt));
  }, [state.endedAt, state.answers, state.startedAt, onFinish]);

  // A correct answer moves on by itself; anything else waits so the reveal can
  // be read. A sprint hurries both along — there is a clock running.
  useEffect(() => {
    if (!feedback) return;
    if (feedback.verdict !== 'correct' && !quiz.sprintMs) return;
    const timer = setTimeout(advance, quiz.sprintMs ? 450 : 900);
    return () => clearTimeout(timer);
  }, [feedback, advance, quiz.sprintMs]);

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
        if (current.kind === 'word') {
          const choice = current.choices[index];
          if (choice) {
            event.preventDefault();
            answer(choice.meaning, choice.word === current.word.word ? 'correct' : 'wrong');
          }
          return;
        }
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

  const sprint = Boolean(quiz.sprintMs);
  const progress = sprint
    ? percent(remaining, quiz.sprintMs ?? 1)
    : percent(state.resolved, quiz.totalUnique);

  return (
    <div className={styles.runner}>
      <div className={styles.bar}>
        <button className={styles.exit} onClick={() => setConfirmExit(true)} aria-label="End round">
          <CrossIcon size={17} />
        </button>

        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuenow={sprint ? Math.ceil(remaining / 1000) : state.resolved}
          aria-valuemin={0}
          aria-valuemax={sprint ? Math.round((quiz.sprintMs ?? 0) / 1000) : quiz.totalUnique}
          aria-label={sprint ? 'Seconds left' : 'Round progress'}
        >
          <motion.div
            className={styles.progressFill}
            data-urgent={sprint && remaining <= 10_000}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={sprint ? { duration: 0.12 } : { type: 'spring', stiffness: 220, damping: 32 }}
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
          {sprint ? (
            <span className={styles.clock} data-urgent={remaining <= 10_000}>
              <ClockIcon size={13} />
              {Math.ceil(remaining / 1000)}s
            </span>
          ) : (
            <span>
              {state.resolved}
              <span className="muted">/{quiz.totalUnique}</span>
            </span>
          )}
        </div>
      </div>

      <div className={styles.stage}>
        <div className={styles.stageInner}>
          <div className={styles.card}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.key}
                className={styles.slide}
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

                {current.mode === 'choose' &&
                  (current.kind === 'word' ? (
                    <MeaningGrid question={current} feedback={feedback} onAnswer={answer} />
                  ) : (
                    <ChoiceGrid question={current} feedback={feedback} onAnswer={answer} />
                  ))}
              </motion.div>
            </AnimatePresence>

            {/* Deliberately outside the block that swaps per question: a
                remounted input is a closed keyboard on a phone, and one that
                cannot be reopened without a tap, since only a real gesture may
                summon it. Keeping this one element alive for the whole round
                is what lets you answer straight through. */}
            {current.mode === 'type' && (
              <TypeAnswer
                question={current}
                feedback={feedback}
                onAnswer={answer}
                onSkip={skip}
                onNext={advance}
              />
            )}
          </div>

          {/* Typed questions carry their own skip on the input row, so this is
              only ever needed for multiple choice. */}
          {current.mode === 'choose' && (
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
                ) : feedback.verdict !== 'correct' && !sprint ? (
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
          )}

          <p className={styles.hint}>
            {current.mode === 'choose'
              ? `Press 1–${current.choices.length} to answer · Enter to continue`
              : 'Enter to check · Enter again to continue'}
          </p>
        </div>
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
      const next = { prompt: inkBearings(prompt), answer: inkBearings(answer) };
      // Only when the numbers have really moved. iOS treats a keyboard opening
      // as a window resize, and re-rendering on one of those — with the prompt
      // under a layout animation, and the stage scrolling beneath it — sets the
      // glyph springing about for a measurement that came back unchanged.
      setMargins((current) =>
        current.prompt.left === next.prompt.left &&
        current.prompt.right === next.prompt.right &&
        current.answer.left === next.answer.left &&
        current.answer.right === next.answer.right
          ? current
          : next,
      );
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

/**
 * What the card shows on each side of the reveal.
 *
 * A character asked by typing shows the glyph and reveals the reading; asked by
 * choosing it shows the reading and reveals the glyph. A word always shows the
 * word — but when the question is a meaning, there is nothing to slide out
 * beside it: an English phrase gliding out from behind a Japanese word reads as
 * a mistake rather than as an answer, so that card keeps still and puts the
 * answer in its caption instead.
 */
function faces(question: Question) {
  if (question.kind === 'word') {
    const wide = [...question.word.word].length > 4;
    return {
      prompt: question.word.word,
      promptClass: `${styles.promptWord} ${wide ? styles.promptWordLong : ''} kana-glyph`,
      answer: question.word.romaji,
      answerClass: styles.answerWord,
      reveals: question.mode === 'type',
      ask: question.mode === 'choose' ? 'What does this word mean?' : 'Read the whole word.',
    };
  }

  const { kana } = question;
  const wide = [...kana.kana].length > 1;
  if (question.mode === 'type') {
    return {
      prompt: kana.kana,
      promptClass: `${styles.promptKana} ${wide ? styles.promptKanaWide : ''} kana-glyph`,
      answer: kana.romaji,
      answerClass: styles.answerRomaji,
      reveals: true,
      ask: '',
    };
  }
  return {
    prompt: kana.romaji,
    promptClass: styles.promptRomaji,
    answer: kana.kana,
    answerClass: `${styles.answerKana} ${wide ? styles.answerKanaWide : ''} kana-glyph`,
    reveals: true,
    ask: 'Which character is this?',
  };
}

function QuestionCard({ question, feedback }: { question: Question; feedback: Feedback | null }) {
  const face = faces(question);
  const revealed = Boolean(feedback) && face.reveals;

  const promptRef = useRef<HTMLSpanElement>(null);
  const answerRef = useRef<HTMLSpanElement>(null);
  const margins = useInkMargins(promptRef, answerRef, question.key);

  return (
    <div className={styles.glyphWrap} data-verdict={feedback?.verdict}>
      <div className={styles.revealRow}>
        <motion.span
          ref={promptRef}
          layout
          className={`${styles.prompt} ${face.promptClass}`}
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
          {face.prompt}
        </motion.span>

        {/* Always mounted so it can be measured, and so that revealing it is a
            plain transform rather than a mount — it is simply parked out of
            flow, invisible, behind the prompt until then. */}
        <motion.span
          ref={answerRef}
          className={`${styles.answer} ${face.answerClass}`}
          data-verdict={feedback?.verdict}
          data-idle={!revealed}
          aria-hidden={!revealed}
          style={{ marginLeft: -margins.answer.left, marginRight: -margins.answer.right }}
          initial={false}
          animate={revealed ? { x: '0%', opacity: 1 } : { x: '-115%', opacity: 0 }}
          transition={REVEAL_SPRING}
        >
          {face.answer}
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
            {feedback ? (
              <VerdictCaption question={question} feedback={feedback} />
            ) : (
              face.ask
            )}
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
  const detail: string[] = [];

  if (question.kind === 'word') {
    // The reading slides out beside a typed word, so the caption only has to
    // add the meaning. On a meaning question nothing slides out at all, and the
    // caption carries both halves of the answer.
    detail.push(
      question.mode === 'choose'
        ? `${question.word.romaji} — ${question.word.meaning}`
        : question.word.meaning,
    );
    if (feedback.verdict === 'wrong') {
      detail.push(
        question.mode === 'choose'
          ? `you picked “${feedback.given}”`
          : `you typed “${feedback.given}”`,
      );
    }
  } else {
    const alternates = teachableAlternates(question.kana);
    if (feedback.verdict === 'wrong') {
      detail.push(
        question.mode === 'type' ? `you typed “${feedback.given}”` : `you picked ${feedback.given}`,
      );
    }
    if (feedback.verdict === 'correct' && alternates.length) {
      detail.push(`also written ${alternates.join(', ')}`);
    }
  }

  if (feedback.requeued) detail.push('comes back at the end');

  // The hook, offered exactly when it is wanted: after the shape failed to come
  // back on its own.
  const mnemonic =
    question.kind === 'kana' && feedback.verdict !== 'correct'
      ? MNEMONICS[question.kana.kana]
      : undefined;

  return (
    <>
      <span className={styles.verdictWord} data-verdict={feedback.verdict}>
        {VERDICT_WORD[feedback.verdict]}
      </span>
      {detail.length > 0 && ` · ${detail.join(' · ')}`}
      {mnemonic && (
        <>
          <br />
          <MnemonicLine hint={mnemonic.hint} className={styles.captionHint} />
        </>
      )}
    </>
  );
}

// ── Typing input ────────────────────────────────────────────────────────────

interface AnswerProps {
  question: Question;
  feedback: Feedback | null;
  onAnswer: (given: string, verdict: Verdict) => void;
}

type RowAction = 'pass' | 'check' | 'next';

const ACTION_LABEL: Record<RowAction, string> = {
  pass: 'I don’t know',
  check: 'Check',
  next: 'Next',
};

/**
 * The width the action button wants for the label it is currently showing,
 * measured off an invisible copy of it. Animating the button's real width
 * rather than a transform is what lets the input — its flex sibling — give
 * ground and take it back in step with the button.
 */
function useNaturalWidth(ref: RefObject<HTMLElement | null>, key: string) {
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current;
      if (el) setWidth(el.getBoundingClientRect().width);
    };

    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [ref, key]);

  return width;
}

function isCorrectAnswer(question: Question, value: string): boolean {
  return question.kind === 'word'
    ? isCorrectWordReading(question.word, value)
    : isCorrectRomaji(question.kana, value);
}

function TypeAnswer({
  question,
  feedback,
  onAnswer,
  onSkip,
  onNext,
}: AnswerProps & { onSkip: () => void; onNext: () => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const sizerRef = useRef<HTMLSpanElement>(null);

  // The field outlives the question it was answering, so clearing it between
  // questions is on us. Done during render rather than from an effect so that
  // the next character is never painted holding the last one's answer.
  const askedRef = useRef(question.key);
  if (askedRef.current !== question.key) {
    askedRef.current = question.key;
    setValue('');
  }

  const typed = value.trim().length > 0;
  const locked = Boolean(feedback);
  // One button, doing whatever the field asks of it: pass on the character
  // while the field is empty, check what is in it once something is typed,
  // and move the round on once the answer has been shown.
  const action: RowAction = feedback ? 'next' : typed ? 'check' : 'pass';
  const width = useNaturalWidth(sizerRef, action);

  // Only ever on mount: a phone will not reopen its keyboard for a focus()
  // that no tap asked for, and on desktop the field never loses focus in the
  // first place, so refocusing per question would buy nothing anywhere.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /** Keeps the keyboard up when a tap lands on the button beside the field. */
  const keepFocus = () => inputRef.current?.focus();

  const label = (
    <>
      {ACTION_LABEL[action]}
      {action === 'next' && <ArrowRightIcon size={16} />}
    </>
  );

  const buttonClass = `btn ${styles.action} ${action === 'pass' ? styles.skip : 'btn--primary'}`;

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        // Some keyboards drop away on submit; asking for the focus back inside
        // the same gesture is what keeps this one up.
        keepFocus();
        if (feedback || !typed) return;
        onAnswer(value.trim(), isCorrectAnswer(question, value) ? 'correct' : 'wrong');
      }}
    >
      <input
        ref={inputRef}
        className={styles.input}
        data-verdict={feedback?.verdict}
        value={value}
        onChange={(event) => {
          // Locked while the answer is on show — but by refusing the edit
          // rather than by `disabled` or `readOnly`, either of which takes a
          // phone keyboard away the moment an answer is checked.
          if (locked) {
            event.target.value = value;
            return;
          }
          setValue(event.target.value);
        }}
        aria-readonly={locked}
        placeholder="type the rōmaji"
        aria-label="Rōmaji reading"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="go"
      />

      <motion.button
        type={action === 'check' ? 'submit' : 'button'}
        className={buttonClass}
        onClick={() => {
          keepFocus();
          if (action === 'pass') onSkip();
          else if (action === 'next') onNext();
        }}
        initial={false}
        animate={width === null ? undefined : { width }}
        transition={{ type: 'spring', stiffness: 420, damping: 38 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={action}
            className={styles.actionLabel}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.11 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* Out of flow and out of the accessibility tree: it exists only so the
          button's natural width can be read before animating to it. */}
      <span ref={sizerRef} className={`${buttonClass} ${styles.sizer}`} aria-hidden="true">
        <span className={styles.actionLabel}>{label}</span>
      </span>
    </form>
  );
}

// ── Multiple choice ─────────────────────────────────────────────────────────

function ChoiceGrid({ question, feedback, onAnswer }: AnswerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  if (question.kind !== 'kana') return null;

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

/** The same idea as ChoiceGrid, but the options are meanings and so are text. */
function MeaningGrid({ question, feedback, onAnswer }: AnswerProps) {
  const [picked, setPicked] = useState<string | null>(null);
  if (question.kind !== 'word') return null;

  const choose = (choice: Word) => {
    if (feedback) return;
    setPicked(choice.word);
    onAnswer(choice.meaning, choice.word === question.word.word ? 'correct' : 'wrong');
  };

  const stateFor = (choice: Word): string | undefined => {
    if (!feedback) return undefined;
    if (choice.word === question.word.word) return 'correct';
    if (choice.word === picked) return 'wrong';
    return 'dim';
  };

  return (
    <div className={styles.meanings}>
      {question.choices.map((choice, index) => {
        const choiceState = stateFor(choice);
        return (
          <motion.button
            key={choice.word}
            className={styles.meaning}
            data-state={choiceState}
            disabled={Boolean(feedback)}
            onClick={() => choose(choice)}
            whileHover={feedback ? undefined : { y: -2 }}
            whileTap={feedback ? undefined : { scale: 0.98 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: choiceState === 'dim' ? 0.4 : 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.03 * index, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.meaningKey} aria-hidden="true">
              {index + 1}
            </span>
            <span className={styles.meaningText}>{choice.meaning}</span>
            {choiceState === 'correct' && (
              <motion.span
                className={styles.meaningMark}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 520, damping: 26 }}
              >
                <CheckIcon size={14} />
              </motion.span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
