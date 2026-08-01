import type { Kana, KanaGroup } from '../data/hiragana';
import { kanaForGroups } from '../data/hiragana';
import { clamp, shuffle, uid } from './util';

export type QuizMode = 'type' | 'choose' | 'mixed';
export type QuestionMode = 'type' | 'choose';

export interface QuizConfig {
  groups: KanaGroup[];
  mode: QuizMode;
  /** Number of distinct characters to ask, or every character in the selection. */
  length: number | 'all';
}

export interface Question {
  /** Unique per appearance, so a retry animates in as a fresh card. */
  key: string;
  kana: Kana;
  mode: QuestionMode;
  /** Populated for `choose` questions; the correct kana is among them. */
  choices: Kana[];
  /** True when this is the second look at a character the learner got wrong. */
  isRetry: boolean;
}

/** `skipped` is a miss the learner owned up to rather than guessed at. */
export type Verdict = 'correct' | 'wrong' | 'skipped';

export interface Answer {
  kana: Kana;
  mode: QuestionMode;
  isRetry: boolean;
  verdict: Verdict;
  /** What the learner typed or picked; empty when they skipped. */
  given: string;
  elapsedMs: number;
}

export const CHOICE_COUNT = 6;

/**
 * Characters that trip learners up because they look alike. Distractors are
 * drawn from these sets first, which makes the multiple-choice quiz test
 * recognition rather than elimination.
 */
const CONFUSABLE_SETS: string[][] = [
  ['あ', 'お', 'め', 'ぬ'],
  ['ぬ', 'め', 'ね', 'れ', 'わ', 'を'],
  ['さ', 'ち', 'き', 'ら'],
  ['は', 'ほ', 'ま', 'け'],
  ['る', 'ろ', 'ふ'],
  ['つ', 'し', 'そ', 'く'],
  ['い', 'り', 'こ'],
  ['な', 'た', 'に'],
  ['す', 'む', 'ず'],
  ['よ', 'ま', 'も'],
  ['せ', 'さ', 'ち'],
  ['ん', 'そ', 'へ'],
  ['ゆ', 'わ', 'ふ'],
];

const DAKUTEN = new Set('がぎぐげござじずぜぞだぢづでどばびぶべぼ');
const HANDAKUTEN = new Set('ぱぴぷぺぽ');

/** Strips voicing marks and the small ya/yu/yo so がゃ-style kana map to か. */
function baseChar(kana: string): string {
  const head = [...kana][0];
  const code = head.codePointAt(0);
  if (code === undefined) return head;
  if (HANDAKUTEN.has(head)) return String.fromCodePoint(code - 2);
  if (DAKUTEN.has(head)) return String.fromCodePoint(code - 1);
  return head;
}

function looksAlike(a: string, b: string): boolean {
  const baseA = baseChar(a);
  const baseB = baseChar(b);
  if (baseA === baseB) return true;
  return CONFUSABLE_SETS.some((set) => set.includes(baseA) && set.includes(baseB));
}

/**
 * Builds the option list for a `choose` question. Anything sharing the prompt's
 * romaji is excluded so that homophone pairs like じ/ぢ never appear together —
 * otherwise the question would have two right answers.
 */
export function buildChoices(answer: Kana, pool: Kana[], count = CHOICE_COUNT): Kana[] {
  const candidates = pool.filter(
    (entry) => entry.kana !== answer.kana && entry.romaji !== answer.romaji,
  );

  const picked: Kana[] = [];
  const take = (from: Kana[], limit: number) => {
    for (const entry of from) {
      if (picked.length >= limit) break;
      if (!picked.some((chosen) => chosen.kana === entry.kana)) picked.push(entry);
    }
  };

  const lookalikes = shuffle(candidates.filter((entry) => looksAlike(entry.kana, answer.kana)));
  take(lookalikes, Math.floor((count - 1) / 2));

  const sameGroup = shuffle(candidates.filter((entry) => entry.group === answer.group));
  take(sameGroup, count - 1);
  take(shuffle(candidates), count - 1);

  return shuffle([answer, ...picked]);
}

export function makeQuestion(
  kana: Kana,
  mode: QuizMode,
  pool: Kana[],
  isRetry = false,
): Question {
  const resolved: QuestionMode = mode === 'mixed' ? (Math.random() < 0.5 ? 'type' : 'choose') : mode;
  return {
    key: uid('q'),
    kana,
    mode: resolved,
    choices: resolved === 'choose' ? buildChoices(kana, pool) : [],
    isRetry,
  };
}

export interface Quiz {
  config: QuizConfig;
  pool: Kana[];
  queue: Question[];
  totalUnique: number;
}

export function createQuiz(config: QuizConfig): Quiz {
  const pool = kanaForGroups(config.groups);
  const wanted = config.length === 'all' ? pool.length : clamp(config.length, 1, pool.length);
  return buildQuiz(shuffle(pool).slice(0, wanted), config, pool);
}

/** A quiz over an explicit set of characters — used by "practise what I missed". */
export function createQuizFrom(selection: Kana[], config: QuizConfig): Quiz {
  return buildQuiz(shuffle(selection), config, kanaForGroups(config.groups));
}

function buildQuiz(selected: Kana[], config: QuizConfig, pool: Kana[]): Quiz {
  return {
    config,
    pool,
    queue: selected.map((kana) => makeQuestion(kana, config.mode, pool)),
    totalUnique: selected.length,
  };
}

/**
 * Sends a missed character to the back of the queue, so the round works
 * through every new character first and only then replays what was missed, in
 * the order it was missed. A character is only ever requeued once — retries
 * are never requeued, which is what guarantees the round terminates.
 */
export function scheduleRetry(queue: Question[], question: Question, quiz: Quiz): Question[] {
  return [...queue, makeQuestion(question.kana, quiz.config.mode, quiz.pool, true)];
}

// ── Results ─────────────────────────────────────────────────────────────────

export interface KanaOutcome {
  kana: Kana;
  attempts: number;
  firstTryCorrect: boolean;
  /** Missed at first, then answered correctly when it came back around. */
  recovered: boolean;
  wrongAnswers: string[];
  skips: number;
  totalMs: number;
}

export interface QuizSummary {
  outcomes: KanaOutcome[];
  missed: KanaOutcome[];
  totalUnique: number;
  firstTryCorrect: number;
  accuracy: number;
  bestStreak: number;
  totalAnswers: number;
  elapsedMs: number;
  avgMs: number;
  fastest: KanaOutcome | null;
}

export function summarize(answers: Answer[], elapsedMs: number): QuizSummary {
  const byKana = new Map<string, KanaOutcome>();

  for (const answer of answers) {
    let outcome = byKana.get(answer.kana.kana);
    if (!outcome) {
      outcome = {
        kana: answer.kana,
        attempts: 0,
        firstTryCorrect: false,
        recovered: false,
        wrongAnswers: [],
        skips: 0,
        totalMs: 0,
      };
      byKana.set(answer.kana.kana, outcome);
    }

    outcome.attempts += 1;
    outcome.totalMs += answer.elapsedMs;
    if (answer.verdict === 'correct') {
      if (!answer.isRetry && outcome.attempts === 1) outcome.firstTryCorrect = true;
      else outcome.recovered = true;
    } else if (answer.verdict === 'skipped') {
      outcome.skips += 1;
    } else {
      outcome.wrongAnswers.push(answer.given);
    }
  }

  const outcomes = [...byKana.values()];
  const firstTryCorrect = outcomes.filter((outcome) => outcome.firstTryCorrect).length;

  let bestStreak = 0;
  let streak = 0;
  for (const answer of answers) {
    streak = answer.verdict === 'correct' ? streak + 1 : 0;
    if (streak > bestStreak) bestStreak = streak;
  }

  const solved = outcomes.filter((outcome) => outcome.firstTryCorrect);
  const fastest = solved.length
    ? solved.reduce((best, entry) => (entry.totalMs < best.totalMs ? entry : best))
    : null;

  return {
    outcomes,
    missed: outcomes.filter((outcome) => !outcome.firstTryCorrect),
    totalUnique: outcomes.length,
    firstTryCorrect,
    accuracy: outcomes.length ? Math.round((firstTryCorrect / outcomes.length) * 100) : 0,
    bestStreak,
    totalAnswers: answers.length,
    elapsedMs,
    avgMs: answers.length ? Math.round(elapsedMs / answers.length) : 0,
    fastest,
  };
}
