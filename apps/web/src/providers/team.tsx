'use client';

import { createContext, useContext } from 'react';
import React from 'react';

import type { Team } from '@documenso/prisma/client';

interface TeamProviderProps {
  children: React.ReactNode;
  team: Team;
}

const TeamContext = createContext<Team | null>(null);

export const useCurrentTeam = () => {
  const context = useContext(TeamContext);

  if (!context) {
    throw new Error('useCurrentTeam must be used within a TeamProvider');
  }

  return context;
};

export const useOptionalCurrentTeam = () => {
  return useContext(TeamContext);
};

export const TeamProvider = ({ children, team }: TeamProviderProps) => {
  return <TeamContext.Provider value={team}>{children}</TeamContext.Provider>;
};
