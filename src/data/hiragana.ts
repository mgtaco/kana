/**
 * The complete hiragana syllabary.
 *
 * `romaji` is the primary Hepburn reading shown in the UI. `alternates` lists
 * the other spellings a learner might reasonably type — Kunrei-shiki (si, ti,
 * tu, zya) and the wāpuro conventions used by Japanese IMEs (nn for ん). Both
 * are accepted as correct answers in the typing quiz.
 */

export type KanaGroup = 'basic' | 'dakuten' | 'combo';

export interface KanaExample {
  word: string;
  romaji: string;
  meaning: string;
}

export interface Kana {
  /** The character itself, also used as its stable id. */
  kana: string;
  romaji: string;
  alternates: string[];
  group: KanaGroup;
  /** Marks readings that are vanishingly rare in modern Japanese. */
  rare?: boolean;
  example: KanaExample;
}

const k = (
  kana: string,
  romaji: string,
  alternates: string[],
  group: KanaGroup,
  example: KanaExample,
  rare?: boolean,
): Kana => ({ kana, romaji, alternates, group, example, ...(rare ? { rare } : null) });

export const KANA: Kana[] = [
  // ── Gojūon: the 46 basic characters ────────────────────────────────────────
  k('あ', 'a', [], 'basic', { word: 'あめ', romaji: 'ame', meaning: 'rain' }),
  k('い', 'i', [], 'basic', { word: 'いぬ', romaji: 'inu', meaning: 'dog' }),
  k('う', 'u', [], 'basic', { word: 'うみ', romaji: 'umi', meaning: 'sea' }),
  k('え', 'e', [], 'basic', { word: 'えき', romaji: 'eki', meaning: 'station' }),
  k('お', 'o', [], 'basic', { word: 'おと', romaji: 'oto', meaning: 'sound' }),

  k('か', 'ka', [], 'basic', { word: 'かさ', romaji: 'kasa', meaning: 'umbrella' }),
  k('き', 'ki', [], 'basic', { word: 'きって', romaji: 'kitte', meaning: 'postage stamp' }),
  k('く', 'ku', [], 'basic', { word: 'くも', romaji: 'kumo', meaning: 'cloud' }),
  k('け', 'ke', [], 'basic', { word: 'けむり', romaji: 'kemuri', meaning: 'smoke' }),
  k('こ', 'ko', [], 'basic', { word: 'こえ', romaji: 'koe', meaning: 'voice' }),

  k('さ', 'sa', [], 'basic', { word: 'さかな', romaji: 'sakana', meaning: 'fish' }),
  k('し', 'shi', ['si'], 'basic', { word: 'しま', romaji: 'shima', meaning: 'island' }),
  k('す', 'su', [], 'basic', { word: 'すな', romaji: 'suna', meaning: 'sand' }),
  k('せ', 'se', [], 'basic', { word: 'せかい', romaji: 'sekai', meaning: 'world' }),
  k('そ', 'so', [], 'basic', { word: 'そら', romaji: 'sora', meaning: 'sky' }),

  k('た', 'ta', [], 'basic', { word: 'たまご', romaji: 'tamago', meaning: 'egg' }),
  k('ち', 'chi', ['ti'], 'basic', { word: 'ちず', romaji: 'chizu', meaning: 'map' }),
  k('つ', 'tsu', ['tu'], 'basic', { word: 'つき', romaji: 'tsuki', meaning: 'moon' }),
  k('て', 'te', [], 'basic', { word: 'てがみ', romaji: 'tegami', meaning: 'letter' }),
  k('と', 'to', [], 'basic', { word: 'とり', romaji: 'tori', meaning: 'bird' }),

  k('な', 'na', [], 'basic', { word: 'なつ', romaji: 'natsu', meaning: 'summer' }),
  k('に', 'ni', [], 'basic', { word: 'にわ', romaji: 'niwa', meaning: 'garden' }),
  k('ぬ', 'nu', [], 'basic', { word: 'ぬの', romaji: 'nuno', meaning: 'cloth' }),
  k('ね', 'ne', [], 'basic', { word: 'ねこ', romaji: 'neko', meaning: 'cat' }),
  k('の', 'no', [], 'basic', { word: 'のり', romaji: 'nori', meaning: 'seaweed' }),

  k('は', 'ha', [], 'basic', { word: 'はな', romaji: 'hana', meaning: 'flower' }),
  k('ひ', 'hi', [], 'basic', { word: 'ひかり', romaji: 'hikari', meaning: 'light' }),
  k('ふ', 'fu', ['hu'], 'basic', { word: 'ふゆ', romaji: 'fuyu', meaning: 'winter' }),
  k('へ', 'he', [], 'basic', { word: 'へや', romaji: 'heya', meaning: 'room' }),
  k('ほ', 'ho', [], 'basic', { word: 'ほし', romaji: 'hoshi', meaning: 'star' }),

  k('ま', 'ma', [], 'basic', { word: 'まど', romaji: 'mado', meaning: 'window' }),
  k('み', 'mi', [], 'basic', { word: 'みず', romaji: 'mizu', meaning: 'water' }),
  k('む', 'mu', [], 'basic', { word: 'むし', romaji: 'mushi', meaning: 'insect' }),
  k('め', 'me', [], 'basic', { word: 'めがね', romaji: 'megane', meaning: 'glasses' }),
  k('も', 'mo', [], 'basic', { word: 'もり', romaji: 'mori', meaning: 'forest' }),

  k('や', 'ya', [], 'basic', { word: 'やま', romaji: 'yama', meaning: 'mountain' }),
  k('ゆ', 'yu', [], 'basic', { word: 'ゆき', romaji: 'yuki', meaning: 'snow' }),
  k('よ', 'yo', [], 'basic', { word: 'よる', romaji: 'yoru', meaning: 'night' }),

  k('ら', 'ra', [], 'basic', { word: 'らいねん', romaji: 'rainen', meaning: 'next year' }),
  k('り', 'ri', [], 'basic', { word: 'りんご', romaji: 'ringo', meaning: 'apple' }),
  k('る', 'ru', [], 'basic', { word: 'るす', romaji: 'rusu', meaning: 'not at home' }),
  k('れ', 're', [], 'basic', { word: 'れきし', romaji: 'rekishi', meaning: 'history' }),
  k('ろ', 'ro', [], 'basic', { word: 'ろく', romaji: 'roku', meaning: 'six' }),

  k('わ', 'wa', [], 'basic', { word: 'わたし', romaji: 'watashi', meaning: 'I, me' }),
  k('を', 'wo', ['o'], 'basic', {
    word: 'ほんをよむ',
    romaji: 'hon o yomu',
    meaning: 'to read a book — を marks the object',
  }),
  k('ん', 'n', ['nn', "n'"], 'basic', { word: 'にほん', romaji: 'nihon', meaning: 'Japan' }),

  // ── Dakuten and handakuten: voiced and plosive marks ──────────────────────
  k('が', 'ga', [], 'dakuten', { word: 'がっこう', romaji: 'gakkou', meaning: 'school' }),
  k('ぎ', 'gi', [], 'dakuten', { word: 'ぎんこう', romaji: 'ginkou', meaning: 'bank' }),
  k('ぐ', 'gu', [], 'dakuten', { word: 'かぐ', romaji: 'kagu', meaning: 'furniture' }),
  k('げ', 'ge', [], 'dakuten', { word: 'げんき', romaji: 'genki', meaning: 'healthy, lively' }),
  k('ご', 'go', [], 'dakuten', { word: 'ごはん', romaji: 'gohan', meaning: 'rice, a meal' }),

  k('ざ', 'za', [], 'dakuten', { word: 'ざっし', romaji: 'zasshi', meaning: 'magazine' }),
  k('じ', 'ji', ['zi'], 'dakuten', { word: 'じかん', romaji: 'jikan', meaning: 'time' }),
  k('ず', 'zu', [], 'dakuten', { word: 'すず', romaji: 'suzu', meaning: 'bell' }),
  k('ぜ', 'ze', [], 'dakuten', { word: 'ぜんぶ', romaji: 'zenbu', meaning: 'all of it' }),
  k('ぞ', 'zo', [], 'dakuten', { word: 'ぞう', romaji: 'zou', meaning: 'elephant' }),

  k('だ', 'da', [], 'dakuten', { word: 'だいがく', romaji: 'daigaku', meaning: 'university' }),
  k(
    'ぢ',
    'ji',
    ['di', 'dji'],
    'dakuten',
    { word: 'はなぢ', romaji: 'hanaji', meaning: 'nosebleed' },
    true,
  ),
  k(
    'づ',
    'zu',
    ['du', 'dzu'],
    'dakuten',
    { word: 'つづく', romaji: 'tsuzuku', meaning: 'to continue' },
    true,
  ),
  k('で', 'de', [], 'dakuten', { word: 'でんわ', romaji: 'denwa', meaning: 'telephone' }),
  k('ど', 'do', [], 'dakuten', { word: 'どうぶつ', romaji: 'doubutsu', meaning: 'animal' }),

  k('ば', 'ba', [], 'dakuten', { word: 'かばん', romaji: 'kaban', meaning: 'bag' }),
  k('び', 'bi', [], 'dakuten', { word: 'えび', romaji: 'ebi', meaning: 'shrimp' }),
  k('ぶ', 'bu', [], 'dakuten', { word: 'ぶんか', romaji: 'bunka', meaning: 'culture' }),
  k('べ', 'be', [], 'dakuten', { word: 'べんきょう', romaji: 'benkyou', meaning: 'study' }),
  k('ぼ', 'bo', [], 'dakuten', { word: 'ぼうし', romaji: 'boushi', meaning: 'hat' }),

  k('ぱ', 'pa', [], 'dakuten', { word: 'ぱん', romaji: 'pan', meaning: 'bread' }),
  k('ぴ', 'pi', [], 'dakuten', { word: 'ぴかぴか', romaji: 'pikapika', meaning: 'sparkling' }),
  k('ぷ', 'pu', [], 'dakuten', { word: 'きっぷ', romaji: 'kippu', meaning: 'ticket' }),
  k('ぺ', 'pe', [], 'dakuten', { word: 'ぺん', romaji: 'pen', meaning: 'pen' }),
  k('ぽ', 'po', [], 'dakuten', { word: 'さんぽ', romaji: 'sanpo', meaning: 'a walk' }),

  // ── Yōon: contracted sounds written with a small や, ゆ or よ ──────────────
  k('きゃ', 'kya', [], 'combo', { word: 'きゃく', romaji: 'kyaku', meaning: 'guest' }),
  k('きゅ', 'kyu', [], 'combo', { word: 'きゅう', romaji: 'kyuu', meaning: 'nine' }),
  k('きょ', 'kyo', [], 'combo', { word: 'きょう', romaji: 'kyou', meaning: 'today' }),

  k('しゃ', 'sha', ['sya'], 'combo', { word: 'しゃしん', romaji: 'shashin', meaning: 'photograph' }),
  k('しゅ', 'shu', ['syu'], 'combo', { word: 'しゅみ', romaji: 'shumi', meaning: 'hobby' }),
  k('しょ', 'sho', ['syo'], 'combo', { word: 'しょくじ', romaji: 'shokuji', meaning: 'a meal' }),

  k('ちゃ', 'cha', ['tya', 'cya'], 'combo', { word: 'おちゃ', romaji: 'ocha', meaning: 'tea' }),
  k('ちゅ', 'chu', ['tyu', 'cyu'], 'combo', {
    word: 'ちゅうい',
    romaji: 'chuui',
    meaning: 'caution',
  }),
  k('ちょ', 'cho', ['tyo', 'cyo'], 'combo', {
    word: 'ちょきん',
    romaji: 'chokin',
    meaning: 'savings',
  }),

  k('にゃ', 'nya', [], 'combo', { word: 'にゃんこ', romaji: 'nyanko', meaning: 'kitty' }),
  k('にゅ', 'nyu', [], 'combo', { word: 'ぎゅうにゅう', romaji: 'gyuunyuu', meaning: 'milk' }),
  k('にょ', 'nyo', [], 'combo', { word: 'にょうぼう', romaji: 'nyoubou', meaning: "one's wife" }),

  k('ひゃ', 'hya', [], 'combo', { word: 'ひゃく', romaji: 'hyaku', meaning: 'one hundred' }),
  k('ひゅ', 'hyu', [], 'combo', {
    word: 'ひゅうひゅう',
    romaji: 'hyuuhyuu',
    meaning: 'whistling wind',
  }),
  k('ひょ', 'hyo', [], 'combo', { word: 'ひょう', romaji: 'hyou', meaning: 'a table, a chart' }),

  k('みゃ', 'mya', [], 'combo', { word: 'みゃく', romaji: 'myaku', meaning: 'pulse' }),
  k(
    'みゅ',
    'myu',
    [],
    'combo',
    { word: 'みゃくみゃく', romaji: 'myakumyaku', meaning: 'unbroken, continuous' },
    true,
  ),
  k('みょ', 'myo', [], 'combo', { word: 'みょうじ', romaji: 'myouji', meaning: 'surname' }),

  k('りゃ', 'rya', [], 'combo', { word: 'りゃくご', romaji: 'ryakugo', meaning: 'abbreviation' }),
  k('りゅ', 'ryu', [], 'combo', {
    word: 'りゅうがく',
    romaji: 'ryuugaku',
    meaning: 'studying abroad',
  }),
  k('りょ', 'ryo', [], 'combo', { word: 'りょこう', romaji: 'ryokou', meaning: 'travel' }),

  k('ぎゃ', 'gya', [], 'combo', { word: 'ぎゃく', romaji: 'gyaku', meaning: 'the reverse' }),
  k('ぎゅ', 'gyu', [], 'combo', { word: 'ぎゅうにく', romaji: 'gyuuniku', meaning: 'beef' }),
  k('ぎょ', 'gyo', [], 'combo', { word: 'ぎょうざ', romaji: 'gyouza', meaning: 'dumplings' }),

  k('じゃ', 'ja', ['zya', 'jya'], 'combo', {
    word: 'じゃがいも',
    romaji: 'jagaimo',
    meaning: 'potato',
  }),
  k('じゅ', 'ju', ['zyu', 'jyu'], 'combo', {
    word: 'じゅぎょう',
    romaji: 'jugyou',
    meaning: 'a class, a lesson',
  }),
  k('じょ', 'jo', ['zyo', 'jyo'], 'combo', {
    word: 'じょうず',
    romaji: 'jouzu',
    meaning: 'skilful',
  }),

  k(
    'びゃ',
    'bya',
    [],
    'combo',
    { word: 'さんびゃく', romaji: 'sanbyaku', meaning: 'three hundred' },
    true,
  ),
  k(
    'びゅ',
    'byu',
    [],
    'combo',
    { word: 'びゅうびゅう', romaji: 'byuubyuu', meaning: 'howling wind' },
    true,
  ),
  k('びょ', 'byo', [], 'combo', { word: 'びょういん', romaji: 'byouin', meaning: 'hospital' }),

  k(
    'ぴゃ',
    'pya',
    [],
    'combo',
    { word: 'ろっぴゃく', romaji: 'roppyaku', meaning: 'six hundred' },
    true,
  ),
  k(
    'ぴゅ',
    'pyu',
    [],
    'combo',
    { word: 'ぴゅうぴゅう', romaji: 'pyuupyuu', meaning: 'wind whistling by' },
    true,
  ),
  k('ぴょ', 'pyo', [], 'combo', { word: 'ぴょんぴょん', romaji: 'pyonpyon', meaning: 'hopping' }),
];

export const KANA_BY_CHAR = new Map(KANA.map((entry) => [entry.kana, entry]));

export function getKana(char: string): Kana {
  const entry = KANA_BY_CHAR.get(char);
  if (!entry) throw new Error(`Unknown kana: ${char}`);
  return entry;
}

// ── Chart layout ────────────────────────────────────────────────────────────
// The chart is laid out the way a printed gojūon table is: consonant rows down
// the side, vowel columns across the top. `null` marks a gap in the syllabary.

export interface ChartRow {
  /** Romaji label for the consonant row, e.g. "k" for か・き・く・け・こ. */
  label: string;
  cells: (string | null)[];
}

export interface ChartSection {
  id: KanaGroup;
  title: string;
  subtitle: string;
  /** Japanese name of the section, shown as a small caption. */
  japanese: string;
  columns: string[];
  rows: ChartRow[];
}

export const CHART_SECTIONS: ChartSection[] = [
  {
    id: 'basic',
    title: 'Gojūon',
    japanese: '五十音',
    subtitle: 'The 46 basic characters — start here.',
    columns: ['a', 'i', 'u', 'e', 'o'],
    rows: [
      { label: '', cells: ['あ', 'い', 'う', 'え', 'お'] },
      { label: 'k', cells: ['か', 'き', 'く', 'け', 'こ'] },
      { label: 's', cells: ['さ', 'し', 'す', 'せ', 'そ'] },
      { label: 't', cells: ['た', 'ち', 'つ', 'て', 'と'] },
      { label: 'n', cells: ['な', 'に', 'ぬ', 'ね', 'の'] },
      { label: 'h', cells: ['は', 'ひ', 'ふ', 'へ', 'ほ'] },
      { label: 'm', cells: ['ま', 'み', 'む', 'め', 'も'] },
      { label: 'y', cells: ['や', null, 'ゆ', null, 'よ'] },
      { label: 'r', cells: ['ら', 'り', 'る', 'れ', 'ろ'] },
      { label: 'w', cells: ['わ', null, null, null, 'を'] },
      { label: '', cells: ['ん', null, null, null, null] },
    ],
  },
  {
    id: 'dakuten',
    title: 'Dakuten & handakuten',
    japanese: '濁音・半濁音',
    subtitle: 'The same shapes with " or ° added, voicing the consonant.',
    columns: ['a', 'i', 'u', 'e', 'o'],
    rows: [
      { label: 'g', cells: ['が', 'ぎ', 'ぐ', 'げ', 'ご'] },
      { label: 'z', cells: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'] },
      { label: 'd', cells: ['だ', 'ぢ', 'づ', 'で', 'ど'] },
      { label: 'b', cells: ['ば', 'び', 'ぶ', 'べ', 'ぼ'] },
      { label: 'p', cells: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'] },
    ],
  },
  {
    id: 'combo',
    title: 'Yōon',
    japanese: '拗音',
    subtitle: 'An i-column character plus a small ゃ, ゅ or ょ — one syllable.',
    columns: ['ya', 'yu', 'yo'],
    rows: [
      { label: 'k', cells: ['きゃ', 'きゅ', 'きょ'] },
      { label: 's', cells: ['しゃ', 'しゅ', 'しょ'] },
      { label: 't', cells: ['ちゃ', 'ちゅ', 'ちょ'] },
      { label: 'n', cells: ['にゃ', 'にゅ', 'にょ'] },
      { label: 'h', cells: ['ひゃ', 'ひゅ', 'ひょ'] },
      { label: 'm', cells: ['みゃ', 'みゅ', 'みょ'] },
      { label: 'r', cells: ['りゃ', 'りゅ', 'りょ'] },
      { label: 'g', cells: ['ぎゃ', 'ぎゅ', 'ぎょ'] },
      { label: 'j', cells: ['じゃ', 'じゅ', 'じょ'] },
      { label: 'b', cells: ['びゃ', 'びゅ', 'びょ'] },
      { label: 'p', cells: ['ぴゃ', 'ぴゅ', 'ぴょ'] },
    ],
  },
];

export const GROUP_META: Record<KanaGroup, { label: string; japanese: string; hint: string }> = {
  basic: { label: 'Basic', japanese: '五十音', hint: 'あ い う え お …' },
  dakuten: { label: 'Dakuten', japanese: '濁音', hint: 'が ざ だ ば ぱ …' },
  combo: { label: 'Combos', japanese: '拗音', hint: 'きゃ しゅ ちょ …' },
};

export const GROUP_ORDER: KanaGroup[] = ['basic', 'dakuten', 'combo'];

export function kanaForGroups(groups: KanaGroup[]): Kana[] {
  const wanted = new Set(groups);
  return KANA.filter((entry) => wanted.has(entry.group));
}
