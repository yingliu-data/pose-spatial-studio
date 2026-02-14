import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Global error handlers for diagnosing frontend crashes
window.addEventListener('error', (e) => {
  console.error('[GLOBAL] Uncaught error:', e.error?.message || e.message, e.filename, e.lineno);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[GLOBAL] Unhandled promise rejection:', e.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

