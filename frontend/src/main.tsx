import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '@/components/ui/Toast';
import App from '@/App';
import '@/styles/globals.css';
import '@/styles/animations.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
