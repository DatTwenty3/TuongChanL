import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { readTheme } from '../shared/theme';
import '../shared/modswitch.css';
import './styles/adm.css';
import App from './App';

if (typeof document !== 'undefined') {
  document.documentElement.dataset.theme = readTheme();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
