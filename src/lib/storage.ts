import { charsRequiredFor } from '../data/words';
import type { QuizConfig, QuizSummary } from './quiz';

const STORE_KEY = 'kana:v1';
export const THEME_KEY = 'kana:theme';

export interface KanaProgress {
  seen: number;
  correct: number;
  lastSeen: number;
}

export interface SessionRecord {
  at: number;
  accuracy: number;
  total: number;
  elapsedMs: number;
  mode: QuizConfig['mode'];
  /** Absent on rounds recorded before there was more than one kind. */
  drill?: QuizConfig['drill'];
}

export interface LessonRecord {
  completedAt: number;
  accuracy: number;
}

export interface Store {
  progress: Record<string, KanaProgress>;
  /** The same history, kept per word rather than per character. */
  words: Record<string, KanaProgress>;
  lessons: Record<string, LessonRecord>;
  sessions: SessionRecord[];
  config: QuizConfig | null;
}

const EMPTY_STORE: Store = { progress: {}, words: {}, lessons: {}, sessions: [], config: null };

const MAX_SESSIONS = 30;

/**
 * The key is deliberately unchanged. Everything added since v1 is optional and
 * defaulted here, so a learner who has been using the app keeps their progress
 * rather than being handed a blank chart in exchange for the new modes.
 */
export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      progress: parsed.progress ?? {},
      words: parsed.words ?? {},
      lessons: parsed.lessons ?? {},
      sessions: parsed.sessions ?? [],
      config: parsed.config ?? null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

function saveStore(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage can be unavailable or full; progress tracking is a nicety, not a
    // requirement, so a failed write is silently tolerated.
  }
}

function credit(
  table: Record<string, KanaProgress>,
  id: string,
  correct: boolean,
  now: number,
): void {
  const previous = table[id] ?? { seen: 0, correct: 0, lastSeen: 0 };
  table[id] = {
    seen: previous.seen + 1,
    correct: previous.correct + (correct ? 1 : 0),
    lastSeen: now,
  };
}

/** Folds a finished quiz into the persisted history. */
export function recordSession(summary: QuizSummary, config: QuizConfig): Store {
  const store = loadStore();
  const progress = { ...store.progress };
  const words = { ...store.words };
  const now = Date.now();

  for (const outcome of summary.outcomes) {
    if (outcome.kind === 'word') {
      credit(words, outcome.id, outcome.firstTryCorrect, now);
      // Reading a word right is evidence for every character in it. Reading it
      // wrong is evidence against none of them in particular — one slip in a
      // five-character word should not drag five mastery scores down with it.
      if (outcome.firstTryCorrect) {
        for (const char of new Set(charsRequiredFor(outcome.id))) {
          credit(progress, char, true, now);
        }
      }
    } else {
      credit(progress, outcome.id, outcome.firstTryCorrect, now);
    }
  }

  const session: SessionRecord = {
    at: now,
    accuracy: summary.accuracy,
    total: summary.totalUnique,
    elapsedMs: summary.elapsedMs,
    mode: config.mode,
    drill: config.drill,
  };

  const next: Store = {
    ...store,
    progress,
    words,
    sessions: [session, ...store.sessions].slice(0, MAX_SESSIONS),
    config,
  };
  saveStore(next);
  return next;
}

export function completeLesson(lessonId: string, accuracy: number): Store {
  const store = loadStore();
  const previous = store.lessons[lessonId];
  const next: Store = {
    ...store,
    lessons: {
      ...store.lessons,
      // Keep the best score a lesson has ever been finished with, so revisiting
      // one for a refresher can never make the list look worse than it is.
      [lessonId]: {
        completedAt: Date.now(),
        accuracy: Math.max(accuracy, previous?.accuracy ?? 0),
      },
    },
  };
  saveStore(next);
  return next;
}

export function saveConfig(config: QuizConfig): void {
  saveStore({ ...loadStore(), config });
}

export function resetProgress(): Store {
  saveStore(EMPTY_STORE);
  return EMPTY_STORE;
}

// ── Derived figures ─────────────────────────────────────────────────────────

export type Mastery = 'new' | 'learning' | 'familiar' | 'mastered';

export function masteryOf(progress: KanaProgress | undefined): Mastery {
  if (!progress || progress.seen === 0) return 'new';
  const accuracy = progress.correct / progress.seen;
  if (progress.seen >= 3 && accuracy >= 0.85) return 'mastered';
  if (accuracy >= 0.6) return 'familiar';
  return 'learning';
}

export const MASTERY_LABEL: Record<Mastery, string> = {
  new: 'Not practised yet',
  learning: 'Still learning',
  familiar: 'Getting there',
  mastered: 'Mastered',
};

export interface OverallStats {
  practised: number;
  mastered: number;
  quizzes: number;
  bestAccuracy: number;
}

export function overallStats(store: Store): OverallStats {
  const entries = Object.values(store.progress);
  return {
    practised: entries.length,
    mastered: entries.filter((entry) => masteryOf(entry) === 'mastered').length,
    quizzes: store.sessions.length,
    bestAccuracy: store.sessions.reduce((best, session) => Math.max(best, session.accuracy), 0),
  };
}

/** Days since the epoch, in the reader's own timezone. */
function dayNumber(at: number): number {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return Math.round(date.getTime() / 86_400_000);
}

/**
 * Consecutive days ending today on which a round was finished. Today is allowed
 * to be empty: a streak shown as broken at breakfast, before there has been any
 * chance to practise, would be both wrong and discouraging.
 */
export function streakDays(store: Store): number {
  if (store.sessions.length === 0) return 0;

  const days = new Set(store.sessions.map((session) => dayNumber(session.at)));
  const today = dayNumber(Date.now());

  let cursor = days.has(today) ? today : today - 1;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

/** Every character the learner has met, whichever drill introduced it. */
export function metCharacters(store: Store): Set<string> {
  return new Set(Object.keys(store.progress));
}
