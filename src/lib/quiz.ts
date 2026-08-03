import type { Kana, KanaGroup } from '../data/hiragana';
import { kanaForGroups } from '../data/hiragana';
import type { Word } from '../data/words';
import { WORDS, wordsReadableWith } from '../data/words';
import { clamp, shuffle, uid } from './util';

export type QuizMode = 'type' | 'choose' | 'mixed';
export type QuestionMode = 'type' | 'choose';

/**
 * What a round is made of. `characters` and `words` differ only in the subject;
 * `speed` and `review` are both character rounds with a different way of
 * choosing and pacing them.
 */
export type Drill = 'characters' | 'words' | 'speed' | 'review';

export interface QuizConfig {
  groups: KanaGroup[];
  mode: QuizMode;
  /** Number of distinct subjects to ask, or every one in the selection. */
  length: number | 'all';
  drill: Drill;
  /** Words drill: restrict the pool to words spelled from characters already met. */
  wordsKnownOnly?: boolean;
  /** Speed run: how long the clock runs for. */
  sprintMs?: number;
}

export interface QuestionBase {
  /** Unique per appearance, so a retry animates in as a fresh card. */
  key: string;
  mode: QuestionMode;
  /** True when this is the second look at a subject the learner got wrong. */
  isRetry: boolean;
}

export type Question =
  | (QuestionBase & {
      kind: 'kana';
      kana: Kana;
      /** Populated for `choose` questions; the correct kana is among them. */
      choices: Kana[];
    })
  | (QuestionBase & {
      kind: 'word';
      word: Word;
      choices: Word[];
    });

/**
 * What a question is *about*, flattened for display and for progress. Answers
 * and outcomes carry this rather than the subject itself, so that the parts
 * downstream of the round — scoring, results, storage — do not each need to
 * know how to unwrap a character and a word.
 */
export interface Subject {
  kind: 'kana' | 'word';
  /** The character, or the word. Stable, and the key progress is filed under. */
  id: string;
  /** What is shown when the reading is being asked for. */
  prompt: string;
  reading: string;
  /** Words only. */
  meaning?: string;
}

export function subjectOf(question: Question): Subject {
  if (question.kind === 'word') {
    const { word } = question;
    return {
      kind: 'word',
      id: word.word,
      prompt: word.word,
      reading: word.romaji,
      meaning: word.meaning,
    };
  }
  const { kana } = question;
  return { kind: 'kana', id: kana.kana, prompt: kana.kana, reading: kana.romaji };
}

/** `skipped` is a miss the learner owned up to rather than guessed at. */
export type Verdict = 'correct' | 'wrong' | 'skipped';

export interface Answer {
  subject: Subject;
  mode: QuestionMode;
  isRetry: boolean;
  verdict: Verdict;
  /** What the learner typed or picked; empty when they skipped. */
  given: string;
  elapsedMs: number;
}

export const CHOICE_COUNT = 6;
/** Meanings are read, not glanced at, so a word offers fewer of them. */
export const WORD_CHOICE_COUNT = 4;

/**
 * Characters that trip learners up because they look alike. Distractors are
 * drawn from these sets first, which makes the multiple-choice quiz test
 * recognition rather than elimination. Review reuses the same table to build
 * head-to-head rounds out of whichever pair is actually causing trouble.
 */
export const CONFUSABLE_SETS: string[][] = [
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
export function baseChar(kana: string): string {
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

/**
 * The same job for a word, where the options are meanings. Words meaning the
 * same thing are excluded for the same reason as homophones above — あか and
 * あかい are both "red" — and same-tier words are preferred so the choice is
 * between four comparable words rather than one obvious one.
 */
export function buildWordChoices(
  answer: Word,
  pool: Word[],
  count = WORD_CHOICE_COUNT,
): Word[] {
  const candidates = pool.filter(
    (entry) => entry.word !== answer.word && entry.meaning !== answer.meaning,
  );

  const picked: Word[] = [];
  const take = (from: Word[]) => {
    for (const entry of from) {
      if (picked.length >= count - 1) break;
      if (!picked.some((chosen) => chosen.word === entry.word || chosen.meaning === entry.meaning)) {
        picked.push(entry);
      }
    }
  };

  take(shuffle(candidates.filter((entry) => entry.tier === answer.tier)));
  take(shuffle(candidates));

  return shuffle([answer, ...picked]);
}

function resolveMode(mode: QuizMode): QuestionMode {
  return mode === 'mixed' ? (Math.random() < 0.5 ? 'type' : 'choose') : mode;
}

export function makeKanaQuestion(
  kana: Kana,
  mode: QuizMode,
  pool: Kana[],
  isRetry = false,
): Question {
  const resolved = resolveMode(mode);
  return {
    key: uid('q'),
    kind: 'kana',
    kana,
    mode: resolved,
    choices: resolved === 'choose' ? buildChoices(kana, pool) : [],
    isRetry,
  };
}

export function makeWordQuestion(
  word: Word,
  mode: QuizMode,
  pool: Word[],
  isRetry = false,
): Question {
  const resolved = resolveMode(mode);
  return {
    key: uid('q'),
    kind: 'word',
    word,
    mode: resolved,
    choices: resolved === 'choose' ? buildWordChoices(word, pool) : [],
    isRetry,
  };
}

export interface Quiz {
  config: QuizConfig;
  pool: Kana[];
  wordPool: Word[];
  queue: Question[];
  totalUnique: number;
  /** Set for a speed run: the round ends on the clock rather than on the queue. */
  sprintMs?: number;
}

export function createQuiz(config: QuizConfig): Quiz {
  const pool = kanaForGroups(config.groups);
  const wanted = config.length === 'all' ? pool.length : clamp(config.length, 1, pool.length);
  return createQuizFrom(shuffle(pool).slice(0, wanted), config);
}

/** A quiz over an explicit set of characters — "practise what I missed", lessons, review. */
export function createQuizFrom(selection: Kana[], config: QuizConfig): Quiz {
  const pool = kanaForGroups(config.groups);
  // A lesson's five characters make hopeless distractors on their own, so the
  // options are drawn from the whole selected pool, plus the selection itself
  // in case it reaches outside it.
  const choicePool = [...new Map([...pool, ...selection].map((k) => [k.kana, k])).values()];
  const queue = shuffle(selection).map((kana) => makeKanaQuestion(kana, config.mode, choicePool));
  return { config, pool: choicePool, wordPool: [], queue, totalUnique: queue.length };
}

/**
 * The word drill. `allowed`, when given, restricts the pool to words spelled
 * entirely from characters the learner has already met.
 */
export function createWordQuiz(config: QuizConfig, allowed?: Set<string>): Quiz {
  const readable = allowed ? wordsReadableWith(allowed) : WORDS;
  // Never hand back an empty round: if too little has been met to read
  // anything yet, fall back to the easiest words in the list.
  const pool = readable.length >= 4 ? readable : WORDS.filter((entry) => entry.tier === 1);
  const wanted = config.length === 'all' ? pool.length : clamp(config.length, 1, pool.length);
  return createWordQuizFrom(shuffle(pool).slice(0, wanted), config, pool);
}

export function createWordQuizFrom(selection: Word[], config: QuizConfig, pool = WORDS): Quiz {
  const choicePool = [...new Map([...pool, ...selection].map((e) => [e.word, e])).values()];
  const queue = shuffle(selection).map((word) => makeWordQuestion(word, config.mode, choicePool));
  return {
    config,
    pool: kanaForGroups(config.groups),
    wordPool: choicePool,
    queue,
    totalUnique: queue.length,
  };
}

/**
 * Characters and words in one queue, shuffled together. This is what a lesson's
 * review phase runs: the point of it is that the characters just learned turn
 * up inside words rather than only on their own.
 */
export function createMixedQuiz(selection: Kana[], words: Word[], config: QuizConfig): Quiz {
  const pool = kanaForGroups(config.groups);
  const choicePool = [...new Map([...pool, ...selection].map((k) => [k.kana, k])).values()];
  const wordPool = words.length ? WORDS : [];

  const queue = shuffle([
    ...selection.map((kana) => makeKanaQuestion(kana, config.mode, choicePool)),
    ...words.map((word) => makeWordQuestion(word, config.mode, wordPool)),
  ]);

  return { config, pool: choicePool, wordPool, queue, totalUnique: queue.length };
}

/** Roughly how many questions a sprint could get through at one a second. */
const SPRINT_HEADROOM_MS = 900;

/**
 * A speed run. The queue is the pool shuffled and then shuffled again on the
 * end, as many times as the clock could possibly need, because the round is
 * over when the timer says so and not when the queue runs dry. Nothing is
 * requeued: a sprint is about the first answer, and a retry mid-sprint would
 * be a second look nobody asked for.
 */
export function createSprintQuiz(config: QuizConfig, selection?: Kana[]): Quiz {
  const pool = kanaForGroups(config.groups);
  const source = selection?.length ? selection : pool;
  const sprintMs = config.sprintMs ?? 60_000;

  const queue: Question[] = [];
  const needed = Math.ceil(sprintMs / SPRINT_HEADROOM_MS);
  while (queue.length < needed) {
    for (const kana of shuffle(source)) queue.push(makeKanaQuestion(kana, config.mode, pool));
  }

  return { config, pool, wordPool: [], queue, totalUnique: source.length, sprintMs };
}

/**
 * Sends a missed subject to the back of the queue, so the round works through
 * everything new first and only then replays what was missed, in the order it
 * was missed. A subject is only ever requeued once — retries are never
 * requeued, which is what guarantees the round terminates.
 */
export function scheduleRetry(queue: Question[], question: Question, quiz: Quiz): Question[] {
  const repeat =
    question.kind === 'word'
      ? makeWordQuestion(question.word, quiz.config.mode, quiz.wordPool, true)
      : makeKanaQuestion(question.kana, quiz.config.mode, quiz.pool, true);
  return [...queue, repeat];
}

// ── Results ─────────────────────────────────────────────────────────────────

export interface Outcome extends Subject {
  attempts: number;
  firstTryCorrect: boolean;
  /** Missed at first, then answered correctly when it came back around. */
  recovered: boolean;
  wrongAnswers: string[];
  skips: number;
  totalMs: number;
}

export interface QuizSummary {
  outcomes: Outcome[];
  missed: Outcome[];
  totalUnique: number;
  firstTryCorrect: number;
  accuracy: number;
  bestStreak: number;
  totalAnswers: number;
  elapsedMs: number;
  avgMs: number;
  fastest: Outcome | null;
}

export function summarize(answers: Answer[], elapsedMs: number): QuizSummary {
  const byId = new Map<string, Outcome>();

  for (const answer of answers) {
    let outcome = byId.get(answer.subject.id);
    if (!outcome) {
      outcome = {
        ...answer.subject,
        attempts: 0,
        firstTryCorrect: false,
        recovered: false,
        wrongAnswers: [],
        skips: 0,
        totalMs: 0,
      };
      byId.set(answer.subject.id, outcome);
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

  const outcomes = [...byId.values()];
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
