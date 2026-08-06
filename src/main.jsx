import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { routerBasename } from './utils/baseUrl.js';
import { applyAccentToDocument, getStoredThemeColor } from './theme/theme.js';
import './index.css';
import ScrollToTop from './components/ScrollToTop.jsx';

// Seed accent + theme before first paint so logos/colors don't flash wrong.
try {
  const storedTheme = localStorage.getItem('mlb-theme') === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = storedTheme;
  document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  document.body.classList.toggle('theme-light', storedTheme === 'light');
  document.body.classList.toggle('theme-dark', storedTheme === 'dark');
  applyAccentToDocument(getStoredThemeColor(), storedTheme === 'dark');
} catch {
  applyAccentToDocument('default', true);
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename()}>
      <ThemeProvider>
        <ScrollToTop />
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
