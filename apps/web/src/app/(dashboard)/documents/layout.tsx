import { ReactNode } from 'react';

export type DocumentLayoutProps = {
  children: ReactNode;
  modals: ReactNode;
};

export default function DocumentLayout({ children, modals }: DocumentLayoutProps) {
  return (
    <>
      {children}
      {modals}
    </>
  );
}
