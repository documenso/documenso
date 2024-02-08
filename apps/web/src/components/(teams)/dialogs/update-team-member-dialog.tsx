'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
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
        title: 'Success',
        description: `You have updated ${teamMemberName}.`,
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        description:
          'We encountered an unknown error while attempting to update this team member. Please try again later.',
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
        title: 'You cannot modify a team member who has a higher role than you.',
        variant: 'destructive',
      });
    }
  }, [open, currentUserTeamRole, teamMemberRole, form, toast]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? <Button variant="secondary">Update team member</Button>}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Update team member</DialogTitle>

          <DialogDescription className="mt-4">
            You are currently updating <span className="font-bold">{teamMemberName}.</span>
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
                    <FormLabel required>Role</FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="text-muted-foreground">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent className="w-full" position="popper">
                          {TEAM_MEMBER_ROLE_HIERARCHY[currentUserTeamRole].map((role) => (
                            <SelectItem key={role} value={role}>
                              {TEAM_MEMBER_ROLE_MAP[role] ?? role}
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
                  Cancel
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  Update
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
