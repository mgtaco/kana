# Kana

A web app for learning hiragana, the phonetic Japanese syllabary. Twenty guided
lessons take you through all 104 characters five at a time, with a reference
chart to look things up in and four drills to practise with once you have met
them.

It installs to a phone or desktop home screen and works offline.

Katakana, kanji and stroke-order practice are deliberately out of scope.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production bundle
npm run typecheck  # types only
```

The build uses a relative `base`, so `dist/` can be served from any path —
a GitHub Pages project site, an S3 prefix, or the domain root.

## What it does

### Lessons

Twenty short lessons, following the rows of the chart: ten for the 46 basic
characters, one for the reading rules, five for the dakuten rows, four for the
yōon. Each one runs **Meet → Drill → Review**.

**Meet** is one card per character — the glyph, its reading, a mnemonic with a
picture to hang it on, and a word that uses it. Swipe or use the arrow keys.

**Drill** is the existing quiz over just those characters, mixing both
directions.

**Review** mixes them back in with everything from earlier lessons, plus a few
real words once enough of them have become readable. It can be skipped.

Nothing is locked. The list is an order, not a gate: home points at the next
lesson you have not finished, and you can start anywhere.

### The chart

All 104 characters laid out the way they are taught: gojūon (46 basic),
dakuten and handakuten (25 voiced), and yōon (33 contracted). Tap any character
for its reading, alternative romanisations, a mnemonic, an example word, and
the words in the drill pool that use it. On wide screens the three tables sit
side by side; on phones they stack, and every cell stays a comfortable tap
target.

A **Kana only** toggle hides the readings so the chart itself can be used to
self-test, and each cell carries a small dot showing how well you know that
character based on your history.

### Mnemonics

Every character has a one-line hook. The 46 basic ones are images — き is a key,
ぬ is noodles round a pair of chopsticks, ふ is a fool hula-hooping — because
there is a new shape to remember. The 25 dakuten characters get the rule
instead (`か with two dashes is が — the mark turns k into g`) and the 33 yōon
get the construction (`き plus a small ゃ, said as one beat — kya`), because for
those the shape is already known and an invented picture would be one more
thing to carry.

They turn up where they help: on the lesson cards, in the chart's detail sheet,
after a wrong or skipped answer in a round, and beside every miss on the
results screen.

### Practice

Four kinds of round:

- **Characters** — one character at a time, from the sets you choose. Type the
  reading, pick the character from six, or mix the two.
- **Words** — read a whole word: type its rōmaji, or pick its meaning from
  four. Restricted by default to words spelled entirely from characters you
  have already met.
- **Speed run** — 30, 60 or 120 seconds, as many as you can. No second looks.
- **Review** — weighted towards whatever you are weakest and coldest on, and it
  pulls in the other shaky members of a look-alike set so a pair you are
  confusing turns up in the same round.

Answering resolves inside the question card itself: the prompt slides aside and
the answer slides out from behind it, tinted green when you were right and red
when you weren't. There is also an **I don't know** button — pressing it reveals
the answer in amber rather than red. A skip counts as a miss for scheduling and
scoring, but the results screen reports it as skipped rather than as a wrong
guess.

**Anything you get wrong comes back once.** A missed subject goes to the back
of the queue, so a round works through everything first and then replays the
misses in the order they happened. That second look is the last one: nothing is
ever queued a third time, so a round always terminates. The speed run is the
exception — it ends on the clock, and queues nothing.

### Reading words

Grading a whole word takes more than a table lookup, because three rules act
across character boundaries and each has more than one accepted spelling:

- **っ** doubles the consonant after it — きって is `kitte`, and ち accepts both
  `tchi` and `cchi`.
- **ん** is `n`, `nn`, or `m` before b, m and p — しんぶん is both `shinbun` and
  `shimbun`.
- **Long vowels** are written every which way — がっこう is `gakkou`, `gakkoo`,
  `gakkō` or `gakko`.

So a word has a *set* of accepted spellings, built from each character's own
alternates, which means Kunrei-shiki keeps working inside a word for free:
`zyagaimo` is accepted for じゃがいも exactly as `zya` is for じゃ on its own.
There is no test runner here, so `src/lib/kanaText.ts` checks itself in
development: every stored reading in the word list must be one the reader would
accept, and it warns in the console about any that isn't.

### Results and progress

Each round ends with first-try accuracy, best streak, total and per-answer
time, everything you missed alongside what you actually answered, its mnemonic,
and whether you got it right when it came back. From there you can drill just
the ones you missed, run another round with the same settings, or change them.

Progress is kept in `localStorage`: per-character and per-word accuracy, a
mastery level derived from it, finished lessons, and a history of recent
rounds. Reading a word correctly also credits every character in it; reading it
wrong blames none of them, because one typo in a five-character word should not
drag five mastery scores down. Nothing leaves the browser, and it can all be
cleared from the home screen.

Home has two faces, chosen from the store rather than from a flag. On a first
visit it introduces the app and points at lesson 1. After that it is a
dashboard — streak, characters due, mastered count, a Continue card for the
next lesson, and a grid of quick actions. Resetting progress brings the
introduction back.

## Installing it

There is a web manifest, a hand-written service worker, and a set of PNG icons,
so the app can be installed from Chrome's omnibox or added to an iOS home
screen and will then launch standalone and run offline. The manifest carries
shortcuts for Continue learning, Review and Speed run, which arrive as `?go=`
on the URL and are cleared from the address bar once read.

The service worker takes navigations network-first, so a new deploy never
serves stale HTML pointing at assets that have been replaced; hashed assets and
web fonts are cache-first. It never reloads the page out from under you — a new
version is picked up on the next launch.

Icons are generated by hand from `tools/icon.html` with a headless Chromium and
committed; the command is in a comment at the top of that file.

## Notes on the build

- **React 19 + TypeScript + Vite**, with [Motion](https://motion.dev) for
  transitions. No UI framework — styling is plain CSS with custom properties
  and CSS Modules.
- **Theming** uses `light-dark()` against a single set of tokens in
  `src/index.css`, so both palettes are defined once and the toggle only flips
  `color-scheme`. The saved preference is applied by an inline script in
  `index.html` before first paint.
- **Motion respects `prefers-reduced-motion`** via `<MotionConfig
  reducedMotion="user">`, and CSS transitions are neutralised by a media query.
- **Keyboard-first on desktop**: Enter checks and advances, `1`–`6` answer a
  multiple-choice question, the arrow keys page through a lesson's cards, and
  Escape ends a round or closes a dialog.
- **Offline** via a hand-written `public/sw.js`, ~70 lines and no Workbox, in
  keeping with a project that has three runtime dependencies.

### Layout

```
src/
  data/hiragana.ts     the syllabary, chart layout, example words
  data/mnemonics.ts    one hook per character
  data/words.ts        the word pool for the reading drill
  lib/quiz.ts          queue construction, re-queue rule, distractors, scoring
  lib/kanaText.ts      splitting a word, and every reading it accepts
  lib/lessons.ts       the twenty lessons and what each one covers
  lib/review.ts        which characters want another look, and why
  lib/romaji.ts        answer normalisation and accepted spellings
  lib/storage.ts       localStorage progress, lessons, mastery levels
  lib/useTheme.ts      light/dark preference
  components/          one component + CSS module per screen
public/
  sw.js                the service worker
  manifest.webmanifest
tools/icon.html        the icon source, rasterised by hand
```

The quiz runs on a small reducer in `QuizRunner.tsx`: the queue is a list of
questions, answering pushes a record and either resolves the subject or
schedules its one retry, and the round ends when the queue empties — or, in a
speed run, when the clock does.

A question is a discriminated union of a character and a word, and answers and
outcomes carry a flattened `Subject` rather than either, so scoring, results and
storage do not each need to know how to unwrap one. That is what lets a single
round mix characters and words, which is what a lesson's review phase is.

## Credits

Kana are rendered in [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)
where available, falling back to the platform's Japanese UI font.
