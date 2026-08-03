import { Fragment, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import { CHART_SECTIONS, KANA, getKana } from '../data/hiragana';
import type { ChartSection, Kana, KanaGroup } from '../data/hiragana';
import { WORDS, charsRequiredFor } from '../data/words';
import type { Word } from '../data/words';
import { MASTERY_LABEL, masteryOf } from '../lib/storage';
import type { Mastery, Store } from '../lib/storage';
import { teachableAlternates } from '../lib/romaji';
import { ArrowLeftIcon, ArrowRightIcon, CrossIcon, TargetIcon } from './icons';
import Mnemonic from './Mnemonic';

import styles from './Chart.module.css';

/**
 * Words in the drill pool that use this character, shortest first so the list
 * reads as "here is where you will meet it" rather than as a dictionary.
 */
const WORDS_USING = new Map<string, Word[]>();
for (const entry of WORDS) {
  for (const char of new Set(charsRequiredFor(entry.word))) {
    const list = WORDS_USING.get(char);
    if (list) list.push(entry);
    else WORDS_USING.set(char, [entry]);
  }
}
for (const list of WORDS_USING.values()) {
  list.sort((a, b) => a.tier - b.tier || a.word.length - b.word.length);
}

interface ChartProps {
  store: Store;
  onStartQuiz: () => void;
}

/** How the three tables stack into columns on wide screens. */
const SECTION_COLUMNS: KanaGroup[][] = [['basic'], ['dakuten', 'combo']];

const MASTERY_COLOR: Record<Mastery, string | null> = {
  new: null,
  learning: 'var(--seal)',
  familiar: 'var(--accent)',
  mastered: 'var(--success)',
};

export default function Chart({ store, onStartQuiz }: ChartProps) {
  const [showRomaji, setShowRomaji] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const step = useCallback((delta: number) => {
    setSelected((current) => {
      if (!current) return current;
      const index = KANA.findIndex((entry) => entry.kana === current);
      if (index < 0) return current;
      return KANA[(index + delta + KANA.length) % KANA.length].kana;
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'ArrowRight') step(1);
      if (event.key === 'ArrowLeft') step(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected, step]);

  return (
    <div className={styles.chart}>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>The hiragana chart</h1>
          <p className={styles.lede}>
            All {KANA.length} characters, grouped the way they are taught. Tap any character for its
            reading, a way to remember the shape, and words that use it.
          </p>
        </div>

        <div className={styles.toggle} role="group" aria-label="Chart display">
          {[
            { id: true, label: 'With rōmaji' },
            { id: false, label: 'Kana only' },
          ].map((option) => (
            <button
              key={String(option.id)}
              className={styles.toggleOption}
              data-active={showRomaji === option.id}
              aria-pressed={showRomaji === option.id}
              onClick={() => setShowRomaji(option.id)}
            >
              {showRomaji === option.id && (
                <motion.span
                  layoutId="chart-toggle-pill"
                  className={styles.togglePill}
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                />
              )}
              <span className={styles.toggleText}>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.sections}>
        {SECTION_COLUMNS.map((column, columnIndex) => (
          <div key={columnIndex} className={styles.column}>
            {column.map((sectionId, sectionIndex) => {
              const section = CHART_SECTIONS.find((entry) => entry.id === sectionId);
              if (!section) return null;
              return (
                <Section
                  key={section.id}
                  section={section}
                  store={store}
                  showRomaji={showRomaji}
                  baseDelay={(columnIndex + sectionIndex) * 0.05}
                  onSelect={setSelected}
                />
              );
            })}
          </div>
        ))}
      </div>

      <p className={styles.footnote}>
        Characters marked <span aria-hidden="true">◦</span> are rare in modern Japanese — worth
        recognising, not worth worrying about. じ/ぢ and ず/づ share a reading; either spelling is
        accepted in the quiz.
      </p>

      <div className={styles.cta}>
        <button className="btn btn--primary btn--lg" onClick={onStartQuiz}>
          <TargetIcon size={17} />
          Quiz yourself on these
        </button>
      </div>

      <AnimatePresence>
        {selected && (
          <KanaSheet
            kana={getKana(selected)}
            store={store}
            onClose={() => setSelected(null)}
            onStep={step}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface SectionProps {
  section: ChartSection;
  store: Store;
  showRomaji: boolean;
  baseDelay: number;
  onSelect: (kana: string) => void;
}

function Section({ section, store, showRomaji, baseDelay, onSelect }: SectionProps) {
  const columns = section.columns.length;
  const gridStyle = {
    gridTemplateColumns: `1.6rem repeat(${columns}, minmax(0, 1fr))`,
    maxWidth: `calc(${columns} * 4.9rem + 1.6rem)`,
  };
  let cellIndex = 0;

  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{section.title}</h2>
        <span className="jp-caption">{section.japanese}</span>
        <p className={styles.sectionSub}>{section.subtitle}</p>
      </div>

      <div className={styles.grid} style={gridStyle}>
        <span aria-hidden="true" />
        {section.columns.map((column) => (
          <span key={column} className={styles.columnHead}>
            {column}
          </span>
        ))}

        {section.rows.map((row, rowIndex) => (
          <Fragment key={`${section.id}-${rowIndex}`}>
            <span className={styles.rowHead}>{row.label || ' '}</span>
            {row.cells.map((char, columnIndex) => {
              if (!char) {
                return (
                  <span
                    key={`${section.id}-${rowIndex}-${columnIndex}`}
                    className={styles.empty}
                    aria-hidden="true"
                  />
                );
              }
              const delay = baseDelay + cellIndex * 0.007;
              cellIndex += 1;
              return (
                <ChartCell
                  key={char}
                  kana={getKana(char)}
                  mastery={masteryOf(store.progress[char])}
                  showRomaji={showRomaji}
                  delay={delay}
                  onSelect={onSelect}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

interface ChartCellProps {
  kana: Kana;
  mastery: Mastery;
  showRomaji: boolean;
  delay: number;
  onSelect: (kana: string) => void;
}

function ChartCell({ kana, mastery, showRomaji, delay, onSelect }: ChartCellProps) {
  const color = MASTERY_COLOR[mastery];
  return (
    <motion.button
      className={styles.cell}
      onClick={() => onSelect(kana.kana)}
      aria-label={`${kana.kana}, ${kana.romaji}${mastery === 'new' ? '' : ` — ${MASTERY_LABEL[mastery]}`}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1], delay }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94 }}
    >
      {kana.rare && (
        <span className={styles.cellRare} aria-hidden="true">
          ◦
        </span>
      )}
      {color && (
        <span className={styles.masteryDot} style={{ background: color }} aria-hidden="true" />
      )}
      <span
        className={`${styles.cellGlyph} ${[...kana.kana].length > 1 ? styles.cellGlyphWide : ''} kana-glyph`}
      >
        {kana.kana}
      </span>
      {showRomaji && <span className={styles.cellRomaji}>{kana.romaji}</span>}
    </motion.button>
  );
}

interface KanaSheetProps {
  kana: Kana;
  store: Store;
  onClose: () => void;
  onStep: (delta: number) => void;
}

function KanaSheet({ kana, store, onClose, onStep }: KanaSheetProps) {
  const mastery = masteryOf(store.progress[kana.kana]);
  const alternates = teachableAlternates(kana);
  const index = KANA.findIndex((entry) => entry.kana === kana.kana);
  const previous = KANA[(index - 1 + KANA.length) % KANA.length];
  const next = KANA[(index + 1) % KANA.length];
  const words = (WORDS_USING.get(kana.kana) ?? []).slice(0, 4);

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
    >
      <motion.div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${kana.kana} — ${kana.romaji}`}
        initial={{ opacity: 0, y: 40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.grabber} aria-hidden="true" />
        <button className={styles.sheetClose} onClick={onClose} aria-label="Close">
          <CrossIcon size={16} />
        </button>

        <div className={styles.sheetMain}>
          <motion.span
            key={kana.kana}
            className={`${styles.sheetGlyph} ${
              [...kana.kana].length > 1 ? styles.sheetGlyphWide : ''
            } kana-glyph`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            {kana.kana}
          </motion.span>
          <div className={styles.sheetInfo}>
            <span className={styles.sheetRomaji}>{kana.romaji}</span>
            {alternates.length > 0 && (
              <span className={styles.sheetAlt}>also written {alternates.join(', ')}</span>
            )}
            <span className={styles.sheetBadge}>{MASTERY_LABEL[mastery]}</span>
          </div>
        </div>

        <Mnemonic kana={kana.kana} className={styles.sheetMnemonic} />

        <div className={styles.example}>
          <div className={styles.exampleWord}>{kana.example.word}</div>
          <div className={styles.exampleMeta}>
            {kana.example.romaji} — {kana.example.meaning}
          </div>
        </div>

        {words.length > 0 && (
          <div className={styles.wordList}>
            <span className={styles.wordListHead}>Words using {kana.kana}</span>
            {words.map((entry) => (
              <div key={entry.word} className={styles.wordRow}>
                <span className={`${styles.wordText} kana-glyph`}>{entry.word}</span>
                <span className={styles.wordMeta}>
                  {entry.romaji} — {entry.meaning}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.sheetNav}>
          <button className={styles.navBtn} onClick={() => onStep(-1)}>
            <ArrowLeftIcon size={15} />
            <span className={styles.navGlyph}>{previous.kana}</span>
          </button>
          <button className={styles.navBtn} onClick={() => onStep(1)}>
            <span className={styles.navGlyph}>{next.kana}</span>
            <ArrowRightIcon size={15} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
