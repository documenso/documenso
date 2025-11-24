import { Trans } from '@lingui/react/macro';
import {
  BarChart3,
  Building2Icon,
  FileStack,
  Settings,
  Trophy,
  Users,
  Wallet2,
} from 'lucide-react';
import { Link, Outlet, redirect, useLocation } from 'react-router';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { isAdmin } from '@documenso/lib/utils/is-admin';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';

import type { Route } from './+types/_layout';

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  if (!user || !isAdmin(user)) {
    throw redirect('/');
  }
}

export default function AdminLayout() {
  const { pathname } = useLocation();

  return (
    <div className="mx-auto w-full max-w-screen-xl px-4 md:px-8">
      <h1 className="text-4xl font-semibold">
        <Trans>Admin Panel</Trans>
      </h1>

      <div className="mt-4 grid grid-cols-12 gap-x-8 md:mt-8">
        <div
          className={cn(
            'col-span-12 flex gap-x-2.5 gap-y-2 overflow-hidden overflow-x-auto md:col-span-3 md:flex md:flex-col',
          )}
        >
          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/stats') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/stats">
              <BarChart3 className="mr-2 h-5 w-5" />
              <Trans>Stats</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/organisations') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/organisations">
              <Building2Icon className="mr-2 h-5 w-5" />
              <Trans>Organisations</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/claims') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/claims">
              <Wallet2 className="mr-2 h-5 w-5" />
              <Trans>Claims</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/users') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/users">
              <Users className="mr-2 h-5 w-5" />
              <Trans>Users</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/documents') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/documents">
              <FileStack className="mr-2 h-5 w-5" />
              <Trans>Documents</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/organisation-insights') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/organisation-insights">
              <Trophy className="mr-2 h-5 w-5" />
              <Trans>Organisation Insights</Trans>
            </Link>
          </Button>

          <Button
            variant="ghost"
            className={cn(
              'justify-start md:w-full',
              pathname?.startsWith('/admin/site-settings') && 'bg-secondary',
            )}
            asChild
          >
            <Link to="/admin/site-settings">
              <Settings className="mr-2 h-5 w-5" />
              <Trans>Site Settings</Trans>
            </Link>
          </Button>
        </div>

        <div className="col-span-12 mt-12 md:col-span-9 md:mt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
