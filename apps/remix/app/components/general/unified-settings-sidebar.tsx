import type { SettingsNavGroups, SettingsNavItem, SettingsNavScope } from '@documenso/lib/utils/settings-nav';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@documenso/ui/primitives/collapsible';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router';

import { SettingsOrgSwitcher } from './settings-org-switcher';
import { SettingsTeamSwitcher } from './settings-team-switcher';

export type UnifiedSettingsSidebarProps = {
  groups: SettingsNavGroups;
  currentOrgUrl: string | null;
  currentTeamUrl: string | null;
};

export const UnifiedSettingsSidebar = ({ groups, currentOrgUrl, currentTeamUrl }: UnifiedSettingsSidebarProps) => {
  return (
    <aside className="flex w-full flex-col" data-testid="unified-settings-sidebar">
      {currentOrgUrl && (
        <div className="p-4">
          <SidebarGroup
            heading={<Trans>Organisation Settings</Trans>}
            activeBgClassName="bg-[#F1FBEA] text-gray-900 hover:bg-[#F1FBEA] hover:text-gray-900 dark:bg-[#1C2515] dark:text-[#F1FBEA] dark:hover:bg-[#1C2515] dark:hover:text-[#F1FBEA]"
            switcher={<SettingsOrgSwitcher currentOrgUrl={currentOrgUrl} />}
            items={groups.organisation?.items ?? []}
            scope="organisation"
            emptyState={
              <p
                className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-xs"
                data-testid="unified-settings-organisation-empty-state"
              >
                <Trans>
                  You don't have permission to manage this organisation. Switch to another one above, or continue in
                  your team settings below.
                </Trans>
              </p>
            }
          />
        </div>
      )}

      {groups.team && currentOrgUrl && (
        <div className="border-t p-4">
          <SidebarGroup
            heading={<Trans>Team Settings</Trans>}
            activeBgClassName="bg-[#F1FBEA] text-gray-900 hover:bg-[#F1FBEA] hover:text-gray-900 dark:bg-[#1C2515] dark:text-[#F1FBEA] dark:hover:bg-[#1C2515] dark:hover:text-[#F1FBEA]"
            switcher={<SettingsTeamSwitcher currentOrgUrl={currentOrgUrl} currentTeamUrl={currentTeamUrl} />}
            items={groups.team.items}
            scope={groups.team.scope}
          />
        </div>
      )}

      <div className={cn('p-4', currentOrgUrl && 'border-t')}>
        <SidebarGroup
          heading={<Trans>Account Settings</Trans>}
          activeBgClassName="bg-[#F1FBEA] text-gray-900 hover:bg-[#F1FBEA] hover:text-gray-900 dark:bg-[#1C2515] dark:text-[#F1FBEA] dark:hover:bg-[#1C2515] dark:hover:text-[#F1FBEA]"
          items={groups.account.items}
          scope={groups.account.scope}
        />
      </div>
    </aside>
  );
};

type SidebarGroupProps = {
  className?: string;
  headingClassName?: string;
  heading: ReactNode;
  activeBgClassName: string;
  switcher?: ReactNode;
  items: SettingsNavItem[];
  scope: SettingsNavScope;
  emptyState?: ReactNode;
};

type GroupedNavEntry =
  | { kind: 'flat'; item: SettingsNavItem }
  | { kind: 'collapsible'; parent: SettingsNavItem; children: SettingsNavItem[] };

/**
 * Walk a flat item list and group consecutive `isSubNav` items under their preceding
 * `isSubNavParent`. Anything else renders as a flat entry.
 */
const groupNavEntries = (items: SettingsNavItem[]): GroupedNavEntry[] => {
  const entries: GroupedNavEntry[] = [];
  let currentCollapsible: { parent: SettingsNavItem; children: SettingsNavItem[] } | null = null;

  for (const item of items) {
    if (item.isSubNavParent) {
      currentCollapsible = { parent: item, children: [] };
      entries.push({ kind: 'collapsible', ...currentCollapsible });
      continue;
    }

    if (item.isSubNav && currentCollapsible) {
      currentCollapsible.children.push(item);
      continue;
    }

    currentCollapsible = null;
    entries.push({ kind: 'flat', item });
  }

  return entries;
};

const SidebarGroup = ({
  className,
  headingClassName,
  heading,
  activeBgClassName,
  switcher,
  items,
  scope,
  emptyState,
}: SidebarGroupProps) => {
  const grouped = groupNavEntries(items);

  return (
    <div className={className} data-testid="unified-settings-sidebar-group">
      <div
        className={cn('mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest', headingClassName)}
      >
        {heading}
      </div>
      {switcher && <div className="mb-2">{switcher}</div>}

      {items.length === 0 && emptyState}

      <nav className="flex flex-col gap-1">
        {grouped.map((entry) => {
          if (entry.kind === 'flat') {
            return (
              <FlatNavItem
                key={`${entry.item.key}-${entry.item.path}`}
                item={entry.item}
                activeBgClassName={activeBgClassName}
                scope={scope}
              />
            );
          }

          return (
            <CollapsibleNavSection
              key={`${entry.parent.key}-${entry.parent.path}`}
              parent={entry.parent}
              childItems={entry.children}
              activeBgClassName={activeBgClassName}
              scope={scope}
            />
          );
        })}
      </nav>
    </div>
  );
};

type FlatNavItemProps = {
  item: SettingsNavItem;
  activeBgClassName: string;
  scope: SettingsNavScope;
};

const FlatNavItem = ({ item, activeBgClassName, scope }: FlatNavItemProps) => {
  const { _ } = useLingui();
  const { pathname } = useLocation();

  // The General items link to the settings root, which prefixes every other
  // item's path — those require an exact match. Everything else highlights on
  // its sub-routes too (e.g. Security on /settings/security/passkeys).
  const isActive =
    item.key === 'general' ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`);

  return (
    <NavLink to={item.path} className="group block" data-testid={`unified-settings-nav-${scope}-${item.key}`} end>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'h-8 w-full justify-start font-normal text-muted-foreground',
          isActive && cn(activeBgClassName, 'font-medium'),
        )}
      >
        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
        {_(item.label)}
      </Button>
    </NavLink>
  );
};

type CollapsibleNavSectionProps = {
  parent: SettingsNavItem;
  childItems: SettingsNavItem[];
  activeBgClassName: string;
  scope: SettingsNavScope;
};

const CollapsibleNavSection = ({ parent, childItems, activeBgClassName, scope }: CollapsibleNavSectionProps) => {
  const { _ } = useLingui();
  const { pathname } = useLocation();

  const hasActiveChild = childItems.some((child) => pathname === child.path || pathname.startsWith(`${child.path}/`));

  const [isOpen, setIsOpen] = useState(hasActiveChild);

  // Auto-open when navigating to a sub-route. Closing while on a sub-route is
  // respected (state stays closed) until the user navigates away and back.
  useEffect(() => {
    if (hasActiveChild) {
      setIsOpen(true);
    }
  }, [hasActiveChild]);

  const ParentIcon = parent.icon ? parent.icon : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-full justify-start font-normal text-muted-foreground',
            // Emphasise the parent when one of its children is the active page.
            hasActiveChild && 'font-medium text-foreground',
          )}
          data-testid={`unified-settings-nav-${scope}-${parent.key}`}
          aria-expanded={isOpen}
        >
          {ParentIcon && <ParentIcon className="mr-2 h-4 w-4" />}
          {_(parent.label)}
          <ChevronRightIcon
            className={cn('ml-auto h-4 w-4 transition-transform duration-200', isOpen && 'rotate-90')}
          />
        </Button>
      </CollapsibleTrigger>

      {/* data-[state=closed]:hidden — the `flex` display class would otherwise
          defeat the `hidden` attribute Radix sets when closed, leaving the
          empty content box (and its mt-1) inflating the gap below the trigger. */}
      <CollapsibleContent className="mt-1 flex flex-col gap-1 data-[state=closed]:hidden">
        {childItems.map((child) => {
          const isActive = pathname === child.path || pathname.startsWith(`${child.path}/`);

          return (
            <NavLink
              key={`${child.key}-${child.path}`}
              to={child.path}
              className="group block pl-6"
              data-testid={`unified-settings-nav-${scope}-${child.key}`}
            >
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 w-full justify-start font-normal text-muted-foreground',
                  isActive && cn(activeBgClassName, 'font-medium'),
                )}
              >
                {_(child.label)}
              </Button>
            </NavLink>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};
