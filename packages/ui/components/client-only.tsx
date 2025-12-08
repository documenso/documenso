import { useHydrated } from '../lib/use-hydrated';

type ClientOnlyProps = {
  children: () => React.ReactNode;
  fallback?: React.ReactNode;
};

export const ClientOnly = ({ children, fallback = null }: ClientOnlyProps) => {
  return useHydrated() ? <>{children()}</> : <>{fallback}</>;
};
