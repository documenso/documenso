import { createContext, useContext } from 'react';
import React from 'react';

import type { Session, User } from '@prisma/client';

interface AuthProviderProps {
  children: React.ReactNode;
  session: Session;
  user: User;
}

const AuthContext = createContext<{
  user: User; // Todo: Exclude password
  session: Session;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }

  return context;
};

export const AuthProvider = ({ children, session, user }: AuthProviderProps) => {
  return <AuthContext.Provider value={{ session, user }}>{children}</AuthContext.Provider>;
};
