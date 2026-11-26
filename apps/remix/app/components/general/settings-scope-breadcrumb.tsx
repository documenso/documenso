import type { SettingsNavScope } from '@documenso/lib/utils/settings-nav';
import { cn } from '@documenso/ui/lib/utils';
import { Badge, type BadgeProps } from '@documenso/ui/primitives/badge';
import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import type { LucideIcon } from 'lucide-react';
import { Building2Icon, ChevronRightIcon, ShieldIcon, UserIcon, Users2Icon } from 'lucide-react';

export type SettingsScopeBreadcrumbProps = {
  scope: SettingsNavScope;
  scopeName: string;
  crumbs: string[];
};

export const SettingsScopeBreadcrumb = ({ scope, scopeName, crumbs }: SettingsScopeBreadcrumbProps) => {
  const { t } = useLingui();

  const { variant, Icon, label } = SCOPE_BADGE_CONFIG[scope];

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
        variant={variant}
        role="presentation"
        className="ml-auto gap-1.5"
        data-testid="settings-scope-breadcrumb-chip"
      >
        <Icon className="h-3.5 w-3.5" />
        {t(label)}
      </Badge>
    </nav>
  );
};

const SCOPE_BADGE_CONFIG: Record<
  SettingsNavScope,
  { variant: BadgeProps['variant']; Icon: LucideIcon; label: MessageDescriptor }
> = {
  organisation: { variant: 'default', Icon: Building2Icon, label: msg`Organisation Settings` },
  team: { variant: 'secondary', Icon: Users2Icon, label: msg`Team Settings` },
  account: { variant: 'neutral', Icon: UserIcon, label: msg`Account Settings` },
  admin: { variant: 'orange', Icon: ShieldIcon, label: msg`Admin Panel` },
};
