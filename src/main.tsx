import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { GlobalDataProvider } from './context/GlobalDataContext';
import './index.css';

// Purge any legacy sensitive auth tokens, session keys, or backend URLs from browser storage
if (typeof window !== 'undefined') {
  try {
    sessionStorage.removeItem('active_user_session');
    localStorage.removeItem('active_user_session');
    sessionStorage.removeItem('active_user_credentials');
    localStorage.removeItem('active_user_credentials');
    localStorage.removeItem('gas_web_app_url');
  } catch (e) {
    // Ignore storage access restrictions if any
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalDataProvider>
      <App />
    </GlobalDataProvider>
  </StrictMode>,
);



