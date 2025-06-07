import { createContext, useContext } from 'react';
import React from 'react';

import type { TeamSession } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';

type TeamProviderValue = TeamSession;

interface TeamProviderProps {
  children: React.ReactNode;
  team: TeamProviderValue | null;
}

const TeamContext = createContext<TeamProviderValue | null>(null);

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
