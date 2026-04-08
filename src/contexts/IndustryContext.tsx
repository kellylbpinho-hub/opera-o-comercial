import { createContext, useContext, useState, ReactNode, useEffect } from "react";

interface IndustrySelection {
  industryId: string | null;
  industryKey: string | null;
  industryName: string | null;
  modeId: string | null;
  modeName: string | null;
}

interface IndustryContextType extends IndustrySelection {
  setIndustry: (id: string, key: string, name: string) => void;
  setMode: (id: string | null, name: string | null) => void;
  clearSelection: () => void;
}

const STORAGE_KEY = "esteira-industry-selection";

const loadSelection = (): IndustrySelection => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { industryId: null, industryKey: null, industryName: null, modeId: null, modeName: null };
};

const IndustryContext = createContext<IndustryContextType>({
  industryId: null,
  industryKey: null,
  industryName: null,
  modeId: null,
  modeName: null,
  setIndustry: () => {},
  setMode: () => {},
  clearSelection: () => {},
});

export const useIndustry = () => useContext(IndustryContext);

export function IndustryProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<IndustrySelection>(loadSelection);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  }, [selection]);

  const setIndustry = (id: string, key: string, name: string) => {
    setSelection({ industryId: id, industryKey: key, industryName: name, modeId: null, modeName: null });
  };

  const setMode = (id: string | null, name: string | null) => {
    setSelection(prev => ({ ...prev, modeId: id, modeName: name }));
  };

  const clearSelection = () => {
    setSelection({ industryId: null, industryKey: null, industryName: null, modeId: null, modeName: null });
  };

  return (
    <IndustryContext.Provider value={{ ...selection, setIndustry, setMode, clearSelection }}>
      {children}
    </IndustryContext.Provider>
  );
}
