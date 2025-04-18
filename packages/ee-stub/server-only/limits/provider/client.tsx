/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */
'use client';

import React, { type ReactNode, createContext, useContext } from 'react';

import type { Limits } from '../client';
import { COMMUNITY_PLAN_LIMITS } from '../constants';

/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */

/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */

/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */

/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */

/**
 * Stub implementation of the limits provider.
 * In the stub version, all users get community plan limits.
 */

const LimitsContext = createContext<Limits>(COMMUNITY_PLAN_LIMITS);

export const LimitsProvider = ({
  children,
  initialValue = COMMUNITY_PLAN_LIMITS,
  teamId,
}: {
  children: ReactNode;
  initialValue?: Limits;
  teamId?: number;
}) => {
  return <LimitsContext.Provider value={initialValue}>{children}</LimitsContext.Provider>;
};

export const useLimits = () => {
  const limits = useContext(LimitsContext);

  // Add backward compatibility for remaining and quota properties
  return {
    ...limits,
    remaining: {
      documents: limits.MAX_DOCUMENTS,
      recipients: limits.MAX_SIGNERS,
      directTemplates: limits.MAX_TEMPLATES,
    },
    quota: {
      documents: limits.MAX_DOCUMENTS,
      recipients: limits.MAX_SIGNERS,
      directTemplates: limits.MAX_TEMPLATES,
    },
    refreshLimits: () => {
      // No-op function for backward compatibility
    },
  };
};
