'use server';

import { headers } from 'next/headers';

import { getLimits } from '../client';
import type { LimitsContextValue } from './client';
import { LimitsProvider as ClientLimitsProvider } from './client';

export type LimitsProviderProps = {
  children?: React.ReactNode;
  teamId?: number;
};

export const LimitsProvider = async ({ children, teamId }: LimitsProviderProps) => {
  const requestHeaders = Object.fromEntries(headers().entries());

  const limits: LimitsContextValue = await getLimits({ headers: requestHeaders, teamId });

  return (
    <ClientLimitsProvider initialValue={limits} teamId={teamId}>
      {children}
    </ClientLimitsProvider>
  );
};
