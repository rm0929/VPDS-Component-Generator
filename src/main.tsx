// src/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// 1) Nova base styles
import '@visa/nova-styles/styles.css';
// 2) Dark theme first
import '@visa/nova-styles/themes/visa-dark/index.css';
// 3) Light theme second
import '@visa/nova-styles/themes/visa-light/index.css';

import 'prismjs/themes/prism-tomorrow.css';

// 4) Force default to light before React even hydrates:
document.documentElement.setAttribute('data-theme', 'visa-light');

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
