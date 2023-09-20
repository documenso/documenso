'use client';

import { createContext, useContext } from 'react';

export type LocaleContextValue = {
  locale: string;
};

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export const useLocale = () => {
  const context = useContext(LocaleContext);

  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }

  return context;
};

export function LocaleProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <LocaleContext.Provider
      value={{
        locale: locale,
      }}
    >
      {children}
    </LocaleContext.Provider>
  );
}
