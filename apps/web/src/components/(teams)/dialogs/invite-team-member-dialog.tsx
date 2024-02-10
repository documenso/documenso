'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { Mail, PlusCircle, Trash } from 'lucide-react';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { TEAM_MEMBER_ROLE_HIERARCHY, TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import { TeamMemberRole } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamMemberInvitesMutationSchema } from '@documenso/trpc/server/team-router/schema';
import { cn } from '@documenso/ui/lib/utils';
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
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type InviteTeamMembersDialogProps = {
  currentUserTeamRole: TeamMemberRole;
  teamId: number;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZInviteTeamMembersFormSchema = z
  .object({
    invitations: ZCreateTeamMemberInvitesMutationSchema.shape.invitations,
  })
  .refine(
    (schema) => {
      const emails = schema.invitations.map((invitation) => invitation.email.toLowerCase());

      return new Set(emails).size === emails.length;
    },
    // Dirty hack to handle errors when .root is populated for an array type
    { message: 'Members must have unique emails', path: ['members__root'] },
  );

type TInviteTeamMembersFormSchema = z.infer<typeof ZInviteTeamMembersFormSchema>;

export const InviteTeamMembersDialog = ({
  currentUserTeamRole,
  teamId,
  trigger,
  ...props
}: InviteTeamMembersDialogProps) => {
  const [open, setOpen] = useState(false);

  const { toast } = useToast();

  const form = useForm<TInviteTeamMembersFormSchema>({
    resolver: zodResolver(ZInviteTeamMembersFormSchema),
    defaultValues: {
      invitations: [
        {
          email: '',
          role: TeamMemberRole.MEMBER,
        },
      ],
    },
  });

  const {
    append: appendTeamMemberInvite,
    fields: teamMemberInvites,
    remove: removeTeamMemberInvite,
  } = useFieldArray({
    control: form.control,
    name: 'invitations',
  });

  const { mutateAsync: createTeamMemberInvites } = trpc.team.createTeamMemberInvites.useMutation();

  const onAddTeamMemberInvite = () => {
    appendTeamMemberInvite({
      email: '',
      role: TeamMemberRole.MEMBER,
    });
  };

  const onFormSubmit = async ({ invitations }: TInviteTeamMembersFormSchema) => {
    try {
      await createTeamMemberInvites({
        teamId,
        invitations,
      });

      toast({
        title: 'Success',
        description: 'Team invitations have been sent.',
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: 'An unknown error occurred',
        variant: 'destructive',
        description:
          'We encountered an unknown error while attempting to invite team members. Please try again later.',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? <Button variant="secondary">Invite member</Button>}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Invite team members</DialogTitle>

          <DialogDescription className="mt-4">
            An email containing an invitation will be sent to each member.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              {teamMemberInvites.map((teamMemberInvite, index) => (
                <div className="flex w-full flex-row space-x-4" key={teamMemberInvite.id}>
                  <FormField
                    control={form.control}
                    name={`invitations.${index}.email`}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        {index === 0 && <FormLabel required>Email address</FormLabel>}
                        <FormControl>
                          <Input className="bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`invitations.${index}.role`}
                    render={({ field }) => (
                      <FormItem className="w-full">
                        {index === 0 && <FormLabel required>Role</FormLabel>}
                        <FormControl>
                          <Select {...field} onValueChange={field.onChange}>
                            <SelectTrigger className="text-muted-foreground max-w-[200px]">
                              <SelectValue />
                            </SelectTrigger>

                            <SelectContent position="popper">
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

                  <button
                    type="button"
                    className={cn(
                      'justify-left inline-flex h-10 w-10 items-center text-slate-500 hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50',
                      index === 0 ? 'mt-8' : 'mt-0',
                    )}
                    disabled={teamMemberInvites.length === 1}
                    onClick={() => removeTeamMemberInvite(index)}
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>
              ))}

              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-fit"
                onClick={() => onAddTeamMemberInvite()}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                Add more
              </Button>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  {!form.formState.isSubmitting && <Mail className="mr-2 h-4 w-4" />}
                  Invite
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
