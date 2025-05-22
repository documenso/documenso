import { useEffect, useMemo, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import type { TemplateDirectLink } from '@prisma/client';
import { TemplateType } from '@prisma/client';

import { getSession } from '@documenso/auth/server/lib/utils/get-session';
import { getTeamByUrl } from '@documenso/lib/server-only/team/get-team';
import { getTeamPublicProfile } from '@documenso/lib/server-only/team/get-team-public-profile';
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
import { useCurrentTeam } from '~/providers/team';

import type { Route } from './+types/settings.public-profile';

type DirectTemplate = FindTemplateRow & {
  directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
};

// Todo: This can be optimized.
export async function loader({ request, params }: Route.LoaderArgs) {
  const session = await getSession(request);

  const team = await getTeamByUrl({
    userId: session.user.id,
    teamUrl: params.teamUrl,
  });

  const { profile } = await getTeamPublicProfile({
    userId: session.user.id,
    teamId: team.id,
  });

  return {
    profile,
  };
}

export default function PublicProfilePage({ loaderData }: Route.ComponentProps) {
  const { profile } = loaderData;

  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const [isPublicProfileVisible, setIsPublicProfileVisible] = useState(profile.enabled);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const { data } = trpc.template.findTemplates.useQuery({
    perPage: 100,
  });

  const { mutateAsync: updateTeamProfile, isPending: isUpdatingTeamProfile } =
    trpc.team.updateTeamPublicProfile.useMutation();

  const isUpdating = isUpdatingTeamProfile;

  const enabledPrivateDirectTemplates = useMemo(
    () =>
      (data?.data ?? []).filter(
        (template): template is DirectTemplate =>
          template.directLink?.enabled === true && template.type !== TemplateType.PUBLIC,
      ),
    [data],
  );

  const onProfileUpdate = async (data: TPublicProfileFormSchema) => {
    await updateTeamProfile({
      teamId: team.id,
      ...data,
    });

    if (data.enabled === undefined && !isPublicProfileVisible) {
      setIsTooltipOpen(true);
    }
  };

  const togglePublicProfileVisibility = async (isVisible: boolean) => {
    setIsTooltipOpen(false);

    if (isUpdating) {
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
        title={_(msg`Team Public Profile`)}
        subtitle={_(msg`You can choose to enable or disable your team profile for public view.`)}
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
        profileUrl={team.url}
        teamUrl={team.url}
        profile={profile}
        onProfileUpdate={onProfileUpdate}
      />

      <div className="mt-4">
        <SettingsHeader
          title={_(msg`Team templates`)}
          subtitle={_(
            msg`Show templates in your team public profile for your audience to sign and get started quickly`,
          )}
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
