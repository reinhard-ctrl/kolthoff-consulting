import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initAppCheck } from './lib/firebase';
import { initEmbedMode } from './lib/embed-mode';

initAppCheck();
initEmbedMode();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename="/workspace">
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
