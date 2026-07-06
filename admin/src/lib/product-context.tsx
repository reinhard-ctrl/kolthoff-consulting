import { createContext, useContext, type ReactNode } from 'react';
import { getProductConfig, type ProductConfig } from './product-config';

const ProductContext = createContext<ProductConfig>(getProductConfig());

export function ProductProvider({ children, config }: { children: ReactNode; config?: ProductConfig }) {
  return (
    <ProductContext.Provider value={config ?? getProductConfig()}>
      {children}
    </ProductContext.Provider>
  );
}

/** Always resolves current tenant (?tenant= from URL or sessionStorage). */
export function useProduct(): ProductConfig {
  return getProductConfig();
}

export function useProductSnapshot(): ProductConfig {
  return useContext(ProductContext);
}
