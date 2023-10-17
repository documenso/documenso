'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { getLimits } from '../client';
import { FREE_PLAN_LIMITS } from '../constants';
import { TLimitsResponseSchema } from '../schema';

export type LimitsContextValue = TLimitsResponseSchema;

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  if (!limits) {
    throw new Error('useLimits must be used within a LimitsProvider');
  }

  return limits;
};

export type LimitsProviderProps = {
  initialValue?: LimitsContextValue;
  children?: React.ReactNode;
};

export const LimitsProvider = ({ initialValue, children }: LimitsProviderProps) => {
  const defaultValue: TLimitsResponseSchema = {
    quota: FREE_PLAN_LIMITS,
    remaining: FREE_PLAN_LIMITS,
  };

  const [limits, setLimits] = useState(() => initialValue ?? defaultValue);

  useEffect(() => {
    void getLimits().then((limits) => setLimits(limits));
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void getLimits().then((limits) => setLimits(limits));
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return <LimitsContext.Provider value={limits}>{children}</LimitsContext.Provider>;
};
