'use server';

import { headers } from 'next/headers';

import { getLimits } from '../client';
import { LimitsProvider as ClientLimitsProvider } from './client';

export type LimitsProviderProps = {
  children?: React.ReactNode;
};

export const LimitsProvider = async ({ children }: LimitsProviderProps) => {
  const requestHeaders = Object.fromEntries(headers().entries());

  const limits = await getLimits({ headers: requestHeaders });

  return <ClientLimitsProvider initialValue={limits}>{children}</ClientLimitsProvider>;
};
