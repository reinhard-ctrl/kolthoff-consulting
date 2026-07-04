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

export function useProduct(): ProductConfig {
  return useContext(ProductContext);
}
