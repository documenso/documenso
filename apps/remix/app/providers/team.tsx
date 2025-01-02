import { createContext, useContext } from 'react';
import React from 'react';

import type { TGetTeamByUrlResponse } from '@documenso/lib/server-only/team/get-team';

interface TeamProviderProps {
  children: React.ReactNode;
  team: TGetTeamByUrlResponse;
}

const TeamContext = createContext<TGetTeamByUrlResponse | null>(null);

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
