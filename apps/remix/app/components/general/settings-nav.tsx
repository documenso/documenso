import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router';

export type SettingsNavRoute = {
  path: string;
  label: string;
  icon?: LucideIcon;
  /**
   * Renders the route as a non-interactive group label, only visible on desktop.
   */
  isSectionLabel?: boolean;
  /**
   * Indents the route under the preceding section label on desktop.
   */
  isSubNav?: boolean;
  /**
   * Only mark the route as active on an exact path match.
   */
  end?: boolean;
};

export type SettingsNavProps = {
  routes: SettingsNavRoute[];
  className?: string;
};

export const SettingsNav = ({ routes, className }: SettingsNavProps) => {
  return (
    <nav
      className={cn(
        'flex flex-wrap items-center justify-start gap-x-2 gap-y-4 md:w-full md:flex-col md:items-start md:gap-y-2',
        className,
      )}
    >
      {routes.map((route) =>
        route.isSectionLabel ? (
          <div
            key={`${route.path}-${route.label}`}
            className="flex h-10 w-full items-center px-4 font-medium text-sm max-md:hidden"
          >
            {route.icon && <route.icon className="mr-2 h-5 w-5" />}
            {route.label}
          </div>
        ) : (
          <NavLink
            key={`${route.path}-${route.label}`}
            to={route.path}
            end={route.end}
            className={cn('group justify-start md:w-full', route.isSubNav && 'md:pl-8')}
          >
            <Button variant="ghost" className="w-full justify-start group-aria-[current]:bg-secondary">
              {route.icon && <route.icon className="mr-2 h-5 w-5" />}
              {route.label}
            </Button>
          </NavLink>
        ),
      )}
    </nav>
  );
};
