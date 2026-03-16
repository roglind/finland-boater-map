import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import DataViewer from './pages/DataViewer';
import './index.css';

const rootEl = document.getElementById('root');
if (rootEl) {
  const params = new URLSearchParams(window.location.search);
  const viewer = params.get('viewer');

  ReactDOM.createRoot(rootEl).render(
    viewer === 'areas' || viewer === 'signs'
      ? <DataViewer type={viewer} />
      : (
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      )
  );
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker.register(swUrl).then((registration) => {
      registration.update().catch(() => {
        // ignore update errors
      });
    }).catch(() => {
      // Silent fail for development
    });
  });
}