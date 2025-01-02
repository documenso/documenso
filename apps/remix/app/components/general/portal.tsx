import { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

type PortalComponentProps = {
  children: React.ReactNode;
  target: string;
};

export const PortalComponent = ({ children, target }: PortalComponentProps) => {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.getElementById(target));
  }, [target]);

  return portalRoot ? createPortal(children, portalRoot) : null;
};
