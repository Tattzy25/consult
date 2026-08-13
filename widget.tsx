import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/App';

(function () {
  const existing = document.getElementById('agentic-widget-root');
  if (existing) return;

  const container = document.createElement('div');
  container.id = 'agentic-widget-root';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<App />);
})();