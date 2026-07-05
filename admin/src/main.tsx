import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
import './agency-ops-light.css';
import { initAppCheck } from './lib/firebase';
import { ProductProvider } from './lib/product-context';
import { getProductConfig, isAgencyOpsStarter } from './lib/product-config';
import { applyDemoAppearanceToDocument, getStoredDemoAppearance } from './lib/demo-appearance';
import { DemoAppearanceProvider } from './lib/demo-appearance-context';

initAppCheck();

const product = getProductConfig();
if (isAgencyOpsStarter(product.id)) {
  applyDemoAppearanceToDocument(getStoredDemoAppearance());
} else if (product.theme === 'light') {
  document.documentElement.classList.add('agency-ops-light');
}
const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ProductProvider config={product}>
        <DemoAppearanceProvider>
          <BrowserRouter basename={product.basePath}>
            <App />
          </BrowserRouter>
        </DemoAppearanceProvider>
      </ProductProvider>
    </React.StrictMode>
  );
}
