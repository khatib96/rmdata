import './api/browserApiPolyfill';
import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  const d = document.createElement('div');
  d.style.cssText = 'padding:2rem;font-family:sans-serif';
  const h = document.createElement('h1');
  h.textContent = 'خطأ: عنصر #root غير موجود';
  d.appendChild(h);
  document.body.appendChild(d);
} else {
  try {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('React mount error:', err);
    rootEl.textContent = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:2rem;font-family:sans-serif;direction:rtl';
    const h1 = document.createElement('h1');
    h1.textContent = 'خطأ في تحميل التطبيق';
    const pre = document.createElement('pre');
    pre.style.cssText = 'background:#f0f0f0;padding:1rem;overflow:auto';
    pre.textContent = msg;
    const p = document.createElement('p');
    p.textContent = 'تحقق من Console للأخطاء (F12)';
    wrap.appendChild(h1);
    wrap.appendChild(pre);
    wrap.appendChild(p);
    rootEl.appendChild(wrap);
  }
}
