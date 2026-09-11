import { useChildRouteFlags } from '@documenso/lib/client-only/hooks/use-child-route-flags';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { cn } from '@documenso/ui/lib/utils';
import { Outlet } from 'react-router';

export default function Layout() {
  const currentOrganisation = useCurrentOrganisation();

  const { layoutMode } = useChildRouteFlags();

  // Note: We use a key to force a re-render if the team context changes.
  // This is required otherwise you would see the wrong page content.
  return (
    <div
      className={cn({
        'mx-auto w-full max-w-screen-xl px-4 md:px-8': layoutMode !== 'settings',
        'md:flex md:min-h-0 md:flex-1 md:flex-col': layoutMode === 'settings',
      })}
      key={currentOrganisation.url}
    >
      <Outlet />
    </div>
  );
}
