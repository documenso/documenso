'use client';

import React from 'react';

import NextPlausibleProvider from 'next-plausible';

export type PlausibleProviderProps = {
  children: React.ReactNode;
};

export const PlausibleProvider = ({ children }: PlausibleProviderProps) => {
  return <NextPlausibleProvider domain="documenso.com">{children}</NextPlausibleProvider>;
};
