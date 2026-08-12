import { TEAM_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/teams';
import { TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
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
import { Trans, useLingui } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import {
  type OrganisationGroupOption,
  OrganisationGroupsMultiSelectCombobox,
} from '~/components/general/organisation-groups-multiselect-combobox';
import { useCurrentTeam } from '~/providers/team';

export type TeamGroupCreateDialogProps = Omit<DialogPrimitive.DialogProps, 'children'>;

const ZAddTeamMembersFormSchema = z.object({
  groups: z.array(
    z.object({
      organisationGroupId: z.string(),
      teamRole: z.nativeEnum(TeamMemberRole),
    }),
  ),
});

type TAddTeamMembersFormSchema = z.infer<typeof ZAddTeamMembersFormSchema>;

export const TeamGroupCreateDialog = ({ ...props }: TeamGroupCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'SELECT' | 'ROLES'>('SELECT');
  const [selectedGroups, setSelectedGroups] = useState<OrganisationGroupOption[]>([]);

  const { t } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const form = useForm<TAddTeamMembersFormSchema>({
    resolver: zodResolver(ZAddTeamMembersFormSchema),
    defaultValues: {
      groups: [],
    },
  });

  const { mutateAsync: createTeamGroups } = trpc.team.group.createMany.useMutation();

  const onFormSubmit = async ({ groups }: TAddTeamMembersFormSchema) => {
    try {
      await createTeamGroups({
        teamId: team.id,
        groups,
      });

      toast({
        title: t`Success`,
        description: t`Team members have been added.`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to add team members. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
      setStep('SELECT');
      setSelectedGroups([]);
    }
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      // Disable automatic onOpenChange events to prevent dialog from closing if auser 'accidentally' clicks the overlay.
      // Since it would be annoying to redo the whole process.
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <Trans>Add groups</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent hideClose={true} position="center">
        {match(step)
          .with('SELECT', () => (
            <DialogHeader>
              <DialogTitle>
                <Trans>Add groups</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Select groups of members to add to the team.</Trans>
              </DialogDescription>
            </DialogHeader>
          ))
          .with('ROLES', () => (
            <DialogHeader>
              <DialogTitle>
                <Trans>Add group roles</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Configure the team roles for each group</Trans>
              </DialogDescription>
            </DialogHeader>
          ))
          .exhaustive()}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={form.formState.isSubmitting}>
              {step === 'SELECT' && (
                <>
                  <FormField
                    control={form.control}
                    name="groups"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Groups</Trans>
                        </FormLabel>

                        <FormControl>
                          <OrganisationGroupsMultiSelectCombobox
                            organisationId={team.organisationId}
                            selectedGroups={selectedGroups}
                            excludeTeamId={team.id}
                            onChange={(groups) => {
                              setSelectedGroups(groups);
                              field.onChange(
                                groups.map((group) => ({
                                  organisationGroupId: group.id,
                                  teamRole:
                                    field.value.find((value) => value.organisationGroupId === group.id)?.teamRole ||
                                    TeamMemberRole.MEMBER,
                                })),
                              );
                            }}
                            className="w-full bg-background"
                            dataTestId="team-groups-picker"
                          />
                        </FormControl>

                        <FormDescription>
                          <Trans>Select groups to add to this team</Trans>
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                      <Trans>Cancel</Trans>
                    </Button>

                    <Button
                      type="button"
                      disabled={form.getValues('groups').length === 0}
                      onClick={() => {
                        setStep('ROLES');
                      }}
                    >
                      <Trans>Next</Trans>
                    </Button>
                  </DialogFooter>
                </>
              )}

              {step === 'ROLES' && (
                <>
                  <div className="custom-scrollbar -m-1 max-h-[60vh] space-y-4 overflow-y-auto p-1">
                    {form.getValues('groups').map((group, index) => (
                      <div className="flex w-full flex-row space-x-4" key={index}>
                        <div className="w-full space-y-2">
                          {index === 0 && (
                            <FormLabel>
                              <Trans>Group</Trans>
                            </FormLabel>
                          )}
                          <Input
                            readOnly
                            className="bg-background"
                            value={
                              selectedGroups.find(({ id }) => id === group.organisationGroupId)?.name ||
                              t`Untitled Group`
                            }
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`groups.${index}.teamRole`}
                          render={({ field }) => (
                            <FormItem className="w-full">
                              {index === 0 && (
                                <FormLabel required>
                                  <Trans>Team Role</Trans>
                                </FormLabel>
                              )}
                              <FormControl>
                                <Select {...field} onValueChange={field.onChange}>
                                  <SelectTrigger className="text-muted-foreground">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent position="popper">
                                    {TEAM_MEMBER_ROLE_HIERARCHY[team.currentTeamRole].map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {t(TEAM_MEMBER_ROLE_MAP[role]) ?? role}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    ))}
                  </div>

                  <DialogFooter className="mt-4">
                    <Button type="button" variant="secondary" onClick={() => setStep('SELECT')}>
                      <Trans>Back</Trans>
                    </Button>

                    <Button type="submit" loading={form.formState.isSubmitting}>
                      <Trans>Create Groups</Trans>
                    </Button>
                  </DialogFooter>
                </>
              )}
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
