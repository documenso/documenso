import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { TeamMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TEAM_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/teams';
import { EXTENDED_TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams-translations';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { useCurrentTeam } from '~/providers/team';

export type TeamGroupUpdateDialogProps = {
  trigger?: React.ReactNode;
  teamGroupId: string;
  teamGroupName: string;
  teamGroupRole: TeamMemberRole;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateTeamGroupFormSchema = z.object({
  role: z.nativeEnum(TeamMemberRole),
});

type ZUpdateTeamGroupSchema = z.infer<typeof ZUpdateTeamGroupFormSchema>;

export const TeamGroupUpdateDialog = ({
  trigger,
  teamGroupId,
  teamGroupName,
  teamGroupRole,
  ...props
}: TeamGroupUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const team = useCurrentTeam();

  const form = useForm<ZUpdateTeamGroupSchema>({
    resolver: zodResolver(ZUpdateTeamGroupFormSchema),
    defaultValues: {
      role: teamGroupRole,
    },
  });

  const { mutateAsync: updateTeamGroup } = trpc.team.group.update.useMutation();

  const onFormSubmit = async ({ role }: ZUpdateTeamGroupSchema) => {
    try {
      await updateTeamGroup({
        id: teamGroupId,
        data: {
          teamRole: role,
        },
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`You have updated the team group.`),
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to update this team member. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, team.currentTeamRole, teamGroupRole, form, toast]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Update team group</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update team group</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              You are currently updating the <span className="font-bold">{teamGroupName}</span> team
              group.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        {isTeamRoleWithinUserHierarchy(team.currentTeamRole, teamGroupRole) ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset className="flex h-full flex-col" disabled={form.formState.isSubmitting}>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel required>
                        <Trans>Role</Trans>
                      </FormLabel>
                      <FormControl>
                        <Select {...field} onValueChange={field.onChange}>
                          <SelectTrigger className="text-muted-foreground">
                            <SelectValue />
                          </SelectTrigger>

                          <SelectContent className="w-full" position="popper">
                            {TEAM_MEMBER_ROLE_HIERARCHY[team.currentTeamRole].map((role) => (
                              <SelectItem key={role} value={role}>
                                {_(EXTENDED_TEAM_MEMBER_ROLE_MAP[role]) ?? role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="mt-4">
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit" loading={form.formState.isSubmitting}>
                    <Trans>Update</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        ) : (
          <>
            <Alert variant="neutral">
              <AlertDescription className="text-center font-semibold">
                <Trans>You cannot modify a group which has a higher role than you.</Trans>
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                <Trans>Close</Trans>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
