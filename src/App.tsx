import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import Header from './components/Header';
import Home from './components/Home';
import Chart from './components/Chart';
import QuizSetup from './components/QuizSetup';
import QuizRunner from './components/QuizRunner';
import Results from './components/Results';

import { createQuiz, createQuizFrom } from './lib/quiz';
import type { Quiz, QuizConfig, QuizSummary } from './lib/quiz';
import { loadStore, recordSession, resetProgress, saveConfig } from './lib/storage';
import type { Store } from './lib/storage';
import { useTheme } from './lib/useTheme';

import styles from './App.module.css';

export type View = 'home' | 'chart' | 'setup' | 'quiz' | 'results';

const DEFAULT_CONFIG: QuizConfig = { groups: ['basic'], mode: 'type', length: 20 };

function sanitizeConfig(config: QuizConfig | null): QuizConfig {
  if (!config || !Array.isArray(config.groups) || config.groups.length === 0) {
    return DEFAULT_CONFIG;
  }
  return config;
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
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [view]);

  const start = useCallback((next: QuizConfig) => {
    setConfig(next);
    saveConfig(next);
    setQuiz(createQuiz(next));
    setSummary(null);
    setView('quiz');
  }, []);

  const finish = useCallback(
    (result: QuizSummary) => {
      setSummary(result);
      setStore(recordSession(result, config));
      setView('results');
    },
    [config],
  );

  const practiseMissed = useCallback(() => {
    if (!summary?.missed.length) return;
    setQuiz(
      createQuizFrom(
        summary.missed.map((outcome) => outcome.kana),
        config,
      ),
    );
    setSummary(null);
    setView('quiz');
  }, [summary, config]);

  const repeat = useCallback(() => {
    setQuiz(createQuiz(config));
    setSummary(null);
    setView('quiz');
  }, [config]);

  const isQuiz = view === 'quiz';

  return (
    <div className={styles.app}>
      {!isQuiz && (
        <Header view={view} theme={theme} onToggleTheme={toggleTheme} onNavigate={setView} />
      )}

      <main className={styles.main} data-focus={isQuiz}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
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
                onResetProgress={() => setStore(resetProgress())}
              />
            )}

            {view === 'chart' && <Chart store={store} onStartQuiz={() => setView('setup')} />}

            {view === 'setup' && (
              <QuizSetup initial={config} onStart={start} onCancel={() => setView('home')} />
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
