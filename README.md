# Kana

A web app for learning hiragana, the phonetic Japanese syllabary. It has two
parts: a reference chart of all 104 characters, and a quiz that drills them in
both directions.

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

### The chart

All 104 characters laid out the way they are taught: gojūon (46 basic),
dakuten and handakuten (25 voiced), and yōon (33 contracted). Tap any
character for its reading, alternative romanisations, and an example word with
its meaning. On wide screens the three tables sit side by side; on phones they
stack, and every cell stays a comfortable tap target.

A **Kana only** toggle hides the readings so the chart itself can be used to
self-test, and each cell carries a small dot showing how well you know that
character based on your quiz history.

### The quiz

Two directions, plus a mode that mixes them:

- **Type the reading** — the character fills the screen, you type its rōmaji.
- **Pick the character** — you see a reading and choose from six characters.

Choose which sets to include (basic / dakuten / combos) and how long the round
is — 10, 20, 40, or everything in the selection, which is the default.

Answering resolves inside the question card itself: the prompt slides aside and
the answer slides out from behind it, tinted green when you were right and red
when you weren't. There is also an **I don't know** button — pressing it reveals
the answer in amber rather than red. A skip counts as a miss for scheduling and
scoring, but the results screen reports it as skipped rather than as a wrong
guess.

**Anything you get wrong comes back once.** A missed character goes to the back
of the queue, so a round works through every character first and then replays
the misses in the order they happened. That second look is the last one: a
character is never queued a third time, so a round always terminates.

Answers are graded generously. Kunrei-shiki and wāpuro spellings both count —
`si` for し, `tu` for つ, `zya` for じゃ, `nn` for ん — and homophone pairs like
じ/ぢ accept either reading. In multiple choice, distractors are drawn first
from characters that genuinely look alike (ぬ め ね わ れ, さ ち き ら, る ろ ふ …)
so the question tests recognition rather than elimination.

### Results

Each round ends with first-try accuracy, best streak, total and per-answer
time, every character you missed alongside what you actually answered (or that
you skipped it), and whether you got it right when it came back. From there you can drill just the
ones you missed, run another round with the same settings, or change them.

Progress is kept in `localStorage`: per-character accuracy, a mastery level
derived from it, and a history of recent rounds. Nothing leaves the browser,
and it can be cleared from the home screen.

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
  multiple-choice question, Escape ends a round or closes a dialog.

### Layout

```
src/
  data/hiragana.ts     the syllabary, chart layout, example words
  lib/quiz.ts          queue construction, re-queue rule, distractors, scoring
  lib/romaji.ts        answer normalisation and accepted spellings
  lib/storage.ts       localStorage progress and mastery levels
  lib/useTheme.ts      light/dark preference
  components/          one component + CSS module per screen
```

The quiz runs on a small reducer in `QuizRunner.tsx`: the queue is a list of
questions, answering pushes a record and either resolves the character or
schedules its one retry, and the round ends when the queue empties.

## Credits

Kana are rendered in [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)
where available, falling back to the platform's Japanese UI font.
