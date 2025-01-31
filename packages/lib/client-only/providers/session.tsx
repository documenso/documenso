import { createContext, useContext } from 'react';
import React from 'react';

import type { Session, User } from '@prisma/client';

interface AuthProviderProps {
  children: React.ReactNode;
  session: Session;
  user: User;
}

const SessionContext = createContext<{
  user: User; // Todo: Exclude password
  session: Session;
} | null>(null);

export const useSession = () => {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }

  return context;
};

export const SessionProvider = ({ children, session, user }: AuthProviderProps) => {
  return <SessionContext.Provider value={{ session, user }}>{children}</SessionContext.Provider>;
};
