import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Legacy HotPotatoes / ANTEM exercise stubs for inline event handlers
if (typeof window !== 'undefined') {
  (window as any).LeaveGap = () => {};
  (window as any).TrackFocus = () => {};
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);


