import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import 'core-js/actual/url';
import 'core-js/actual/url-search-params';
import 'whatwg-fetch';

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
