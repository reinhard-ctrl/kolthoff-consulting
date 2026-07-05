import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type BrandingPreviewContextValue = {
  previewPresetId: string | null;
  setPreviewPresetId: (presetId: string | null) => void;
};

const BrandingPreviewContext = createContext<BrandingPreviewContextValue>({
  previewPresetId: null,
  setPreviewPresetId: () => {},
});

export function BrandingPreviewProvider({ children }: { children: ReactNode }) {
  const [previewPresetId, setPreviewPresetId] = useState<string | null>(null);
  const value = useMemo(
    () => ({ previewPresetId, setPreviewPresetId }),
    [previewPresetId],
  );
  return (
    <BrandingPreviewContext.Provider value={value}>{children}</BrandingPreviewContext.Provider>
  );
}

export function useBrandingPreview() {
  return useContext(BrandingPreviewContext);
}
