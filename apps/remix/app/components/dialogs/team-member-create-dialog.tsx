import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

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
import { MultiSelectCombobox } from '@documenso/ui/primitives/multi-select-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type TeamMemberCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZAddTeamMembersFormSchema = z.object({
  members: z.array(
    z.object({
      organisationMemberId: z.string(),
      teamRole: z.nativeEnum(TeamMemberRole),
    }),
  ),
});

type TAddTeamMembersFormSchema = z.infer<typeof ZAddTeamMembersFormSchema>;

export const TeamMemberCreateDialog = ({ trigger, ...props }: TeamMemberCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'SELECT' | 'MEMBERS'>('SELECT');

  const { t } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const form = useForm<TAddTeamMembersFormSchema>({
    resolver: zodResolver(ZAddTeamMembersFormSchema),
    defaultValues: {
      members: [],
    },
  });

  const { mutateAsync: createTeamMembers } = trpc.team.member.createMany.useMutation();

  const organisationMemberQuery = trpc.organisation.member.find.useQuery({
    organisationId: team.organisationId,
  });

  const teamMemberQuery = trpc.team.member.find.useQuery({
    teamId: team.id,
  });

  const avaliableOrganisationMembers = useMemo(() => {
    const organisationMembers = organisationMemberQuery.data?.data ?? [];
    const teamMembers = teamMemberQuery.data?.data ?? [];

    return organisationMembers.filter(
      (member) => !teamMembers.some((teamMember) => teamMember.id === member.id),
    );
  }, [organisationMemberQuery, teamMemberQuery]);

  const onFormSubmit = async ({ members }: TAddTeamMembersFormSchema) => {
    try {
      await createTeamMembers({
        teamId: team.id,
        organisationMembers: members,
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
          <Trans>Add members</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent hideClose={true} position="center">
        {match(step)
          .with('SELECT', () => (
            <DialogHeader>
              <DialogTitle>
                <Trans>Add members</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Select members or groups of members to add to the team.</Trans>
              </DialogDescription>
            </DialogHeader>
          ))
          .with('MEMBERS', () => (
            <DialogHeader>
              <DialogTitle>
                <Trans>Add members roles</Trans>
              </DialogTitle>

              <DialogDescription>
                <Trans>Configure the team roles for each member</Trans>
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
                    name="members"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Members</Trans>
                        </FormLabel>

                        <FormControl>
                          <MultiSelectCombobox
                            options={avaliableOrganisationMembers.map((member) => ({
                              label: member.name,
                              value: member.id,
                            }))}
                            loading={organisationMemberQuery.isLoading}
                            selectedValues={field.value.map(
                              (member) => member.organisationMemberId,
                            )}
                            onChange={(value) => {
                              field.onChange(
                                value.map((organisationMemberId) => ({
                                  organisationMemberId,
                                  teamRole:
                                    field.value.find(
                                      (member) =>
                                        member.organisationMemberId === organisationMemberId,
                                    )?.teamRole || TeamMemberRole.MEMBER,
                                })),
                              );
                            }}
                            className="bg-background w-full"
                            emptySelectionPlaceholder={t`Select members`}
                          />
                        </FormControl>

                        <FormDescription>
                          <Trans>Select members to add to this team</Trans>
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
                      disabled={form.getValues('members').length === 0}
                      onClick={() => {
                        setStep('MEMBERS');
                      }}
                    >
                      <Trans>Next</Trans>
                    </Button>
                  </DialogFooter>
                </>
              )}

              {step === 'MEMBERS' && (
                <>
                  <div className="custom-scrollbar -m-1 max-h-[60vh] space-y-4 overflow-y-auto p-1">
                    {form.getValues('members').map((member, index) => (
                      <div className="flex w-full flex-row space-x-4" key={index}>
                        <div className="w-full space-y-2">
                          {index === 0 && (
                            <FormLabel>
                              <Trans>Member</Trans>
                            </FormLabel>
                          )}
                          <Input
                            readOnly
                            className="bg-background"
                            value={
                              organisationMemberQuery.data?.data.find(
                                ({ id }) => id === member.organisationMemberId,
                              )?.name || ''
                            }
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name={`members.${index}.teamRole`}
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
                                    {TEAM_MEMBER_ROLE_HIERARCHY[team.currentTeamRole].map(
                                      (role) => (
                                        <SelectItem key={role} value={role}>
                                          {t(TEAM_MEMBER_ROLE_MAP[role]) ?? role}
                                        </SelectItem>
                                      ),
                                    )}
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
                      <Trans>Add Members</Trans>
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
