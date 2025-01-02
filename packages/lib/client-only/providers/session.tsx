import { createContext, useContext } from 'react';
import React from 'react';

import type { SessionUser } from '@documenso/auth/server/lib/session/session';
import type { Session } from '@documenso/prisma/client';

import type { TGetTeamByUrlResponse } from '../../server-only/team/get-team';
import type { TGetTeamsResponse } from '../../server-only/team/get-teams';

export type AppSession = {
  session: Session;
  user: SessionUser;
  currentTeam: TGetTeamByUrlResponse | null;
  teams: TGetTeamsResponse;
};

interface SessionProviderProps {
  children: React.ReactNode;
  session: AppSession | null;
}

const SessionContext = createContext<AppSession | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
};

export const useOptionalSession = () => {
  return (
    useContext(SessionContext) || {
      user: null,
      session: null,
    }
  );
};

export const SessionProvider = ({ children, session }: SessionProviderProps) => {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};
