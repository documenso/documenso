'use client';

import React from 'react';

import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

export type NextAuthProviderProps = {
  session?: Session | null;
  children: React.ReactNode;
};

export const NextAuthProvider = ({ session, children }: NextAuthProviderProps) => {
  return <SessionProvider session={session}>{children}</SessionProvider>;
};
