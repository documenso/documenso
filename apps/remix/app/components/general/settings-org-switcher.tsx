import { useSession } from '@documenso/lib/client-only/providers/session';
import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { type INTERNAL_CLAIM_ID, internalClaims } from '@documenso/lib/types/subscription';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
import { canExecuteOrganisationAction } from '@documenso/lib/utils/organisations';
import { getSettingsNavGroups } from '@documenso/lib/utils/settings-nav';
import { computeSwitcherContinuityPath } from '@documenso/lib/utils/settings-switcher';
import { canExecuteTeamAction } from '@documenso/lib/utils/teams';
import { cn } from '@documenso/ui/lib/utils';
import { AvatarWithText } from '@documenso/ui/primitives/avatar';
import { Button } from '@documenso/ui/primitives/button';
import { Input } from '@documenso/ui/primitives/input';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronsUpDownIcon, PlusIcon, SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const SEARCH_THRESHOLD = 5;

export type SettingsOrgSwitcherProps = {
  currentOrgUrl: string;
};

export const SettingsOrgSwitcher = ({ currentOrgUrl }: SettingsOrgSwitcherProps) => {
  const { t } = useLingui();
  const { organisations } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const manageableOrgs = useMemo(
    () =>
      organisations.filter(
        (org) =>
          canExecuteOrganisationAction('MANAGE_ORGANISATION', org.currentOrganisationRole) ||
          org.teams.some((team) => canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)),
      ),
    [organisations],
  );

  const currentOrg = manageableOrgs.find((org) => org.url === currentOrgUrl);

  const hasManageableBillingOrgs = useMemo(
    () => organisations.some((org) => canExecuteOrganisationAction('MANAGE_BILLING', org.currentOrganisationRole)),
    [organisations],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return manageableOrgs;
    }

    return manageableOrgs.filter((org) => org.name.toLowerCase().includes(q));
  }, [manageableOrgs, query]);

  const isBillingEnabled = IS_BILLING_ENABLED();

  const handleSelect = (orgUrl: string) => {
    const destinationOrg = manageableOrgs.find((org) => org.url === orgUrl);

    if (!destinationOrg) {
      return;
    }

    const manageableTeam = destinationOrg.teams.find((team) =>
      canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole),
    );

    const destinationGroups = getSettingsNavGroups({
      organisation: {
        url: destinationOrg.url,
        currentOrganisationRole: destinationOrg.currentOrganisationRole,
        organisationClaim: destinationOrg.organisationClaim,
      },
      team: manageableTeam ? { url: manageableTeam.url, currentTeamRole: manageableTeam.currentTeamRole } : null,
      hasManageableBillingOrgs,
    });

    // The list also contains organisations the user can only reach through a team they
    // manage — for those `getSettingsNavGroups` returns no organisation group, so we land
    // them in the team group instead of on an organisation page they aren't authorised for.
    const destinationGroup = destinationGroups.organisation ?? destinationGroups.team;

    if (!destinationGroup) {
      return;
    }

    setIsOpen(false);

    void navigate(
      computeSwitcherContinuityPath({
        currentPath: pathname,
        destinationPaths: destinationGroup.items.map((item) => item.path),
        fallbackPath: destinationGroup.items[0].path,
      }),
    );
  };

  if (!currentOrg) {
    return null;
  }

  // Resolve an organisation's plan label. Unknown or custom claims (including
  // self-hosted custom claim IDs) fall back to "Custom Plan".
  const getPlanName = (organisationClaimId: string | null) => {
    const planClaim =
      organisationClaimId && organisationClaimId in internalClaims
        ? internalClaims[organisationClaimId as INTERNAL_CLAIM_ID]
        : undefined;

    return planClaim ? t`${planClaim.name} Plan` : t`Custom Plan`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          data-testid="settings-org-switcher-trigger"
          className="flex h-auto w-full items-center justify-start gap-2 rounded-lg border bg-background px-1.5 py-1 hover:bg-muted"
        >
          <AvatarWithText
            className="max-w-none"
            avatarClass="h-8 w-8"
            avatarSrc={formatAvatarUrl(currentOrg.avatarImageId)}
            avatarFallback={currentOrg.name.slice(0, 1).toUpperCase()}
            primaryText={<span className="font-semibold text-muted-foreground">{currentOrg.name}</span>}
            secondaryText={
              isBillingEnabled ? getPlanName(currentOrg.organisationClaim.originalSubscriptionClaimId) : undefined
            }
            rightSideComponent={<ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        data-testid="settings-org-switcher-content"
      >
        {manageableOrgs.length >= SEARCH_THRESHOLD && (
          <div className="border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t`Search organisations…`}
                className="h-8 pl-7"
                data-testid="settings-org-switcher-search"
              />
            </div>
          </div>
        )}

        <ul className="max-h-72 overflow-auto py-1">
          {filtered.map((org) => {
            const isCurrent = org.url === currentOrgUrl;
            return (
              <li key={org.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(org.url)}
                  className={cn('flex w-full items-center px-3 py-2 text-left hover:bg-muted', isCurrent && 'bg-muted')}
                  data-testid={`settings-org-switcher-item-${org.url}`}
                >
                  <AvatarWithText
                    avatarClass="h-8 w-8"
                    avatarSrc={formatAvatarUrl(org.avatarImageId)}
                    avatarFallback={org.name.slice(0, 1).toUpperCase()}
                    primaryText={<span className={cn(isCurrent && 'font-semibold')}>{org.name}</span>}
                    secondaryText={
                      isBillingEnabled ? getPlanName(org.organisationClaim.originalSubscriptionClaimId) : undefined
                    }
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t p-1">
          <Button variant="ghost" asChild className="w-full justify-start" data-testid="settings-org-switcher-create">
            <a href="/settings/organisations?action=add-organisation">
              <PlusIcon className="mr-2 h-4 w-4" />
              <Trans>Create organisation</Trans>
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
