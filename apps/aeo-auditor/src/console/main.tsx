import React from 'react';
import ReactDOM from 'react-dom/client';
import '@gms/ui/styles/tokens.css';
import '../styles/globals.css';
import { ConsoleApp } from './ConsoleApp';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConsoleApp />
  </React.StrictMode>
);
