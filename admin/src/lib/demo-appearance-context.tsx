import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useProduct } from './product-context';
import { isAgencyOpsStarter } from './product-config';
import {
  applyDemoAppearanceToDocument,
  getStoredDemoAppearance,
  setStoredDemoAppearance,
  type DemoAppearance,
} from './demo-appearance';

type DemoAppearanceContextValue = {
  /** Current demo appearance when toggle is enabled; null for Kolthoff OS. */
  appearance: DemoAppearance | null;
  isLight: boolean;
  isDemoToggleEnabled: boolean;
  setAppearance: (appearance: DemoAppearance) => void;
  toggleAppearance: () => void;
};

const DemoAppearanceContext = createContext<DemoAppearanceContextValue>({
  appearance: null,
  isLight: false,
  isDemoToggleEnabled: false,
  setAppearance: () => {},
  toggleAppearance: () => {},
});

export function DemoAppearanceProvider({ children }: { children: ReactNode }) {
  const product = useProduct();
  const demoToggleEnabled = isAgencyOpsStarter(product.id);
  const [appearance, setAppearanceState] = useState<DemoAppearance>(() =>
    demoToggleEnabled ? getStoredDemoAppearance() : 'dark'
  );

  const setAppearance = useCallback(
    (next: DemoAppearance) => {
      if (!demoToggleEnabled) return;
      setStoredDemoAppearance(next);
      applyDemoAppearanceToDocument(next);
      setAppearanceState(next);
    },
    [demoToggleEnabled]
  );

  const toggleAppearance = useCallback(() => {
    setAppearance(appearance === 'light' ? 'dark' : 'light');
  }, [appearance, setAppearance]);

  const value = useMemo<DemoAppearanceContextValue>(() => {
    const isLight = demoToggleEnabled ? appearance === 'light' : product.theme === 'light';
    return {
      appearance: demoToggleEnabled ? appearance : null,
      isLight,
      isDemoToggleEnabled: demoToggleEnabled,
      setAppearance,
      toggleAppearance,
    };
  }, [appearance, demoToggleEnabled, product.theme, setAppearance, toggleAppearance]);

  return (
    <DemoAppearanceContext.Provider value={value}>{children}</DemoAppearanceContext.Provider>
  );
}

export function useDemoAppearance(): DemoAppearanceContextValue {
  return useContext(DemoAppearanceContext);
}
