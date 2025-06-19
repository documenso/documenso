import { Outlet } from 'react-router';

import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';

export default function Layout() {
  const currentOrganisation = useCurrentOrganisation();

  // Note: We use a key to force a re-render if the team context changes.
  // This is required otherwise you would see the wrong page content.
  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8" key={currentOrganisation.url}>
      <Outlet />
    </div>
  );
}
