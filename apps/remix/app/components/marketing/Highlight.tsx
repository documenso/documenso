import type { ReactNode } from 'react';

export function Highlight({ children }: { children: ReactNode }) {
  return <span className="bg-[linear-gradient(transparent_78%,hsl(var(--primary))_78%)] px-0.5">{children}</span>;
}
