/**
 * Choosing what to practise next, out of what has already been practised.
 *
 * There is no spaced-repetition schedule here and no new bookkeeping: the store
 * already holds, per character, how often it has been asked, how often it was
 * right, and when it was last seen. That is enough to rank characters by how
 * much attention they want — weak ones first, then cold ones — which is all a
 * review round needs to be better than a shuffle.
 */

import { KANA_BY_CHAR } from '../data/hiragana';
import type { Kana } from '../data/hiragana';
import { CONFUSABLE_SETS, createQuizFrom } from './quiz';
import type { Quiz, QuizConfig } from './quiz';
import { masteryOf } from './storage';
import type { KanaProgress, Store } from './storage';

const DAY = 86_400_000;

/** Past this, a character has simply gone cold; older is not colder. */
const STALE_CEILING_DAYS = 14;

/** How long a mastered character stays settled before it is worth a look. */
const SETTLED_FOR = 3 * DAY;

export interface ReviewEntry {
  kana: Kana;
  progress: KanaProgress;
  /** 0 (never missed) to 1 (never right). */
  weakness: number;
  daysSince: number;
  score: number;
}

function entriesFor(store: Store, now: number): ReviewEntry[] {
  const out: ReviewEntry[] = [];

  for (const [char, progress] of Object.entries(store.progress)) {
    const kana = KANA_BY_CHAR.get(char);
    if (!kana || progress.seen === 0) continue;

    const weakness = 1 - progress.correct / progress.seen;
    const daysSince = Math.max(0, (now - progress.lastSeen) / DAY);
    const stale = Math.min(1, daysSince / STALE_CEILING_DAYS);

    out.push({
      kana,
      progress,
      weakness,
      daysSince,
      // Weakness leads, staleness follows, and a little noise keeps two rounds
      // in a row from being the same round twice.
      score: weakness * 1.6 + stale * 0.9 + Math.random() * 0.25,
    });
  }

  return out;
}

/** Everything seen so far, worst first. */
export function reviewQueue(store: Store, now = Date.now()): ReviewEntry[] {
  return entriesFor(store, now).sort((a, b) => b.score - a.score);
}

/**
 * How many characters want another look: anything not yet mastered, plus
 * anything mastered that has been sitting untouched for a few days.
 */
export function dueCount(store: Store, now = Date.now()): number {
  return entriesFor(store, now).filter(
    (entry) =>
      masteryOf(entry.progress) !== 'mastered' || now - entry.progress.lastSeen > SETTLED_FOR,
  ).length;
}

/**
 * Sets of look-alikes with two or more shaky members. These are the characters
 * a learner is not so much forgetting as confusing, and the fix is to see them
 * next to each other — which is exactly what the table was already built for.
 */
export function troublePairs(store: Store): string[][] {
  const shaky = new Set(
    Object.entries(store.progress)
      .filter(([, progress]) => progress.seen > 0 && masteryOf(progress) !== 'mastered')
      .map(([char]) => char),
  );

  return CONFUSABLE_SETS.filter(
    (set) => set.filter((char) => shaky.has(char)).length >= 2,
  ).map((set) => set.filter((char) => shaky.has(char)));
}

/**
 * A round weighted towards what is weakest and stalest. Where a trouble set is
 * represented, its other shaky members are pulled in alongside, so the pair
 * that is actually being confused turns up in the same round.
 */
export function createReviewQuiz(store: Store, config: QuizConfig): Quiz {
  const ranked = reviewQueue(store);
  const wanted = config.length === 'all' ? ranked.length : Math.min(config.length, ranked.length);

  const selection = new Map<string, Kana>();
  const add = (kana: Kana) => {
    if (selection.size < Math.max(wanted, 1)) selection.set(kana.kana, kana);
  };

  const trouble = troublePairs(store);
  for (const entry of ranked) {
    add(entry.kana);
    const set = trouble.find((chars) => chars.includes(entry.kana.kana));
    if (!set) continue;
    for (const char of set) {
      const partner = KANA_BY_CHAR.get(char);
      if (partner) add(partner);
    }
  }

  return createQuizFrom([...selection.values()], config);
}
