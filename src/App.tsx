import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import Header from './components/Header';
import Home from './components/Home';
import Chart from './components/Chart';
import Learn from './components/Learn';
import LessonView from './components/Lesson';
import QuizSetup from './components/QuizSetup';
import QuizRunner from './components/QuizRunner';
import Results from './components/Results';

import { KANA_BY_CHAR } from './data/hiragana';
import type { Kana } from './data/hiragana';
import { WORDS_BY_TEXT } from './data/words';
import type { Word } from './data/words';
import {
  createMixedQuiz,
  createQuiz,
  createSprintQuiz,
  createWordQuiz,
} from './lib/quiz';
import type { Drill, Quiz, QuizConfig, QuizSummary } from './lib/quiz';
import { createReviewQuiz } from './lib/review';
import { LESSONS, LESSON_BY_ID, lessonIndex, nextLesson } from './lib/lessons';
import {
  completeLesson,
  loadStore,
  metCharacters,
  recordSession,
  resetProgress,
  saveConfig,
} from './lib/storage';
import type { Store } from './lib/storage';
import { useTheme } from './lib/useTheme';

import styles from './App.module.css';

export type View = 'home' | 'learn' | 'lesson' | 'chart' | 'setup' | 'quiz' | 'results';

const DEFAULT_CONFIG: QuizConfig = {
  groups: ['basic'],
  mode: 'type',
  length: 'all',
  drill: 'characters',
};

/**
 * A config saved before the practice screen had more than one kind of round has
 * no `drill`. Defaulting it here is what lets an existing install pick up where
 * it left off instead of starting a round with `undefined` in it.
 */
function sanitizeConfig(config: QuizConfig | null): QuizConfig {
  if (!config || !Array.isArray(config.groups) || config.groups.length === 0) {
    return DEFAULT_CONFIG;
  }
  return { ...config, drill: config.drill ?? 'characters' };
}

function buildQuiz(config: QuizConfig, store: Store): Quiz {
  switch (config.drill) {
    case 'words':
      return createWordQuiz(config, config.wordsKnownOnly ? metCharacters(store) : undefined);
    case 'speed':
      return createSprintQuiz(config);
    case 'review':
      return createReviewQuiz(store, config);
    default:
      return createQuiz(config);
  }
}

/** The manifest's shortcuts and any shared link arrive as `?go=`. */
function readDeepLink(): string | null {
  const go = new URLSearchParams(window.location.search).get('go');
  if (!go) return null;
  const url = new URL(window.location.href);
  url.searchParams.delete('go');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
  return go;
}

const pageTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export default function App() {
  const [theme, toggleTheme] = useTheme();
  const [store, setStore] = useState<Store>(loadStore);
  const [config, setConfig] = useState<QuizConfig>(() => sanitizeConfig(store.config));
  const [view, setView] = useState<View>('home');
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [lessonRunning, setLessonRunning] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const start = useCallback(
    (next: QuizConfig) => {
      setConfig(next);
      saveConfig(next);
      setQuiz(buildQuiz(next, store));
      setSummary(null);
      setView('quiz');
    },
    [store],
  );

  /** Straight into a round of one kind, keeping everything else as it was. */
  const quickDrill = useCallback(
    (drill: Drill) =>
      start({
        ...config,
        drill,
        // "Everything" is a reasonable default over 46 characters and an
        // unreasonable one over three hundred words.
        length: drill === 'words' && config.length === 'all' ? 20 : config.length,
      }),
    [config, start],
  );

  const openLesson = useCallback((id: string) => {
    setLessonId(id);
    setLessonRunning(false);
    setView('lesson');
  }, []);

  // Manifest shortcuts, read once and then wiped from the address bar so that a
  // reload does not silently restart the same round.
  useEffect(() => {
    const go = readDeepLink();
    if (!go) return;
    if (go === 'learn') {
      const next = nextLesson(store);
      if (next) openLesson(next.id);
      else setView('learn');
      return;
    }
    if (go === 'review' || go === 'speed') quickDrill(go);
    // Deliberately mount-only: this is a one-shot reading of the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordRound = useCallback((result: QuizSummary, used: QuizConfig) => {
    setStore(recordSession(result, used));
  }, []);

  const finish = useCallback(
    (result: QuizSummary) => {
      setSummary(result);
      recordRound(result, config);
      setView('results');
    },
    [config, recordRound],
  );

  const practiseMissed = useCallback(() => {
    if (!summary?.missed.length) return;
    const kana: Kana[] = [];
    const words: Word[] = [];
    for (const outcome of summary.missed) {
      if (outcome.kind === 'word') {
        const word = WORDS_BY_TEXT.get(outcome.id);
        if (word) words.push(word);
      } else {
        const entry = KANA_BY_CHAR.get(outcome.id);
        if (entry) kana.push(entry);
      }
    }
    setQuiz(createMixedQuiz(kana, words, config));
    setSummary(null);
    setView('quiz');
  }, [summary, config]);

  const repeat = useCallback(() => {
    setQuiz(buildQuiz(config, store));
    setSummary(null);
    setView('quiz');
  }, [config, store]);

  const lesson = lessonId ? (LESSON_BY_ID.get(lessonId) ?? null) : null;
  const index = lesson ? lessonIndex(lesson.id) : -1;
  const following = index >= 0 ? (LESSONS[index + 1] ?? null) : null;

  const focused = view === 'quiz' || (view === 'lesson' && lessonRunning);

  return (
    <div className={styles.app}>
      {!focused && (
        <Header view={view} theme={theme} onToggleTheme={toggleTheme} onNavigate={setView} />
      )}

      <main className={styles.main} data-focus={focused}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view === 'lesson' ? `lesson-${lessonId}` : view}
            className={styles.page}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={pageTransition}
          >
            {view === 'home' && (
              <Home
                store={store}
                onNavigate={setView}
                onOpenLesson={openLesson}
                onQuickDrill={quickDrill}
                onResetProgress={() => setStore(resetProgress())}
              />
            )}

            {view === 'learn' && <Learn store={store} onOpenLesson={openLesson} />}

            {view === 'lesson' && lesson && (
              <LessonView
                lesson={lesson}
                index={index}
                nextTitle={following?.title ?? null}
                onRunningChange={setLessonRunning}
                onFinishRound={recordRound}
                onComplete={(accuracy) => setStore(completeLesson(lesson.id, accuracy))}
                onExit={() => setView('learn')}
                onNext={() => following && openLesson(following.id)}
              />
            )}

            {view === 'chart' && <Chart store={store} onStartQuiz={() => setView('setup')} />}

            {view === 'setup' && (
              <QuizSetup
                initial={config}
                store={store}
                onStart={start}
                onCancel={() => setView('home')}
              />
            )}

            {view === 'quiz' && quiz && (
              <QuizRunner quiz={quiz} onFinish={finish} onExit={() => setView('setup')} />
            )}

            {view === 'results' && summary && (
              <Results
                summary={summary}
                config={config}
                onPractiseMissed={practiseMissed}
                onRepeat={repeat}
                onChangeSettings={() => setView('setup')}
                onHome={() => setView('home')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
