import { useSyncExternalStore } from 'react';

const subscribe = () => {
  return () => {};
};

const getSnapshot = () => {
  return true;
};

const getServerSnapshot = () => {
  return false;
};

export const ClientOnly = ({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement | null => {
  const isClient = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return isClient ? <>{children}</> : null;
};
