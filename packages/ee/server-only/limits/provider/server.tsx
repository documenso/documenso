'use server';

import { headers } from 'next/headers';

import { getLimits } from '../client';
<<<<<<< HEAD
=======
import type { LimitsContextValue } from './client';
>>>>>>> main
import { LimitsProvider as ClientLimitsProvider } from './client';

export type LimitsProviderProps = {
  children?: React.ReactNode;
<<<<<<< HEAD
};

export const LimitsProvider = async ({ children }: LimitsProviderProps) => {
  const requestHeaders = Object.fromEntries(headers().entries());

  const limits = await getLimits({ headers: requestHeaders });

  return <ClientLimitsProvider initialValue={limits}>{children}</ClientLimitsProvider>;
=======
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
>>>>>>> main
};
