import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import React from 'react';

import type { Session } from '@prisma/client';
import { useLocation } from 'react-router';

import { authClient } from '@documenso/auth/client';
import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import { type TGetTeamsResponse } from '@documenso/lib/server-only/team/get-teams';
import { trpc } from '@documenso/trpc/client';

export type AppSession = {
  session: Session;
  user: SessionUser;
  teams: TGetTeamsResponse;
};

interface SessionProviderProps {
  children: React.ReactNode;
  initialSession: AppSession | null;
}

interface SessionContextValue {
  sessionData: AppSession | null;
  refreshSession: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  if (!context.sessionData) {
    throw new Error('Session not found');
  }

  return {
    ...context.sessionData,
    refreshSession: context.refreshSession,
  };
};

export const useOptionalSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useOptionalSession must be used within a SessionProvider');
  }

  return context;
};

export const SessionProvider = ({ children, initialSession }: SessionProviderProps) => {
  const [session, setSession] = useState<AppSession | null>(initialSession);

  const location = useLocation();

  const refreshSession = useCallback(async () => {
    const newSession = await authClient.getSession();

    if (!newSession.isAuthenticated) {
      setSession(null);
      return;
    }

    const teams = await trpc.team.getTeams.query().catch(() => {
      // Todo: (RR7) Log
      return [];
    });

    setSession({
      session: newSession.session,
      user: newSession.user,
      teams,
    });
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void refreshSession();
    };

    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshSession]);

  /**
   * Refresh session in background on navigation.
   */
  useEffect(() => {
    void refreshSession();
  }, [location.pathname]);

  return (
    <SessionContext.Provider
      value={{
        sessionData: session,
        refreshSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};
