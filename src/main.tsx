import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { createBrowserPwaDeps } from './pwa/browserDeps';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

// Created once at module load so StrictMode re-renders reuse the same deps object.
const pwaDeps = createBrowserPwaDeps();

createRoot(rootElement).render(
  <StrictMode>
    <App pwa={pwaDeps} />
  </StrictMode>,
);
