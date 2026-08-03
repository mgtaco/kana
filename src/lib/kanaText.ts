/**
 * Reading a whole word, rather than one character.
 *
 * Per-character grading (`isCorrectRomaji`) only has to look a spelling up in a
 * table. A word is harder: three rules act across character boundaries, and all
 * three have more than one accepted romanisation.
 *
 *   っ  doubles the consonant that follows it — きって is *kitte*
 *   ん  is n, nn, or m before b, m and p — しんぶん is *shinbun* or *shimbun*
 *   long vowels are written every which way — おう is ou, oo, ō or plain o
 *
 * So instead of one expected answer, a word has a set of them: every spelling
 * built by choosing one option per syllable. The set stays small (a handful of
 * options per syllable, most of them singletons) and is only built when an
 * answer needs checking.
 *
 * Everything below is layered on the per-character table, so each character's
 * own `alternates` — the Kunrei-shiki and wāpuro spellings — keep working
 * inside a word for free.
 */

import { KANA_BY_CHAR } from '../data/hiragana';
import type { Word } from '../data/words';
import { acceptedSpellings, normalizeRomaji } from './romaji';

/** The small ya/yu/yo that bind to the character before them. */
const SMALL_Y = new Set(['ゃ', 'ゅ', 'ょ']);

/** The small tsu. Not a sound of its own — it doubles the next consonant. */
const SOKUON = 'っ';

/**
 * Splits a word into the units a reader actually processes: きゃ, っ and ん are
 * each one unit, and everything else is one character.
 */
export function splitKana(word: string): string[] {
  const chars = [...word];
  const units: string[] = [];

  for (let i = 0; i < chars.length; i++) {
    const pair = chars[i] + (chars[i + 1] ?? '');
    if (SMALL_Y.has(chars[i + 1] ?? '') && KANA_BY_CHAR.has(pair)) {
      units.push(pair);
      i += 1;
    } else {
      units.push(chars[i]);
    }
  }

  return units;
}

/**
 * Which vowel each character can lengthen when it follows one. おう and おお are
 * both a long o; えい is a long e in speech even though it is written with い.
 */
const LENGTHENS: Record<string, string[]> = {
  あ: ['a'],
  い: ['i', 'e'],
  う: ['u', 'o'],
  え: ['e'],
  お: ['o'],
};

/**
 * は and へ are read wa and e when they are doing a particle's job. That only
 * ever happens after something, never at the start of a word, which is enough
 * to keep こんにちは reading as konnichiwa without letting はな be wana.
 */
const PARTICLE_READING: Record<string, string> = { は: 'wa', へ: 'e' };

function spellingsOf(unit: string, index: number): string[] {
  const kana = KANA_BY_CHAR.get(unit);
  if (!kana) return [];
  const spellings = acceptedSpellings(kana);
  const particle = index > 0 ? PARTICLE_READING[unit] : undefined;
  return particle ? [...spellings, particle] : spellings;
}

/** っ + き is kki; っ + ち is both tchi (Hepburn) and cchi (as an IME takes it). */
function doubled(spelling: string): string[] {
  if (!spelling) return [];
  if (spelling.startsWith('ch')) return [`t${spelling}`, `c${spelling}`];
  return [`${spelling[0]}${spelling}`];
}

interface Segment {
  options: string[];
  /** Index of the first unit this segment did not consume. */
  next: number;
}

function segmentAt(units: string[], index: number): Segment {
  const unit = units[index];

  if (unit === SOKUON) {
    const inner = segmentAt(units, index + 1);
    return { options: inner.options.flatMap(doubled), next: inner.next };
  }

  let options = spellingsOf(unit, index);
  if (options.length === 0) return { options, next: index + 1 };

  if (unit === 'ん') {
    const follower = KANA_BY_CHAR.get(units[index + 1] ?? '')?.romaji ?? '';
    if (/^[bmp]/.test(follower)) options = [...options, 'm'];
    return { options, next: index + 1 };
  }

  // A following vowel character may be lengthening this syllable rather than
  // starting its own. Both readings are kept: the first option below is the
  // plain concatenation, which is what it means when it is not a long vowel.
  const follower = units[index + 1];
  const lengthens = follower ? LENGTHENS[follower] : undefined;
  if (lengthens) {
    const followerRomaji = KANA_BY_CHAR.get(follower)?.romaji ?? '';
    const merged = new Set<string>();
    for (const spelling of options) {
      merged.add(spelling + followerRomaji);
      if (lengthens.includes(spelling.slice(-1))) {
        // ...doubled (koo), and bare, which is where a macron folds to (kō → ko).
        merged.add(spelling + spelling.slice(-1));
        merged.add(spelling);
      }
    }
    return { options: [...merged], next: index + 2 };
  }

  return { options, next: index + 1 };
}

/**
 * Past this many combinations the word is not worth expanding — the caller
 * falls back to the one stored spelling. Nothing in the current list comes
 * within two orders of magnitude of it; the guard is there so that adding a
 * pathological entry degrades instead of hanging.
 */
const MAX_VARIANTS = 4096;

/**
 * Every rōmaji spelling accepted for a word, normalized. Empty when the word
 * contains a character the table does not know, or when it would expand past
 * `MAX_VARIANTS` — in both cases the caller falls back to the stored reading.
 */
export function romajiVariants(word: string): Set<string> {
  const units = splitKana(word);
  const groups: string[][] = [];

  for (let i = 0; i < units.length; ) {
    const segment = segmentAt(units, i);
    if (segment.options.length === 0) return new Set();
    groups.push(segment.options);
    i = segment.next;
  }

  let combinations = 1;
  for (const group of groups) combinations *= group.length;
  if (combinations > MAX_VARIANTS) return new Set();

  let spellings = [''];
  for (const group of groups) {
    spellings = spellings.flatMap((prefix) => group.map((option) => prefix + option));
  }

  return new Set(spellings.map(normalizeRomaji));
}

export function isCorrectWordReading(word: Word, input: string): boolean {
  const answer = normalizeRomaji(input);
  if (!answer) return false;
  if (answer === normalizeRomaji(word.romaji)) return true;
  return romajiVariants(word.word).has(answer);
}

// ── Self-check ──────────────────────────────────────────────────────────────
// The word list is three hundred entries typed by hand, and a wrong reading in
// it is invisible until someone is marked wrong for being right. The repo has
// no test runner, so this stands in for one: in development, every stored
// spelling is checked against the spellings this file would generate for the
// same word. Costs nothing in a production build, where it is dropped whole.

if (import.meta.env.DEV) {
  void import('../data/words').then(({ WORDS }) => {
    const suspect = WORDS.filter((entry) => {
      const variants = romajiVariants(entry.word);
      return variants.size > 0 && !variants.has(normalizeRomaji(entry.romaji));
    });

    if (suspect.length > 0) {
      console.warn(
        `[kana] ${suspect.length} word(s) have a stored rōmaji that the reader would not accept:`,
        suspect.map((entry) => `${entry.word} → ${entry.romaji}`),
      );
    }

    const unreadable = WORDS.filter((entry) => romajiVariants(entry.word).size === 0);
    if (unreadable.length > 0) {
      console.warn(
        `[kana] ${unreadable.length} word(s) could not be expanded at all:`,
        unreadable.map((entry) => entry.word),
      );
    }
  });
}
