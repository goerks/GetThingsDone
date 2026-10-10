import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '../docs/design/tokens.css';
import './styles/app.css';
import App from './App';
import { initI18n } from './i18n';
import { applyTheme, detectTheme } from './theme';

initI18n();
applyTheme(detectTheme());

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
