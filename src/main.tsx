import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Strict Enterprise Requirement: Purge & Disable Browser LocalStorage and SessionStorage completely
if (typeof window !== 'undefined') {
  try {
    if (window.localStorage) {
      window.localStorage.clear();
      window.localStorage.setItem = () => {};
    }
    if (window.sessionStorage) {
      window.sessionStorage.clear();
      window.sessionStorage.setItem = () => {};
    }
  } catch (e) {
    console.warn("Could not access or clear browser storage:", e);
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

