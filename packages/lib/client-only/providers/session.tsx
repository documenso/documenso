import { createContext, useContext } from 'react';
import React from 'react';

import type { Session, User } from '@prisma/client';

interface AuthProviderProps {
  children: React.ReactNode;
  session: DocumensoSession | null;
}

export type DocumensoSession = {
  user: User; // Todo: Exclude password
  session: Session;
};

const SessionContext = createContext<DocumensoSession | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
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

export const SessionProvider = ({ children, session }: AuthProviderProps) => {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};
