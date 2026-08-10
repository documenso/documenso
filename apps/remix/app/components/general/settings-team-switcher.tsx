import { useSession } from '@documenso/lib/client-only/providers/session';
import { EXTENDED_TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { formatAvatarUrl } from '@documenso/lib/utils/avatars';
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

export type SettingsTeamSwitcherProps = {
  currentOrgUrl: string;
  currentTeamUrl: string | null;
};

export const SettingsTeamSwitcher = ({ currentOrgUrl, currentTeamUrl }: SettingsTeamSwitcherProps) => {
  const { t } = useLingui();
  const { organisations } = useSession();
  const { pathname } = useLocation();

  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const currentOrg = organisations.find((org) => org.url === currentOrgUrl);

  const manageableTeams = useMemo(
    () =>
      currentOrg ? currentOrg.teams.filter((team) => canExecuteTeamAction('MANAGE_TEAM', team.currentTeamRole)) : [],
    [currentOrg],
  );

  const currentTeam = manageableTeams.find((team) => team.url === currentTeamUrl) ?? manageableTeams[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return manageableTeams;
    }

    return manageableTeams.filter((team) => team.name.toLowerCase().includes(q));
  }, [manageableTeams, query]);

  const handleSelect = (teamUrl: string) => {
    const destinationTeam = manageableTeams.find((team) => team.url === teamUrl);

    if (!currentOrg || !destinationTeam) {
      return;
    }

    const destinationGroup = getSettingsNavGroups({
      organisation: {
        url: currentOrg.url,
        currentOrganisationRole: currentOrg.currentOrganisationRole,
        organisationClaim: currentOrg.organisationClaim,
      },
      team: { url: destinationTeam.url, currentTeamRole: destinationTeam.currentTeamRole },
      hasManageableBillingOrgs: false,
    }).team;

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

  if (!currentOrg || !currentTeam) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          data-testid="settings-team-switcher-trigger"
          className="flex h-auto w-full items-center justify-start gap-2 rounded-lg border bg-background px-1.5 py-1 hover:bg-muted"
        >
          <AvatarWithText
            className="max-w-none"
            avatarClass="h-8 w-8"
            avatarSrc={formatAvatarUrl(currentTeam.avatarImageId)}
            avatarFallback={currentTeam.name.slice(0, 1).toUpperCase()}
            primaryText={<span className="font-semibold text-muted-foreground">{currentTeam.name}</span>}
            rightSideComponent={<ChevronsUpDownIcon className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        data-testid="settings-team-switcher-content"
      >
        {manageableTeams.length >= SEARCH_THRESHOLD && (
          <div className="border-b p-2">
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t`Search teams…`}
                className="h-8 pl-7"
                data-testid="settings-team-switcher-search"
              />
            </div>
          </div>
        )}

        <ul className="max-h-72 space-y-1 overflow-auto p-1">
          {filtered.map((team) => {
            const isCurrent = team.url === currentTeam.url;
            return (
              <li key={team.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(team.url)}
                  className={cn(
                    'flex w-full items-center rounded-md px-2 py-2 text-left hover:bg-muted',
                    isCurrent && 'bg-muted',
                  )}
                  data-testid={`settings-team-switcher-item-${team.url}`}
                >
                  <AvatarWithText
                    avatarClass="h-8 w-8"
                    avatarSrc={formatAvatarUrl(team.avatarImageId)}
                    avatarFallback={team.name.slice(0, 1).toUpperCase()}
                    primaryText={<span className={cn(isCurrent && 'font-semibold')}>{team.name}</span>}
                    secondaryText={t(EXTENDED_TEAM_MEMBER_ROLE_MAP[team.currentTeamRole])}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t p-1">
          <Button variant="ghost" asChild className="w-full justify-start" data-testid="settings-team-switcher-create">
            <a href={`/o/${currentOrg.url}/settings/teams?action=add-team`}>
              <PlusIcon className="mr-2 h-4 w-4" />
              <Trans>Create team</Trans>
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
