import React from 'react';
import { createRoot } from 'react-dom/client';
import { Landing } from './Landing';
import { applyLandingTheme } from './theme';
import './landing.css';

applyLandingTheme();

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <Landing />
    </React.StrictMode>,
  );
}
