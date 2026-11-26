import type { SettingsNavItem, SettingsNavScope } from '@documenso/lib/utils/settings-nav';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@documenso/ui/primitives/collapsible';
import { useLingui } from '@lingui/react/macro';
import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';

export type SettingsSidebarProps = {
  children: ReactNode;
  'data-testid'?: string;
};

export const SettingsSidebar = ({ children, 'data-testid': testId }: SettingsSidebarProps) => {
  return (
    <aside className="flex w-full flex-col divide-y" data-testid={testId}>
      {children}
    </aside>
  );
};

export type SettingsSidebarGroupProps = {
  heading: ReactNode;
  switcher?: ReactNode;
  items: SettingsNavItem[];

  /**
   * The item for the current page, from `findActiveSettingsNav`. May belong to another group.
   */
  activeItem: SettingsNavItem | null;
  scope: SettingsNavScope;
  emptyState?: ReactNode;
};

export const SettingsSidebarGroup = ({
  heading,
  switcher,
  items,
  activeItem,
  scope,
  emptyState,
}: SettingsSidebarGroupProps) => {
  const grouped = groupNavEntries(items);

  return (
    <div className="p-4" data-testid="settings-sidebar-group">
      <div className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-widest">{heading}</div>
      {switcher && <div className="mb-2">{switcher}</div>}

      {items.length === 0 && emptyState}

      <nav className="flex flex-col gap-1">
        {grouped.map((entry) => {
          if (entry.kind === 'flat') {
            return (
              <NavItemLink
                key={`${entry.item.key}-${entry.item.path}`}
                item={entry.item}
                isActive={entry.item === activeItem}
                scope={scope}
              />
            );
          }

          return (
            <CollapsibleNavSection
              key={`${entry.parent.key}-${entry.parent.path}`}
              parent={entry.parent}
              childItems={entry.children}
              activeItem={activeItem}
              scope={scope}
            />
          );
        })}
      </nav>
    </div>
  );
};

type NavItemLinkProps = {
  item: SettingsNavItem;
  isActive: boolean;
  scope: SettingsNavScope;
};

const NavItemLink = ({ item, isActive, scope }: NavItemLinkProps) => {
  const { t } = useLingui();

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(NAV_ITEM_CLASS_NAME, isActive && ACTIVE_NAV_ITEM_CLASS_NAME)}
      asChild
    >
      <Link
        to={item.path}
        aria-current={isActive ? 'page' : undefined}
        data-testid={`settings-nav-${scope}-${item.key}`}
      >
        {item.icon && <item.icon className="mr-2 h-4 w-4" />}
        {t(item.label)}
      </Link>
    </Button>
  );
};

type CollapsibleNavSectionProps = {
  parent: SettingsNavItem;
  childItems: SettingsNavItem[];
  activeItem: SettingsNavItem | null;
  scope: SettingsNavScope;
};

const CollapsibleNavSection = ({ parent, childItems, activeItem, scope }: CollapsibleNavSectionProps) => {
  const { t } = useLingui();

  const hasActiveChild = activeItem !== null && childItems.includes(activeItem);

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
            NAV_ITEM_CLASS_NAME,
            // Emphasise the parent when one of its children is the active page.
            hasActiveChild && 'font-medium text-foreground',
          )}
          data-testid={`settings-nav-${scope}-${parent.key}`}
          aria-expanded={isOpen}
        >
          {ParentIcon && <ParentIcon className="mr-2 h-4 w-4" />}
          {t(parent.label)}
          <ChevronRightIcon
            className={cn('ml-auto h-4 w-4 transition-transform duration-200', isOpen && 'rotate-90')}
          />
        </Button>
      </CollapsibleTrigger>

      {/* data-[state=closed]:hidden — the `flex` display class would otherwise
          defeat the `hidden` attribute Radix sets when closed, leaving the
          empty content box (and its mt-1) inflating the gap below the trigger. */}
      <CollapsibleContent className="mt-1 flex flex-col gap-1 pl-6 data-[state=closed]:hidden">
        {childItems.map((child) => (
          <NavItemLink key={`${child.key}-${child.path}`} item={child} isActive={child === activeItem} scope={scope} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
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

const NAV_ITEM_CLASS_NAME = 'h-8 w-full justify-start font-normal text-muted-foreground';

const ACTIVE_NAV_ITEM_CLASS_NAME =
  'font-medium bg-[#F1FBEA] text-gray-900 hover:bg-[#F1FBEA] hover:text-gray-900 dark:bg-[#1C2515] dark:text-[#F1FBEA] dark:hover:bg-[#1C2515] dark:hover:text-[#F1FBEA]';
