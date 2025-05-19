import { createContext, useContext } from 'react';
import React from 'react';

import type { OrganisationSession } from '@documenso/trpc/server/organisation-router/get-organisation-session.types';

type OrganisationProviderValue = OrganisationSession;

interface OrganisationProviderProps {
  children: React.ReactNode;
  organisation: OrganisationProviderValue | null;
}

const OrganisationContext = createContext<OrganisationProviderValue | null>(null);

export const useCurrentOrganisation = () => {
  const context = useContext(OrganisationContext);

  if (!context) {
    throw new Error('useCurrentOrganisation must be used within a OrganisationProvider');
  }

  return context;
};

export const useOptionalCurrentOrganisation = () => {
  return useContext(OrganisationContext);
};

export const OrganisationProvider = ({ children, organisation }: OrganisationProviderProps) => {
  return (
    <OrganisationContext.Provider value={organisation}>{children}</OrganisationContext.Provider>
  );
};
