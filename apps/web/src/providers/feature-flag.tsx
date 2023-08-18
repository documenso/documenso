'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  FEATURE_FLAG_POLL_INTERVAL,
  LOCAL_FEATURE_FLAGS,
  isFeatureFlagEnabled,
} from '@documenso/lib/constants/feature-flags';

import { getAllFlags } from '~/helpers/get-feature-flag';

export type FeatureFlagValue = boolean | string | number | undefined;

export type FeatureFlagContextValue = {
  getFlag: (_key: string) => FeatureFlagValue;
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
  initialFlags: Record<string, FeatureFlagValue>;
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
        getAllFlags().then((newFlags) => setFlags(newFlags));
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

    const onFocus = () => getAllFlags().then((newFlags) => setFlags(newFlags));

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
