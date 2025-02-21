import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TemplateDirectLink } from '@prisma/client';
import { TemplateType } from '@prisma/client';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { useSession } from '@documenso/lib/client-only/providers/session';
import { getUserPublicProfile } from '@documenso/lib/server-only/user/get-user-public-profile';
import { trpc } from '@documenso/trpc/react';
import type { FindTemplateRow } from '@documenso/trpc/server/template-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Switch } from '@documenso/ui/primitives/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { ManagePublicTemplateDialog } from '~/components/dialogs/public-profile-template-manage-dialog';
import type { TPublicProfileFormSchema } from '~/components/forms/public-profile-form';
import { PublicProfileForm } from '~/components/forms/public-profile-form';
import { SettingsHeader } from '~/components/general/settings-header';
import { SettingsPublicProfileTemplatesTable } from '~/components/tables/settings-public-profile-templates-table';
import { useOptionalCurrentTeam } from '~/providers/team';

import type { Route } from './+types/public-profile';

type DirectTemplate = FindTemplateRow & {
  directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
};

const userProfileText = {
  settingsTitle: msg`Public Profile`,
  settingsSubtitle: msg`You can choose to enable or disable your profile for public view.`,
  templatesTitle: msg`My templates`,
  templatesSubtitle: msg`Show templates in your public profile for your audience to sign and get started quickly`,
};

const teamProfileText = {
  settingsTitle: msg`Team Public Profile`,
  settingsSubtitle: msg`You can choose to enable or disable your team profile for public view.`,
  templatesTitle: msg`Team templates`,
  templatesSubtitle: msg`Show templates in your team public profile for your audience to sign and get started quickly`,
};

export async function loader({ request }: Route.LoaderArgs) {
  const { user } = await getSession(request);

  const { profile } = await getUserPublicProfile({
    userId: user.id,
  });

  return { profile };
}

export default function PublicProfilePage({ loaderData }: Route.ComponentProps) {
  const { profile } = loaderData;

  const { _ } = useLingui();
  const { toast } = useToast();

  const { user, refreshSession } = useSession();
  const team = useOptionalCurrentTeam();

  const [isPublicProfileVisible, setIsPublicProfileVisible] = useState(profile.enabled);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const { data } = trpc.template.findTemplates.useQuery({
    perPage: 100,
  });

  const { mutateAsync: updateUserProfile, isPending: isUpdatingUserProfile } =
    trpc.profile.updatePublicProfile.useMutation();

  const { mutateAsync: updateTeamProfile, isPending: isUpdatingTeamProfile } =
    trpc.team.updateTeamPublicProfile.useMutation();

  const isUpdating = isUpdatingUserProfile || isUpdatingTeamProfile;
  const profileText = team ? teamProfileText : userProfileText;

  const enabledPrivateDirectTemplates = useMemo(
    () =>
      (data?.data ?? []).filter(
        (template): template is DirectTemplate =>
          template.directLink?.enabled === true && template.type !== TemplateType.PUBLIC,
      ),
    [data],
  );

  const onProfileUpdate = async (data: TPublicProfileFormSchema) => {
    if (team) {
      await updateTeamProfile({
        teamId: team.id,
        ...data,
      });
    } else {
      await updateUserProfile(data);

      // Need to refresh session because we're editing the user's profile.
      await refreshSession();
    }

    if (data.enabled === undefined && !isPublicProfileVisible) {
      setIsTooltipOpen(true);
    }
  };

  const togglePublicProfileVisibility = async (isVisible: boolean) => {
    setIsTooltipOpen(false);

    if (isUpdating) {
      return;
    }

    if (isVisible && !user.url) {
      toast({
        title: _(msg`You must set a profile URL before enabling your public profile.`),
        variant: 'destructive',
      });

      return;
    }

    setIsPublicProfileVisible(isVisible);

    try {
      await onProfileUpdate({
        enabled: isVisible,
      });
    } catch {
      toast({
        title: _(msg`Something went wrong`),
        description: _(msg`We were unable to set your public profile to public. Please try again.`),
        variant: 'destructive',
      });

      setIsPublicProfileVisible(!isVisible);
    }
  };

  useEffect(() => {
    setIsPublicProfileVisible(profile.enabled);
  }, [profile.enabled]);

  return (
    <div className="max-w-2xl">
      <SettingsHeader
        title={_(profileText.settingsTitle)}
        subtitle={_(profileText.settingsSubtitle)}
      >
        <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'text-muted-foreground/50 flex flex-row items-center justify-center space-x-2 text-xs',
                {
                  '[&>*:first-child]:text-muted-foreground': !isPublicProfileVisible,
                  '[&>*:last-child]:text-muted-foreground': isPublicProfileVisible,
                },
              )}
            >
              <span>
                <Trans>Hide</Trans>
              </span>
              <Switch
                disabled={isUpdating}
                checked={isPublicProfileVisible}
                onCheckedChange={togglePublicProfileVisibility}
              />
              <span>
                <Trans>Show</Trans>
              </span>
            </div>
          </TooltipTrigger>

          <TooltipContent className="text-muted-foreground max-w-[40ch] space-y-2 py-2">
            {isPublicProfileVisible ? (
              <>
                <p>
                  <Trans>
                    Profile is currently <strong>visible</strong>.
                  </Trans>
                </p>

                <p>
                  <Trans>Toggle the switch to hide your profile from the public.</Trans>
                </p>
              </>
            ) : (
              <>
                <p>
                  <Trans>
                    Profile is currently <strong>hidden</strong>.
                  </Trans>
                </p>

                <p>
                  <Trans>Toggle the switch to show your profile to the public.</Trans>
                </p>
              </>
            )}
          </TooltipContent>
        </Tooltip>
      </SettingsHeader>

      <PublicProfileForm
        profileUrl={team ? team.url : user.url}
        teamUrl={team?.url}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
      />

      <div className="mt-4">
        <SettingsHeader
          title={_(profileText.templatesTitle)}
          subtitle={_(profileText.templatesSubtitle)}
          hideDivider={true}
          className="mt-8 [&>*>h3]:text-base"
        >
          <ManagePublicTemplateDialog
            directTemplates={enabledPrivateDirectTemplates}
            trigger={
              <Button variant="outline">
                <Trans>Link template</Trans>
              </Button>
            }
          />
        </SettingsHeader>

        <div className="mt-6">
          <SettingsPublicProfileTemplatesTable />
        </div>
      </div>
    </div>
  );
}
