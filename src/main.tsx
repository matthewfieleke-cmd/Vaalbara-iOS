import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// PWA service worker — enables offline play once cached.
// The iOS app already serves an immutable local bundle through a custom URL
// scheme; service workers are unnecessary and unreliable in that environment.
if (
  'serviceWorker' in navigator
  && !import.meta.env.DEV
  && (window.location.protocol === 'https:' || window.location.protocol === 'http:')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline caching is a progressive enhancement */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
