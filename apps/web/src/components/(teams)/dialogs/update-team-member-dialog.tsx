'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TEAM_MEMBER_ROLE_HIERARCHY, TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import { isTeamRoleWithinUserHierarchy } from '@documenso/lib/utils/teams';
import { TeamMemberRole } from '@documenso/prisma/client';
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

export type UpdateTeamMemberDialogProps = {
  currentUserTeamRole: TeamMemberRole;
  trigger?: React.ReactNode;
  teamId: number;
  teamMemberId: number;
  teamMemberName: string;
  teamMemberRole: TeamMemberRole;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateTeamMemberFormSchema = z.object({
  role: z.nativeEnum(TeamMemberRole),
});

type ZUpdateTeamMemberSchema = z.infer<typeof ZUpdateTeamMemberFormSchema>;

export const UpdateTeamMemberDialog = ({
  currentUserTeamRole,
  trigger,
  teamId,
  teamMemberId,
  teamMemberName,
  teamMemberRole,
  ...props
}: UpdateTeamMemberDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm<ZUpdateTeamMemberSchema>({
    resolver: zodResolver(ZUpdateTeamMemberFormSchema),
    defaultValues: {
      role: teamMemberRole,
    },
  });

  const { mutateAsync: updateTeamMember } = trpc.team.updateTeamMember.useMutation();

  const onFormSubmit = async ({ role }: ZUpdateTeamMemberSchema) => {
    try {
      await updateTeamMember({
        teamId,
        teamMemberId,
        data: {
          role,
        },
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`You have updated ${teamMemberName}.`),
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

    if (!isTeamRoleWithinUserHierarchy(currentUserTeamRole, teamMemberRole)) {
      setOpen(false);

      toast({
        title: _(msg`You cannot modify a team member who has a higher role than you.`),
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserTeamRole, teamMemberRole, form, toast]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Update team member</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update team member</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are currently updating <span className="font-bold">{teamMemberName}.</span>
            </Trans>
          </DialogDescription>
        </DialogHeader>

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
                          {TEAM_MEMBER_ROLE_HIERARCHY[currentUserTeamRole].map((role) => (
                            <SelectItem key={role} value={role}>
                              {_(TEAM_MEMBER_ROLE_MAP[role]) ?? role}
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
      </DialogContent>
    </Dialog>
  );
};
