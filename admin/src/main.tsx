import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import { initAppCheck } from './lib/firebase';
import { ProductProvider } from './lib/product-context';
import { getProductConfig } from './lib/product-config';

initAppCheck();

const product = getProductConfig();
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ProductProvider config={product}>
        <BrowserRouter basename={product.basePath}>
          <App />
        </BrowserRouter>
      </ProductProvider>
    </React.StrictMode>
  );
}
