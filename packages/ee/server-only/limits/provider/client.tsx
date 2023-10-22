'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { equals } from 'remeda';

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

  const refreshLimits = async () => {
    const newLimits = await getLimits();

    setLimits((oldLimits) => {
      if (equals(oldLimits, newLimits)) {
        return oldLimits;
      }

      return newLimits;
    });
  };

  useEffect(() => {
    void refreshLimits();
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refreshLimits();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return <LimitsContext.Provider value={limits}>{children}</LimitsContext.Provider>;
};
