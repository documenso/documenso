import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { isDeepEqual } from 'remeda';

import { getLimits } from '../client';
import { FREE_PLAN_LIMITS } from '../constants';
import type { TLimitsResponseSchema } from '../schema';

export type LimitsContextValue = TLimitsResponseSchema & { refreshLimits: () => Promise<void> };

const LimitsContext = createContext<LimitsContextValue | null>(null);

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  if (!limits) {
    throw new Error('useLimits must be used within a LimitsProvider');
  }

  return limits;
};

export type LimitsProviderProps = {
  initialValue?: TLimitsResponseSchema;
  teamId: number;
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

  const refreshLimits = useCallback(async () => {
    const newLimits = await getLimits({ teamId });

    setLimits((oldLimits) => {
      if (isDeepEqual(oldLimits, newLimits)) {
        return oldLimits;
      }

      return newLimits;
    });
  }, [teamId]);

  useEffect(() => {
    void refreshLimits();
  }, [refreshLimits]);

  useEffect(() => {
    const onFocus = () => {
      void refreshLimits();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshLimits]);

  return (
    <LimitsContext.Provider
      value={{
        ...limits,
        refreshLimits,
      }}
    >
      {children}
    </LimitsContext.Provider>
  );
};
