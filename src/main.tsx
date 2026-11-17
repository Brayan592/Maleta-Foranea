import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __MALETA_APP_MOUNTED__?: boolean;
  }
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
  window.__MALETA_APP_MOUNTED__ = true;
}
