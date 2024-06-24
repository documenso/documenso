'use client';

import { createContext, useContext, useEffect, useState } from 'react';

import { equals } from 'remeda';

import { getLimits } from '../client';
import { FREE_PLAN_LIMITS } from '../constants';
import type { TLimitsResponseSchema } from '../schema';

export type LimitsContextValue = TLimitsResponseSchema & { refreshLimits?: () => Promise<void> };

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  if (!limits) {
    throw new Error('useLimits must be used within a LimitsProvider');
  }

  const safeRefreshLimits = async () => {
    if (typeof limits.refreshLimits === 'function') {
      await limits.refreshLimits();
    } else {
      throw new Error('the refreshLimits function is not available');
    }
  };

  return { ...limits, refreshLimits: safeRefreshLimits };
};

export type LimitsProviderProps = {
  initialValue?: LimitsContextValue;
  teamId?: number;
  children?: React.ReactNode;
};

export const LimitsProvider = ({
  initialValue = {
    quota: FREE_PLAN_LIMITS,
    remaining: FREE_PLAN_LIMITS,
  },
  teamId,
  children,
}: LimitsProviderProps) => {
  const [limits, setLimits] = useState(() => initialValue);

  const refreshLimits = async () => {
    const newLimits = await getLimits({ teamId });

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

  const contextValues = {
    ...limits,
    refreshLimits,
  };

  return <LimitsContext.Provider value={contextValues}>{children}</LimitsContext.Provider>;
};
