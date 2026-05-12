import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ORGANISATION_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/organisations';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import type { TFindOrganisationGroupsResponse } from '@documenso/trpc/server/organisation-router/find-organisation-groups.types';
import { Button } from '@documenso/ui/primitives/button';
import { DataTable, type DataTableColumnDef } from '@documenso/ui/primitives/data-table';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { OrganisationGroupType, OrganisationMemberRole } from '@prisma/client';
import { Loader } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';

import { OrganisationGroupDeleteDialog } from '~/components/dialogs/organisation-group-delete-dialog';
import { GenericErrorLayout } from '~/components/general/generic-error-layout';
import {
  type OrganisationMemberOption,
  OrganisationMembersMultiSelectCombobox,
} from '~/components/general/organisation-members-multiselect-combobox';
import { SettingsHeader } from '~/components/general/settings-header';

import type { Route } from './+types/o.$orgUrl.settings.groups.$id';

export default function OrganisationGroupSettingsPage({ params }: Route.ComponentProps) {
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();

  const groupId = params.id;

  const { data: groupData, isLoading: isLoadingGroup } = trpc.organisation.group.find.useQuery(
    {
      organisationId: organisation.id,
      organisationGroupId: groupId,
      page: 1,
      perPage: 1,
      types: [OrganisationGroupType.CUSTOM],
    },
    {
      enabled: !!organisation.id && !!groupId,
    },
  );

  const group = groupData?.data.find((g) => g.id === groupId);

  if (isLoadingGroup) {
    return (
      <div className="flex items-center justify-center rounded-lg py-32">
        <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Todo: Update UI, currently out of place.
  if (!group) {
    return (
      <GenericErrorLayout
        errorCode={404}
        errorCodeMap={{
          404: {
            heading: msg`Organisation group not found`,
            subHeading: msg`404 Organisation group not found`,
            message: msg`The organisation group you are looking for may have been removed, renamed or may have never existed.`,
          },
        }}
        primaryButton={
          <Button asChild>
            <Link to={`/o/${organisation.url}/settings/groups`}>
              <Trans>Go back</Trans>
            </Link>
          </Button>
        }
        secondaryButton={null}
      />
    );
  }

  return (
    <div>
      <SettingsHeader title={t`Organisation Group Settings`} subtitle={t`Manage your organisation group settings.`}>
        <OrganisationGroupDeleteDialog
          organisationGroupId={groupId}
          organisationGroupName={group.name || ''}
          trigger={
            <Button variant="destructive" title={t`Remove organisation group`}>
              <Trans>Delete</Trans>
            </Button>
          }
        />
      </SettingsHeader>

      <OrganisationGroupForm group={group} />
    </div>
  );
}

const ZUpdateOrganisationGroupFormSchema = z.object({
  name: z.string().min(1, msg`Name is required`.id),
  organisationRole: z.nativeEnum(OrganisationMemberRole),
  memberIds: z.array(z.string()),
});

type TUpdateOrganisationGroupFormSchema = z.infer<typeof ZUpdateOrganisationGroupFormSchema>;

type OrganisationGroupFormOptions = {
  group: TFindOrganisationGroupsResponse['data'][number];
};

const OrganisationGroupForm = ({ group }: OrganisationGroupFormOptions) => {
  const { toast } = useToast();
  const { t } = useLingui();

  const organisation = useCurrentOrganisation();

  const { mutateAsync: updateOrganisationGroup } = trpc.organisation.group.update.useMutation();

  // Track full member details (name/email) keyed by id so chip labels render
  // correctly even after the form has been mounted for a while.
  const [selectedMembers, setSelectedMembers] = useState<OrganisationMemberOption[]>(() =>
    group.members.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
    })),
  );

  const form = useForm<TUpdateOrganisationGroupFormSchema>({
    resolver: zodResolver(ZUpdateOrganisationGroupFormSchema),
    defaultValues: {
      name: group.name || '',
      organisationRole: group.organisationRole,
      memberIds: group.members.map((member) => member.id),
    },
  });

  const onSubmit = async (values: TUpdateOrganisationGroupFormSchema) => {
    try {
      await updateOrganisationGroup({
        id: group.id,
        name: values.name,
        organisationRole: values.organisationRole,
        memberIds: values.memberIds,
      });

      toast({
        title: t`Success`,
        description: t`Group has been updated successfully`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);
      console.error(error);

      toast({
        title: t`An error occurred`,
        description: t`We couldn't update the group. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const teamGroupsColumns = useMemo(() => {
    return [
      {
        header: t`Team`,
        accessorKey: 'name',
      },
      {
        header: t`Team Role`,
        cell: ({ row }) => t(TEAM_MEMBER_ROLE_MAP[row.original.teamRole]),
      },
    ] satisfies DataTableColumnDef<OrganisationGroupFormOptions['group']['teams'][number]>[];
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Group Name</Trans>
              </FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organisationRole"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>
                <Trans>Organisation Role</Trans>
              </FormLabel>
              <FormControl>
                <Select {...field} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent position="popper">
                    {ORGANISATION_MEMBER_ROLE_HIERARCHY[organisation.currentOrganisationRole].map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[role])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
              <FormDescription>
                <Trans>The organisation role that will be applied to all members in this group.</Trans>
              </FormDescription>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="memberIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                <Trans>Members</Trans>
              </FormLabel>
              <FormControl>
                <OrganisationMembersMultiSelectCombobox
                  organisationId={organisation.id}
                  selectedMembers={selectedMembers}
                  onChange={(members) => {
                    setSelectedMembers(members);
                    field.onChange(members.map((member) => member.id));
                  }}
                  className="w-full"
                  dataTestId="group-members-picker"
                />
              </FormControl>
              <FormDescription>
                <Trans>Select the members to include in this group</Trans>
              </FormDescription>
            </FormItem>
          )}
        />

        <div>
          <FormLabel>
            <Trans>Team Assignments</Trans>
          </FormLabel>

          <div className="my-2">
            <DataTable columns={teamGroupsColumns} data={group.teams} />
          </div>

          <FormDescription>
            <Trans>Teams that this organisation group is currently assigned to</Trans>
          </FormDescription>
        </div>

        <div className="flex justify-end">
          <Button type="submit" loading={form.formState.isSubmitting}>
            <Trans>Update</Trans>
          </Button>
        </div>
      </form>
    </Form>
  );
};
