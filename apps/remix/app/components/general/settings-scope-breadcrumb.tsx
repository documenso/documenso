import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Trans } from '@lingui/react/macro';
import { Building2Icon, ChevronRightIcon, UserIcon, Users2Icon } from 'lucide-react';

export type SettingsScopeBreadcrumbProps = {
  scope: 'organisation' | 'team' | 'account';
  scopeName: string;
  crumbs: string[];
};

export const SettingsScopeBreadcrumb = ({ scope, scopeName, crumbs }: SettingsScopeBreadcrumbProps) => {
  return (
    <nav
      aria-label="settings-scope-breadcrumb"
      className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground text-sm"
      data-testid="settings-scope-breadcrumb"
    >
      <span>{scopeName}</span>

      {crumbs.map((crumb, idx) => {
        const isLeaf = idx === crumbs.length - 1;

        return (
          <span key={`${crumb}-${idx}`} className="flex items-center gap-2">
            <ChevronRightIcon className="h-3.5 w-3.5 opacity-50" />
            <span className={cn(isLeaf && 'font-semibold text-foreground')}>{crumb}</span>
          </span>
        );
      })}
      <Badge
        variant={scope === 'organisation' ? 'default' : scope === 'team' ? 'secondary' : 'neutral'}
        role="presentation"
        className="ml-auto gap-1.5"
        data-testid="settings-scope-breadcrumb-chip"
      >
        {scope === 'organisation' && (
          <>
            <Building2Icon className="h-3.5 w-3.5" />
            <Trans>Organisation Settings</Trans>
          </>
        )}
        {scope === 'team' && (
          <>
            <Users2Icon className="h-3.5 w-3.5" />
            <Trans>Team Settings</Trans>
          </>
        )}
        {scope === 'account' && (
          <>
            <UserIcon className="h-3.5 w-3.5" />
            <Trans>Account Settings</Trans>
          </>
        )}
      </Badge>
    </nav>
  );
};
