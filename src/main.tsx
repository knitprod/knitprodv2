import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { GlobalDataProvider } from './context/GlobalDataContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Purge any legacy sensitive auth tokens, session keys, or backend URLs from browser storage
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('active_user_session');
    localStorage.removeItem('active_user_session');
    sessionStorage.removeItem('active_user_credentials');
    localStorage.removeItem('active_user_credentials');
    localStorage.removeItem('gas_web_app_url');
    localStorage.removeItem('supabase_url');
    localStorage.removeItem('supabase_anon_key');
    sessionStorage.removeItem('supabase_url');
    sessionStorage.removeItem('supabase_anon_key');
    // Ensure credentials and session tokens are NEVER stored in persistent localStorage
    localStorage.removeItem('ekl_session_uid');
    localStorage.removeItem('active_current_page');
  } catch (e) {
    // Ignore storage access restrictions if any
  }

  // Gracefully handle any browser clipboard permission rejections
  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    const name = event.reason?.name || '';
    if (
      name === 'NotAllowedError' ||
      msg.includes('Clipboard') ||
      msg.includes('write') ||
      msg.includes('permission denied')
    ) {
      console.warn('Prevented unhandled clipboard permission rejection:', msg);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <GlobalDataProvider>
        <App />
      </GlobalDataProvider>
    </ErrorBoundary>
  </StrictMode>,
);



