/**
 * The taught path: twenty short lessons that follow the chart's own rows.
 *
 * Nothing is locked. The list is an order, not a gate — a beginner who opens
 * the app is pointed at the next one they have not finished, and anybody else
 * can start wherever they like.
 */

import { KANA_BY_CHAR } from '../data/hiragana';
import type { Kana } from '../data/hiragana';
import { wordsReadableWith } from '../data/words';
import type { Word } from '../data/words';
import type { Store } from './storage';

export type LessonBlock = 'basic' | 'rules' | 'dakuten' | 'yoon';

export interface RuleNote {
  /** Shown large, in place of a character. */
  glyph: string;
  title: string;
  body: string;
  example: { word: string; romaji: string; meaning: string };
}

export interface Lesson {
  id: string;
  title: string;
  japanese: string;
  subtitle: string;
  block: LessonBlock;
  /** The characters this lesson introduces. Empty for the rules lesson. */
  chars: string[];
  /** The rules lesson teaches these instead of characters. */
  notes?: RuleNote[];
}

export const BLOCK_META: Record<LessonBlock, { label: string; hint: string }> = {
  basic: { label: 'The basics', hint: 'The 46 characters everything else is built from.' },
  rules: { label: 'Reading rules', hint: 'The three things a chart cannot show you.' },
  dakuten: { label: 'Dakuten', hint: 'The same shapes, voiced.' },
  yoon: { label: 'Yōon', hint: 'Two characters, one syllable.' },
};

const lesson = (
  id: string,
  title: string,
  japanese: string,
  subtitle: string,
  block: LessonBlock,
  chars: string,
): Lesson => ({ id, title, japanese, subtitle, block, chars: [...chars] });

export const LESSONS: Lesson[] = [
  lesson('a', 'The vowel row', 'あ行', 'Five vowels. Every other character is one of these with a consonant in front.', 'basic', 'あいうえお'),
  lesson('ka', 'The k row', 'か行', 'The first consonant row — and the pattern the rest of the chart follows.', 'basic', 'かきくけこ'),
  lesson('sa', 'The s row', 'さ行', 'Watch し: it is shi, not si, and it is the one that breaks the pattern.', 'basic', 'さしすせそ'),
  lesson('ta', 'The t row', 'た行', 'Two odd ones out here: ち is chi and つ is tsu.', 'basic', 'たちつてと'),
  lesson('na', 'The n row', 'な行', 'な and た are close cousins on paper. Look at where the third stroke goes.', 'basic', 'なにぬねの'),
  lesson('ha', 'The h row', 'は行', 'ふ is fu rather than hu, and は turns up everywhere as a particle.', 'basic', 'はひふへほ'),
  lesson('ma', 'The m row', 'ま行', 'ま, も and よ all hang off a vertical stroke — this is where care pays.', 'basic', 'まみむめも'),
  lesson('ya', 'The y row', 'や行', 'Only three of them. The small versions of these build every yōon later.', 'basic', 'やゆよ'),
  lesson('ra', 'The r row', 'ら行', 'Somewhere between an r and an l. る and ろ differ by one loop.', 'basic', 'らりるれろ'),
  lesson('wa', 'わ, を and ん', 'わ行', 'The last three. を is only ever a particle, and ん is the only lone consonant.', 'basic', 'わをん'),

  {
    id: 'rules',
    title: 'Reading rules',
    japanese: '読み方',
    subtitle: 'No new characters — three habits that turn a chart into reading.',
    block: 'rules',
    chars: [],
    notes: [
      {
        glyph: 'っ',
        title: 'The small tsu',
        body: 'A つ written small has no sound of its own. It doubles the consonant that follows it and holds the beat — a tiny pause before the next syllable.',
        example: { word: 'きって', romaji: 'kitte', meaning: 'a postage stamp' },
      },
      {
        glyph: 'おう',
        title: 'Long vowels',
        body: 'A vowel followed by う or い is usually held rather than said twice. おう is a long o, えい a long e. You will see it written ou, oo, ō — all the same sound.',
        example: { word: 'がっこう', romaji: 'gakkou', meaning: 'a school' },
      },
      {
        glyph: 'は',
        title: 'The three particles',
        body: 'Three characters change their reading when they do grammatical work: は is said wa, へ is said e, and を is said o. Only ever as particles — inside a word they behave.',
        example: { word: 'こんにちは', romaji: 'konnichiwa', meaning: 'hello' },
      },
      {
        glyph: 'ん',
        title: 'The lone consonant',
        body: 'ん is a syllable on its own and holds a full beat. Before b, m and p it drifts towards an m — which is why しんぶん is written both shinbun and shimbun.',
        example: { word: 'しんぶん', romaji: 'shinbun', meaning: 'a newspaper' },
      },
    ],
  },

  lesson('ga', 'The g row', 'が行', 'Two dashes on the k row and every k becomes a g. Nothing new to draw.', 'dakuten', 'がぎぐげご'),
  lesson('za', 'The z row', 'ざ行', 'The s row voiced. じ is ji, not zi — the same exception し made.', 'dakuten', 'ざじずぜぞ'),
  lesson('da', 'The d row', 'だ行', 'The t row voiced. ぢ and づ sound exactly like じ and ず, and are rare.', 'dakuten', 'だぢづでど'),
  lesson('ba', 'The b row', 'ば行', 'The h row voiced — h to b, which is stranger to look at than to hear.', 'dakuten', 'ばびぶべぼ'),
  lesson('pa', 'The p row', 'ぱ行', 'The h row again, this time with a small circle. Circle for p, dashes for b.', 'dakuten', 'ぱぴぷぺぽ'),

  lesson('yoon-kg', 'きゃ and ぎゃ', '拗音 k・g', 'An i-column character plus a small ゃ, ゅ or ょ, said as one beat.', 'yoon', ''),
  lesson('yoon-sjt', 'しゃ, じゃ and ちゃ', '拗音 s・j・t', 'The three that lose a letter: しゃ is sha, じゃ is ja, ちゃ is cha.', 'yoon', ''),
  lesson('yoon-nhm', 'にゃ, ひゃ and みゃ', '拗音 n・h・m', 'Same construction, three more consonants.', 'yoon', ''),
  lesson('yoon-rbp', 'りゃ, びゃ and ぴゃ', '拗音 r・b・p', 'The last nine. After this the chart is finished.', 'yoon', ''),
];

// The yōon lessons are filled in from the chart rather than retyped, so they
// cannot drift out of step with it.
const YOON_ROWS: Record<string, string[]> = {
  'yoon-kg': ['きゃきゅきょ', 'ぎゃぎゅぎょ'],
  'yoon-sjt': ['しゃしゅしょ', 'じゃじゅじょ', 'ちゃちゅちょ'],
  'yoon-nhm': ['にゃにゅにょ', 'ひゃひゅひょ', 'みゃみゅみょ'],
  'yoon-rbp': ['りゃりゅりょ', 'びゃびゅびょ', 'ぴゃぴゅぴょ'],
};

for (const entry of LESSONS) {
  const rows = YOON_ROWS[entry.id];
  if (!rows) continue;
  entry.chars = rows.flatMap((row) => {
    const chars: string[] = [];
    const glyphs = [...row];
    for (let i = 0; i < glyphs.length; i += 2) chars.push(glyphs[i] + glyphs[i + 1]);
    return chars;
  });
}

export const LESSON_BY_ID = new Map(LESSONS.map((entry) => [entry.id, entry]));

export function lessonIndex(id: string): number {
  return LESSONS.findIndex((entry) => entry.id === id);
}

export function lessonKana(entry: Lesson): Kana[] {
  return entry.chars
    .map((char) => KANA_BY_CHAR.get(char))
    .filter((kana): kana is Kana => Boolean(kana));
}

/** Every character taught by this lesson and the ones before it. */
export function charsUpTo(index: number): Set<string> {
  const chars = new Set<string>();
  for (const entry of LESSONS.slice(0, index + 1)) {
    for (const char of entry.chars) chars.add(char);
  }
  return chars;
}

export function isLessonComplete(store: Store, entry: Lesson): boolean {
  return Boolean(store.lessons[entry.id]);
}

/** The first unfinished lesson, or `null` once every one is done. */
export function nextLesson(store: Store): Lesson | null {
  return LESSONS.find((entry) => !isLessonComplete(store, entry)) ?? null;
}

export function completedCount(store: Store): number {
  return LESSONS.filter((entry) => isLessonComplete(store, entry)).length;
}

/**
 * What a lesson's review phase mixes in: the characters just met, plus the ones
 * from earlier lessons, so that each lesson quietly re-tests everything before
 * it rather than only the last five.
 */
export function reviewKanaFor(index: number, limit = 12): Kana[] {
  const entry = LESSONS[index];
  if (!entry) return [];

  const fresh = lessonKana(entry);
  const earlier = [...charsUpTo(index - 1)]
    .map((char) => KANA_BY_CHAR.get(char))
    .filter((kana): kana is Kana => Boolean(kana));

  const older = earlier.sort(() => Math.random() - 0.5).slice(0, Math.max(0, limit - fresh.length));
  return [...fresh, ...older];
}

/** Words a learner can read by the end of this lesson. */
export function wordsFor(index: number): Word[] {
  return wordsReadableWith(charsUpTo(index));
}
