'use client';

import { createContext, useContext, useEffect, useState } from 'react';

<<<<<<< HEAD
import { getLimits } from '../client';
import { FREE_PLAN_LIMITS } from '../constants';
import { TLimitsResponseSchema } from '../schema';
=======
import { equals } from 'remeda';

import { getLimits } from '../client';
import { FREE_PLAN_LIMITS } from '../constants';
import type { TLimitsResponseSchema } from '../schema';
>>>>>>> main

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
<<<<<<< HEAD
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
=======
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
>>>>>>> main
  }, []);

  useEffect(() => {
    const onFocus = () => {
<<<<<<< HEAD
      void getLimits().then((limits) => setLimits(limits));
=======
      void refreshLimits();
>>>>>>> main
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return <LimitsContext.Provider value={limits}>{children}</LimitsContext.Provider>;
};
