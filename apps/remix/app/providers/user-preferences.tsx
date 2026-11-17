import { formatPath } from '@documenso/lib/constants/app';
import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { funnel } from 'remeda';

import type { TUserPreferences } from '~/utils/user-preferences';

export type UserPreferencesProviderProps = {
  children: React.ReactNode;
  initialPreferences: TUserPreferences;
};

type UserPreferencesContextValue = {
  preferences: TUserPreferences;
  updatePreferences: (update: TUserPreferences) => void;
};

const UserPreferencesContext = createContext<UserPreferencesContextValue | null>(null);

/**
 * Seeded from the root loader, which never revalidates, so after hydration this
 * state is the source of truth and the cookie is only re-read on a full page load.
 */
export const UserPreferencesProvider = ({ children, initialPreferences }: UserPreferencesProviderProps) => {
  const [preferences, setPreferences] = useState(initialPreferences);

  const updatePreferences = useCallback((update: TUserPreferences) => {
    setPreferences((current) => ({ ...current, ...update }));

    savePreferences.call(update);
  }, []);

  const value = useMemo(() => ({ preferences, updatePreferences }), [preferences, updatePreferences]);

  return <UserPreferencesContext.Provider value={value}>{children}</UserPreferencesContext.Provider>;
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);

  if (!context) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }

  return context;
};

// Sends the first change immediately, then merges changes made less than 500ms apart
// into one trailing request.
// Known trade-off if the first request takes longer than 500ms change can be lost.
const savePreferences = funnel(
  (update: TUserPreferences) => {
    void fetch(formatPath('/api/user-preferences'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    }).catch(() => undefined); // Ignore errors, preference still applies for this session.
  },
  {
    reducer: (merged: TUserPreferences | undefined, update: TUserPreferences) => ({ ...merged, ...update }),
    triggerAt: 'both',
    minQuietPeriodMs: 500,
  },
);
