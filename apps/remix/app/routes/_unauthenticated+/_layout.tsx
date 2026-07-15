import { Outlet } from 'react-router';

import { BrandingLogo } from '~/components/general/branding-logo';

export default function Layout() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12 md:p-12 lg:p-24">
      <div>
        <div className="mb-2 flex items-center justify-center gap-x-2">
          <BrandingLogo className="h-8 w-auto" />
          <span className="text-muted-foreground text-sm">by DataThink</span>
        </div>

        <div className="mb-8 text-center text-muted-foreground text-sm">
          Send, sign, and manage contracts with ease, all in one place.
        </div>

        <div className="w-full">
          <Outlet />
        </div>
      </div>
    </main>
  );
}
