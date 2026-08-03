import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';

import App from './App';
import './index.css';
import './styles/ui.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container missing');

createRoot(container).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);

// Production only, so the dev server's hot reloading is never served a cached
// module. Registered relative to the document so that a build deployed under a
// sub-path finds its own worker. Deliberately no reload prompt and no automatic
// refresh: a new version taking the page out from under someone mid-round would
// be worse than a version-old page, and the next launch picks it up anyway.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI)).catch(() => {
      // Blocked by the browser, an unsupported context, or a private window.
      // Offline support is a bonus; the app works exactly as before without it.
    });
  });
}
