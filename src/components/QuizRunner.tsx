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

/**
 * Roughly what share of a phone screen a keyboard covers, for the one focus
 * that happens before any keyboard has been measured. Only ever a placeholder:
 * the real figure replaces it as soon as the keyboard announces itself, and is
 * then remembered for the rest of the session.
 */
const KEYBOARD_SHARE = 0.42;
let knownKeyboardInset = 0;

/**
 * Keeps the round clear of a phone keyboard, and the progress bar on screen.
 *
 * Left alone, iOS lifts a focused field clear of the keyboard by moving the
 * page — and the progress bar goes with it, because `position: sticky` sticks
 * to a layout viewport that is itself being moved. Every attempt to hold the
 * page still or to put it back was worse: what Safari does when the round is
 * not where it wants it is to heave the whole screen down, fill the gap above
 * with the theme colour, and slide it back over the next fifth of a second.
 *
 * So the round no longer resists, and gives Safari nothing to correct. It is
 * pinned to the viewport at a size that never changes (index.css), and the
 * keyboard's room comes out of the stage instead. The important part is *when*:
 * a keyboard is only announced once it is already on its way, by which time
 * Safari has decided the field is behind it. Reserving the room the moment the
 * field takes the focus — before any of that — means the field is never in the
 * way to begin with, and Safari leaves the page alone.
 */
function useKeyboardInset(stageRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    let current = -1;
    let settle: ReturnType<typeof setTimeout> | undefined;
    let verify: ReturnType<typeof setTimeout> | undefined;

    /**
     * Brings the answer row out from behind the keyboard, in the rare case
     * that the round is taller than the room left for it. Left until the
     * reservation has finished settling: measured any earlier it would read a
     * figure the transition is still moving through, and scrolling to one that
     * is already out of date is how the round ends up shifting twice.
     */
    const revealAnswerRow = () => {
      const stage = stageRef.current;
      if (!stage || !stage.contains(document.activeElement)) return;
      const overflow = stage.scrollHeight - stage.clientHeight;
      if (overflow > stage.scrollTop) stage.scrollTo({ top: overflow, behavior: 'smooth' });
    };

    const reserve = (px: number) => {
      const next = Math.max(0, Math.round(px));
      // Writing the same value back would still cost a style recalculation,
      // and these events arrive in bursts.
      if (next === current) return;
      current = next;
      root.style.setProperty('--keyboard-inset', `${next}px`);
      clearTimeout(settle);
      settle = setTimeout(revealAnswerRow, 320);
    };

    /** What the keyboard is actually covering, once there is one to measure. */
    const measure = () => {
      clearTimeout(verify);
      const inset = viewport ? window.innerHeight - viewport.height : 0;
      if (inset > 40) knownKeyboardInset = Math.round(inset);
      reserve(inset);
    };

    // Touch only: a mouse means a hardware keyboard and nothing to reserve.
    const expectKeyboard = () => {
      if (!window.matchMedia('(pointer: coarse)').matches) return;
      reserve(knownKeyboardInset || window.innerHeight * KEYBOARD_SHARE);
      // Nothing has promised a keyboard yet. If none turns up, put the room
      // back rather than leave the round sitting high for good.
      clearTimeout(verify);
      verify = setTimeout(measure, 700);
    };

    const onInputEvent = (event: Event) => {
      if (event.target instanceof HTMLInputElement) expectKeyboard();
    };

    root.dataset.viewportLock = 'on';
    measure();

    // Both, because neither is enough on its own: the field keeps the focus
    // from one character to the next, so the tap that summons the keyboard
    // back is often not a change of focus at all.
    document.addEventListener('focusin', onInputEvent);
    document.addEventListener('touchstart', onInputEvent, { passive: true });
    viewport?.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      clearTimeout(settle);
      clearTimeout(verify);
      document.removeEventListener('focusin', onInputEvent);
      document.removeEventListener('touchstart', onInputEvent);
      viewport?.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      delete root.dataset.viewportLock;
      root.style.removeProperty('--keyboard-inset');
    };
  }, [stageRef]);
}

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
  const stageRef = useRef<HTMLDivElement>(null);

  useKeyboardInset(stageRef);

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

      <div className={styles.stage} ref={stageRef}>
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

                {current.mode === 'choose' && (
                  <ChoiceGrid question={current} feedback={feedback} onAnswer={answer} />
                )}
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
                ) : feedback.verdict !== 'correct' ? (
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
              ? 'Press 1–6 to answer · Enter to continue'
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
        onAnswer(value.trim(), isCorrectRomaji(question.kana, value) ? 'correct' : 'wrong');
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
