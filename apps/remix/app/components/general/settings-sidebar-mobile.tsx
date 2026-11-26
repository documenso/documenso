import { findSettingsNavParent, type SettingsNavGroup, type SettingsNavItem } from '@documenso/lib/utils/settings-nav';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

export type SettingsSidebarMobileProps = {
  heading: ReactNode;
  groups: SettingsNavGroup[];

  /**
   * The item for the current page, from `findActiveSettingsNav`.
   */
  activeItem: SettingsNavItem | null;

  /**
   * Rendered between the heading and the section picker, e.g. switchers.
   */
  children?: ReactNode;
  'data-testid'?: string;
};

export const SettingsSidebarMobile = ({
  heading,
  groups,
  activeItem,
  children,
  'data-testid': testId,
}: SettingsSidebarMobileProps) => {
  // The heading may be a full-bleed tab row (its border-b acts as a full-width divider); the
  // sections under it get `px-4` to line up with the content pane's own `px-4` inset, and
  // `pb-4` keeps the last control off the aside's bottom border.
  return (
    <div className="flex flex-col gap-3 pb-4" data-testid={testId}>
      {heading}
      {children}

      <div className="px-4">
        <SettingsNavJumpSelect groups={groups} activeItem={activeItem} />
      </div>
    </div>
  );
};

export type SettingsSidebarMobileHeadingProps = {
  children: ReactNode;
};

export const SettingsSidebarMobileHeading = ({ children }: SettingsSidebarMobileHeadingProps) => {
  return (
    <div className="px-4 py-2 text-center font-bold text-muted-foreground text-xs uppercase tracking-wide">
      {children}
    </div>
  );
};

type SettingsNavJumpSelectProps = {
  groups: SettingsNavGroup[];
  activeItem: SettingsNavItem | null;
};

const SettingsNavJumpSelect = ({ groups, activeItem }: SettingsNavJumpSelectProps) => {
  const { t } = useLingui();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const getOptionLabel = (items: SettingsNavItem[], item: SettingsNavItem) => {
    const parent = findSettingsNavParent(items, item);

    return parent ? `${t(parent.label)} › ${t(item.label)}` : t(item.label);
  };

  // On a page under a section (e.g. `/admin/users/42`), selecting the section's own path would make
  // picking it again a no-op, leaving no way back to its list on mobile. Selecting the current path
  // instead keeps the section a real choice, and the trigger shows its label as children.
  const isOnSubPage = activeItem !== null && activeItem.path !== pathname;

  return (
    <>
      <div className="mb-1 font-bold text-[10px] text-muted-foreground uppercase tracking-wide">
        <Trans>Jump to</Trans>
      </div>

      <Select
        value={isOnSubPage ? pathname : activeItem?.path}
        onValueChange={(value) => {
          void navigate(value);
        }}
      >
        <SelectTrigger data-testid="settings-mobile-section-trigger">
          <SelectValue placeholder={t`Select a section`}>
            {isOnSubPage
              ? getOptionLabel(
                  groups.flatMap((group) => group.items),
                  activeItem,
                )
              : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {groups.map((group, index) => (
            <SelectGroup key={group.label?.id ?? index}>
              {group.label && (
                <SelectLabel className="text-muted-foreground text-xs uppercase tracking-wide">
                  {t(group.label)}
                </SelectLabel>
              )}

              {group.items
                .filter((item) => !item.isSubNavParent)
                .map((item) => (
                  <SelectItem key={item.path} value={item.path}>
                    {getOptionLabel(group.items, item)}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </>
  );
};
