import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { isDeepEqual } from 'remeda';

import { getLimits } from '../client';
import { DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT, FREE_PLAN_LIMITS } from '../constants';
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

  /**
   * Bypass limits for embed authoring. This is just client side bypass since
   * all embeds should be paid plans.
   */
  bypassLimits?: boolean;
  teamId: number;
  children?: React.ReactNode;
};

export const LimitsProvider = ({
  initialValue = {
    quota: FREE_PLAN_LIMITS,
    remaining: FREE_PLAN_LIMITS,
    maximumEnvelopeItemCount: DEFAULT_MINIMUM_ENVELOPE_ITEM_COUNT,
  },
  bypassLimits,
  teamId,
  children,
}: LimitsProviderProps) => {
  const [limits, setLimits] = useState(() => initialValue);

  const refreshLimits = useCallback(async () => {
    if (bypassLimits) {
      return;
    }

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
    if (bypassLimits) {
      return;
    }

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
