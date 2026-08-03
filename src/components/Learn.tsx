import { useMemo } from 'react';
import { motion } from 'motion/react';

import {
  BLOCK_META,
  LESSONS,
  completedCount,
  isLessonComplete,
  nextLesson,
} from '../lib/lessons';
import type { Lesson, LessonBlock } from '../lib/lessons';
import type { Store } from '../lib/storage';
import { percent } from '../lib/util';
import { ArrowRightIcon, CheckIcon } from './icons';

import styles from './Learn.module.css';

interface LearnProps {
  store: Store;
  onOpenLesson: (id: string) => void;
}

const BLOCK_ORDER: LessonBlock[] = ['basic', 'rules', 'dakuten', 'yoon'];

export default function Learn({ store, onOpenLesson }: LearnProps) {
  const next = useMemo(() => nextLesson(store), [store]);
  const done = completedCount(store);

  return (
    <div className={styles.learn}>
      <div className={styles.head}>
        <div>
          <span className="jp-caption">ひらがな</span>
          <h1 className={styles.title}>Learn it five at a time</h1>
          <p className={styles.lede}>
            Twenty short lessons, following the rows of the chart. Each one introduces a handful of
            characters, drills them, then mixes them back in with everything before. Nothing is
            locked — this is an order, not a gate.
          </p>
        </div>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressTrack}>
          <motion.div
            className={styles.progressFill}
            initial={{ width: 0 }}
            animate={{ width: `${percent(done, LESSONS.length)}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <span className={styles.progressLabel}>
          {done} of {LESSONS.length} finished
        </span>
      </div>

      {BLOCK_ORDER.map((block) => {
        const lessons = LESSONS.filter((entry) => entry.block === block);
        if (lessons.length === 0) return null;
        return (
          <section key={block} className={styles.block}>
            <div className={styles.blockHead}>
              <h2 className={styles.blockTitle}>{BLOCK_META[block].label}</h2>
              <span className={styles.blockHint}>{BLOCK_META[block].hint}</span>
            </div>
            <div className={styles.list}>
              {lessons.map((entry) => (
                <LessonRow
                  key={entry.id}
                  lesson={entry}
                  number={LESSONS.indexOf(entry) + 1}
                  complete={isLessonComplete(store, entry)}
                  accuracy={store.lessons[entry.id]?.accuracy}
                  isNext={next?.id === entry.id}
                  onOpen={() => onOpenLesson(entry.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

interface LessonRowProps {
  lesson: Lesson;
  number: number;
  complete: boolean;
  accuracy?: number;
  isNext: boolean;
  onOpen: () => void;
}

function LessonRow({ lesson, number, complete, accuracy, isNext, onOpen }: LessonRowProps) {
  return (
    <motion.button
      className={`${styles.row} card`}
      data-state={complete ? 'complete' : isNext ? 'next' : undefined}
      onClick={onOpen}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.995 }}
    >
      <span className={styles.marker} data-state={complete ? 'complete' : undefined}>
        {complete ? <CheckIcon size={15} /> : number}
      </span>

      <span className={styles.body}>
        <span className={styles.rowTitleLine}>
          <span className={styles.rowTitle}>{lesson.title}</span>
          <span className={`${styles.rowJapanese} kana-glyph`}>{lesson.japanese}</span>
          {isNext && <span className={styles.nextTag}>Next up</span>}
        </span>
        <span className={styles.rowSub}>{lesson.subtitle}</span>
        {lesson.chars.length > 0 && (
          <span className={`${styles.chars} kana-glyph`}>{lesson.chars.join(' ')}</span>
        )}
      </span>

      <span className={styles.trail}>
        {complete && accuracy !== undefined ? (
          <span className={styles.score}>{accuracy}%</span>
        ) : (
          <ArrowRightIcon size={16} />
        )}
      </span>
    </motion.button>
  );
}
