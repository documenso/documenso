'use server';

import React from 'react';

import { RuntimeEnvClientProvider } from './client';
import { PublicEnv } from './types';

export type RuntimeEnvProviderProps = {
  children: React.ReactNode;
};

export const RuntimeEnvProvider = ({ children }: RuntimeEnvProviderProps) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const publicEnv = Object.entries(process.env)
    .filter(([key]) => key.startsWith('NEXT_PUBLIC_'))
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) as PublicEnv;

  return (
    <RuntimeEnvClientProvider value={publicEnv}>
      {children}

      <script
        dangerouslySetInnerHTML={{
          __html: `window.__unstable_runtimeEnv = ${JSON.stringify(publicEnv)}`,
        }}
      />
    </RuntimeEnvClientProvider>
  );
};
