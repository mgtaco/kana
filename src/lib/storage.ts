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
}

export interface Store {
  progress: Record<string, KanaProgress>;
  sessions: SessionRecord[];
  config: QuizConfig | null;
}

const EMPTY_STORE: Store = { progress: {}, sessions: [], config: null };

const MAX_SESSIONS = 30;

export function loadStore(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      progress: parsed.progress ?? {},
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

/** Folds a finished quiz into the persisted per-character history. */
export function recordSession(summary: QuizSummary, config: QuizConfig): Store {
  const store = loadStore();
  const progress = { ...store.progress };
  const now = Date.now();

  for (const outcome of summary.outcomes) {
    const previous = progress[outcome.kana.kana] ?? { seen: 0, correct: 0, lastSeen: 0 };
    progress[outcome.kana.kana] = {
      seen: previous.seen + 1,
      correct: previous.correct + (outcome.firstTryCorrect ? 1 : 0),
      lastSeen: now,
    };
  }

  const session: SessionRecord = {
    at: now,
    accuracy: summary.accuracy,
    total: summary.totalUnique,
    elapsedMs: summary.elapsedMs,
    mode: config.mode,
  };

  const next: Store = {
    progress,
    sessions: [session, ...store.sessions].slice(0, MAX_SESSIONS),
    config,
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
    mastered: Object.values(store.progress).filter((entry) => masteryOf(entry) === 'mastered')
      .length,
    quizzes: store.sessions.length,
    bestAccuracy: store.sessions.reduce((best, session) => Math.max(best, session.accuracy), 0),
  };
}
