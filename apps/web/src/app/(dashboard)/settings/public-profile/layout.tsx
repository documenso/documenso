import React from 'react';

export type PublicProfileSettingsLayout = {
  children: React.ReactNode;
};

export default function PublicProfileSettingsLayout({ children }: PublicProfileSettingsLayout) {
  return <div className="col-span-12 md:col-span-9">{children}</div>;
}
