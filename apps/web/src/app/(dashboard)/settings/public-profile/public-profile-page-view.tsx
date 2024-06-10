'use client';

import { useEffect, useMemo, useState } from 'react';

import type { FindTemplateRow } from '@documenso/lib/server-only/template/find-templates';
import type {
  Team,
  TeamProfile,
  TemplateDirectLink,
  User,
  UserProfile,
} from '@documenso/prisma/client';
import { TemplateType } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Switch } from '@documenso/ui/primitives/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SettingsHeader } from '~/components/(dashboard)/settings/layout/header';
import type { TPublicProfileFormSchema } from '~/components/forms/public-profile-form';
import { PublicProfileForm } from '~/components/forms/public-profile-form';
import { ManagePublicTemplateDialog } from '~/components/templates/manage-public-template-dialog';

import { PublicTemplatesDataTable } from './public-templates-data-table';

export type PublicProfilePageViewOptions = {
  user: User;
  team?: Team;
  profile: UserProfile | TeamProfile;
};

type DirectTemplate = FindTemplateRow & {
  directLink: Pick<TemplateDirectLink, 'token' | 'enabled'>;
};

const userProfileText = {
  settingsTitle: 'Public Profile',
  settingsSubtitle: 'You can choose to enable or disable your profile for public view.',
  templatesTitle: 'My templates',
  templatesSubtitle:
    'Show templates in your public profile for your audience to sign and get started quickly',
};

const teamProfileText = {
  settingsTitle: 'Team Public Profile',
  settingsSubtitle: 'You can choose to enable or disable your team profile for public view.',
  templatesTitle: 'Team templates',
  templatesSubtitle:
    'Show templates in your team public profile for your audience to sign and get started quickly',
};

export const PublicProfilePageView = ({ user, team, profile }: PublicProfilePageViewOptions) => {
  const { toast } = useToast();

  const [isPublicProfileVisible, setIsPublicProfileVisible] = useState(profile.enabled);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const { data } = trpc.template.findTemplates.useQuery({
    perPage: 100,
    teamId: team?.id,
  });

  const { mutateAsync: updateUserProfile, isLoading: isUpdatingUserProfile } =
    trpc.profile.updatePublicProfile.useMutation();

  const { mutateAsync: updateTeamProfile, isLoading: isUpdatingTeamProfile } =
    trpc.team.updateTeamPublicProfile.useMutation();

  const isUpdating = isUpdatingUserProfile || isUpdatingTeamProfile;
  const profileText = team ? teamProfileText : userProfileText;

  const enabledPrivateDirectTemplates = useMemo(
    () =>
      (data?.templates ?? []).filter(
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
        title: 'You must set a profile URL before enabling your public profile.',
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
        title: 'Something went wrong',
        description: 'We were unable to set your public profile to public. Please try again.',
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
      <SettingsHeader title={profileText.settingsTitle} subtitle={profileText.settingsSubtitle}>
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
              <span>Hide</span>
              <Switch
                disabled={isUpdating}
                checked={isPublicProfileVisible}
                onCheckedChange={togglePublicProfileVisibility}
              />
              <span>Show</span>
            </div>
          </TooltipTrigger>

          <TooltipContent className="text-muted-foreground max-w-[40ch] space-y-2 py-2">
            {isPublicProfileVisible ? (
              <>
                <p>
                  Profile is currently <strong>visible</strong>.
                </p>

                <p>Toggle the switch to hide your profile from the public.</p>
              </>
            ) : (
              <>
                <p>
                  Profile is currently <strong>hidden</strong>.
                </p>

                <p>Toggle the switch to show your profile to the public.</p>
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
          title={profileText.templatesTitle}
          subtitle={profileText.templatesSubtitle}
          hideDivider={true}
          className="mt-8 [&>*>h3]:text-base"
        >
          <ManagePublicTemplateDialog
            directTemplates={enabledPrivateDirectTemplates}
            trigger={<Button variant="outline">Link template</Button>}
          />
        </SettingsHeader>

        <div className="mt-6">
          <PublicTemplatesDataTable />
        </div>
      </div>
    </div>
  );
};
