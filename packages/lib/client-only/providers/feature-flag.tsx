'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  FEATURE_FLAG_POLL_INTERVAL,
  LOCAL_FEATURE_FLAGS,
  isFeatureFlagEnabled,
} from '@documenso/lib/constants/feature-flags';
import { getAllFlags } from '@documenso/lib/universal/get-feature-flag';

import { TFeatureFlagValue } from './feature-flag.types';

export type FeatureFlagContextValue = {
  getFlag: (_key: string) => TFeatureFlagValue;
};

export const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

export const useFeatureFlags = () => {
  const context = useContext(FeatureFlagContext);

  if (!context) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }

  return context;
};

export function FeatureFlagProvider({
  children,
  initialFlags,
}: {
  children: React.ReactNode;
  initialFlags: Record<string, TFeatureFlagValue>;
}) {
  const [flags, setFlags] = useState(initialFlags);

  const getFlag = useCallback(
    (flag: string) => {
      if (!isFeatureFlagEnabled()) {
        return LOCAL_FEATURE_FLAGS[flag] ?? true;
      }

      return flags[flag] ?? false;
    },
    [flags],
  );

  /**
   * Refresh the flags every `FEATURE_FLAG_POLL_INTERVAL` amount of time if the window is focused.
   */
  useEffect(() => {
    if (!isFeatureFlagEnabled()) {
      return;
    }

    const interval = setInterval(() => {
      if (document.hasFocus()) {
        void getAllFlags().then((newFlags) => setFlags(newFlags));
      }
    }, FEATURE_FLAG_POLL_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, []);

  /**
   * Refresh the flags when the window is focused.
   */
  useEffect(() => {
    if (!isFeatureFlagEnabled()) {
      return;
    }

    const onFocus = () => void getAllFlags().then((newFlags) => setFlags(newFlags));

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <FeatureFlagContext.Provider
      value={{
        getFlag,
      }}
    >
      {children}
    </FeatureFlagContext.Provider>
  );
}
