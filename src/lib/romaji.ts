import type { Kana } from '../data/hiragana';

/**
 * Fold an answer into the form we compare against: lowercase, no whitespace,
 * no apostrophes (so `n'` and `n` match), and ASCII-folded so a stray full-width
 * character typed with a Japanese IME still counts.
 */
export function normalizeRomaji(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s'’ˈ`-]/g, '')
    .trim();
}

/** Every spelling accepted for a character, normalized and de-duplicated. */
export function acceptedSpellings(kana: Kana): string[] {
  return [...new Set([kana.romaji, ...kana.alternates].map(normalizeRomaji))];
}

export function isCorrectRomaji(kana: Kana, input: string): boolean {
  const answer = normalizeRomaji(input);
  if (!answer) return false;
  return acceptedSpellings(kana).includes(answer);
}

/**
 * Alternate spellings worth surfacing after an answer, e.g. "also: si" for し.
 * Wāpuro-only conveniences such as `nn` are accepted silently but not taught.
 */
const HIDDEN_ALTERNATES = new Set(['nn', "n'", 'dji', 'dzu']);

export function teachableAlternates(kana: Kana): string[] {
  return kana.alternates.filter((alt) => !HIDDEN_ALTERNATES.has(normalizeRomaji(alt)));
}
