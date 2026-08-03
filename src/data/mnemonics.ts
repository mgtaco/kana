/**
 * A one-line hook for every character in the syllabary.
 *
 * The three groups are learned in three different ways, so they get three
 * different kinds of hint:
 *
 * - the 46 **basic** characters get an image — something to see in the shape,
 *   with the sound buried in the word for it;
 * - the 25 **dakuten** characters get the rule, because there is nothing new to
 *   see: the shape is already known and only the voicing has changed;
 * - the 33 **yōon** get the construction, for the same reason.
 *
 * Only the first group is written out by hand. The other two are derived from
 * the tables below, which is both shorter and impossible to get inconsistent.
 *
 * Keywords are wrapped in *asterisks*; `<MnemonicLine>` renders those segments
 * highlighted so the letters carrying the reading stand out of the sentence.
 */

import { KANA } from './hiragana';

export interface Mnemonic {
  /** One line, present tense. Keywords wrapped in *asterisks* for highlighting. */
  hint: string;
  /** Visual anchor shown beside the glyph. Omitted for derived kana. */
  emoji?: string;
}

// ── The 46 basic characters ─────────────────────────────────────────────────

const BASIC: Record<string, Mnemonic> = {
  あ: { hint: 'A capital *A* with a ribbon pulled through it.', emoji: '🅰️' },
  い: { hint: 'Two *ee*ls swimming side by side.', emoji: '🐟' },
  う: { hint: 'A face in profile, mouth rounded to say *oo*.', emoji: '😯' },
  え: { hint: 'An *e*xotic bird with a long trailing tail.', emoji: '🦅' },
  お: { hint: 'A boot swinging at a ball — *oh!*', emoji: '⚽' },

  か: { hint: 'A mosquito mid-bite — *ka* is the word for one.', emoji: '🦟' },
  き: { hint: 'A *key*, teeth and all.', emoji: '🔑' },
  く: { hint: 'A beak open for a *cu*ckoo call.', emoji: '🐦' },
  け: { hint: 'A *ke*g tipped up on its stand.', emoji: '🛢️' },
  こ: { hint: 'Two *co*ils of rope, one above the other.', emoji: '🪢' },

  さ: { hint: 'A *sa*il leaning into the wind.', emoji: '⛵' },
  し: { hint: 'A fishing hook hanging straight down — *shi*.', emoji: '🎣' },
  す: { hint: 'A corkscrew twisting down into a cork — *su*.', emoji: '🍷' },
  せ: { hint: 'A mouth held open at the dentist. Say *se*.', emoji: '🦷' },
  そ: { hint: 'A zigzag of *sew*ing stitches.', emoji: '🧵' },

  た: { hint: 'Look closely: a *t* and an *a* standing together.', emoji: '🔤' },
  ち: { hint: 'A *chee*rleader with a ponytail swinging.', emoji: '📣' },
  つ: { hint: 'A *tsu*nami curling over.', emoji: '🌊' },
  て: { hint: 'て is the word for a hand, and it points like one — *te*.', emoji: '✋' },
  と: { hint: 'A *toe* with a splinter stuck in it.', emoji: '🦶' },

  な: { hint: 'A *na*il with a knot of rope round it.', emoji: '🔨' },
  に: { hint: 'に is how you say two — and 二 hides down its right side.', emoji: '2️⃣' },
  ぬ: { hint: 'A twist of *noo*dles round a pair of chopsticks.', emoji: '🍜' },
  ね: { hint: 'A curled tail — *ne*ko is a cat.', emoji: '🐈' },
  の: { hint: 'One swirl, like a *no*-entry sign drawn without lifting the pen.', emoji: '🚫' },

  は: { hint: 'A capital *H* with a flag flying off it — *ha*!', emoji: '😄' },
  ひ: { hint: 'A grin stretched wide — *hee* hee.', emoji: '😁' },
  ふ: { hint: 'A *foo*l hula-hooping, arms flung out.', emoji: '🕺' },
  へ: { hint: 'A *hea*p of earth seen side on.', emoji: '⛰️' },
  ほ: { hint: 'は with one more bar, and *ha* becomes *ho*.', emoji: '🏠' },

  ま: { hint: '*Ma*ma with her apron tied in a bow.', emoji: '👩' },
  み: { hint: 'A ribbon curled beside the note *mi*.', emoji: '🎵' },
  む: { hint: 'A cow with one horn, *moo*ing.', emoji: '🐄' },
  め: { hint: 'め is the word for an eye, and the loop is the eye.', emoji: '👁️' },
  も: { hint: 'A hook carrying *mo*re worms than it needs.', emoji: '🪱' },

  や: { hint: 'A *ya*k with one horn thrown back.', emoji: '🐃' },
  ゆ: { hint: 'ゆ hangs outside every bathhouse — it means hot water, *yu*.', emoji: '♨️' },
  よ: { hint: 'A *yo*-yo asleep on its string.', emoji: '🪀' },

  ら: { hint: 'A *ra*bbit sitting up with its ears back.', emoji: '🐇' },
  り: { hint: 'Two *ree*ds standing in a river.', emoji: '🌾' },
  る: { hint: 'A *rou*te that loops back on itself.', emoji: '🔁' },
  れ: { hint: 'The same start as る, but the tail flicks out — *re*.', emoji: '🦎' },
  ろ: { hint: 'る with the loop untied — an open *ro*ad.', emoji: '🛣️' },

  わ: { hint: 'A s*wa*n gliding, neck curved.', emoji: '🦢' },
  を: { hint: 'Only ever a particle, marking what a verb acts *o*n — and said plain *o*.', emoji: '🎯' },
  ん: { hint: 'The one lone consonant: an *n* leaning back for a rest.', emoji: '💤' },
};

// ── Dakuten and handakuten: the rule ────────────────────────────────────────

interface VoicedRow {
  plain: string;
  voiced: string;
  from: string;
  to: string;
  /** The small circle rather than the two dashes. */
  handakuten?: boolean;
}

const VOICED_ROWS: VoicedRow[] = [
  { plain: 'かきくけこ', voiced: 'がぎぐげご', from: 'k', to: 'g' },
  { plain: 'さしすせそ', voiced: 'ざじずぜぞ', from: 's', to: 'z' },
  { plain: 'たちつてと', voiced: 'だぢづでど', from: 't', to: 'd' },
  { plain: 'はひふへほ', voiced: 'ばびぶべぼ', from: 'h', to: 'b' },
  { plain: 'はひふへほ', voiced: 'ぱぴぷぺぽ', from: 'h', to: 'p', handakuten: true },
];

/** The three voiced kana whose reading does not follow its row's consonant. */
const VOICED_EXCEPTIONS: Record<string, string> = {
  じ: '*し* with two dashes is *じ* — the s softens all the way to *ji*, not zi.',
  ぢ: '*ち* with two dashes is *ぢ* — said *ji*, same as じ, and far rarer.',
  づ: '*つ* with two dashes is *づ* — said *zu*, same as ず, and far rarer.',
};

// ── Yōon: the construction ──────────────────────────────────────────────────

const SMALL_NAMES: Record<string, string> = { ゃ: 'ゃ', ゅ: 'ゅ', ょ: 'ょ' };

function build(): Record<string, Mnemonic> {
  const out: Record<string, Mnemonic> = { ...BASIC };

  for (const row of VOICED_ROWS) {
    const plain = [...row.plain];
    const voiced = [...row.voiced];
    voiced.forEach((char, index) => {
      const mark = row.handakuten ? 'a small circle' : 'two dashes';
      out[char] = {
        hint:
          VOICED_EXCEPTIONS[char] ??
          `*${plain[index]}* with ${mark} is *${char}* — the mark turns *${row.from}* into *${row.to}*.`,
      };
    });
  }

  for (const entry of KANA) {
    if (entry.group !== 'combo') continue;
    const [base, small] = [...entry.kana];
    out[entry.kana] = {
      hint: `*${base}* plus a small *${SMALL_NAMES[small] ?? small}*, said as one beat — *${entry.romaji}*.`,
    };
  }

  return out;
}

export const MNEMONICS: Record<string, Mnemonic> = build();

export function mnemonicFor(kana: string): Mnemonic | undefined {
  return MNEMONICS[kana];
}
