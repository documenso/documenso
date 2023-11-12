'use client';

import React, { useContext } from 'react';

import { PublicEnv } from './types';

export type RuntimeEnvClientProviderProps = {
  value: PublicEnv;
  children: React.ReactNode;
};

const RuntimeEnvContext = React.createContext<PublicEnv | null>(null);

export const useRuntimeEnv = () => {
  const context = useContext(RuntimeEnvContext);

  if (!context) {
    throw new Error('useRuntimeEnv must be used within a RuntimeEnvProvider');
  }

  return context;
};

export const RuntimeEnvClientProvider = ({ value, children }: RuntimeEnvClientProviderProps) => {
  return <RuntimeEnvContext.Provider value={value}>{children}</RuntimeEnvContext.Provider>;
};
