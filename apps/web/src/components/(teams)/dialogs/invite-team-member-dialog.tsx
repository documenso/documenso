'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { FileUp, Mail, User, Users } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { TEAM_MEMBER_ROLE_HIERARCHY, TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
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
import { Input } from '@documenso/ui/primitives/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type Invitations = {
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
}[];

export type InviteTeamMembersDialogProps = {
  currentUserTeamRole: TeamMemberRole;
  teamId: number;
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZInviteTeamMembersFormSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  email: z.union([z.string().email(), z.array(z.string().email())]).refine(
    (value) => {
      if (Array.isArray(value)) {
        const lowercaseEmails = value.map((email) => email.toLowerCase());
        return new Set(lowercaseEmails).size === lowercaseEmails.length;
      } else {
        return true;
      }
    },
    { message: 'All email addresses must be unique' },
  ),
});
type TInviteTeamMembersFormSchema = z.infer<typeof ZInviteTeamMembersFormSchema>;

export const InviteTeamMembersDialog = ({
  currentUserTeamRole,
  teamId,
  trigger,
  ...props
}: InviteTeamMembersDialogProps) => {
  const [open, setOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [invitationType, setInvitationType] = useState('INDIVIDIUAL');

  const { toast } = useToast();

  const form = useForm<TInviteTeamMembersFormSchema>({
    resolver: zodResolver(ZInviteTeamMembersFormSchema),
    defaultValues: {
      email: '' || [''],
      role: TeamMemberRole.MEMBER,
    },
  });

  const { mutateAsync: createTeamMemberInvites } = trpc.team.createTeamMemberInvites.useMutation();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) {
      return;
    }
    const file = e.target.files[0];

    if (file) {
      const reader = new FileReader();
      const emailRegex = /^([A-Z0-9_+-]+\.?)*[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;
      reader.onload = (e) => {
        const contents = e?.target?.result as string;
        const lines = contents.split('\n');
        const validEmails = [];
        for (const line of lines) {
          const columns = line.split(/,|;|\|| /);
          for (const column of columns) {
            const email = column.trim().toLowerCase();

            if (emailRegex.test(email)) {
              validEmails.push(email);
              break;
            }
          }
        }

        form.setValue('email', validEmails);
      };

      reader.readAsText(file);
    }
  };

  const onFormSubmit = async ({ role, email }: TInviteTeamMembersFormSchema) => {
    try {
      let invitations: Invitations;
      if (Array.isArray(email)) {
        invitations = email.map((data) => ({ role, email: data }));
      } else {
        invitations = [{ role, email }];
      }
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
        <div className="border-input ring-offset-background flex w-full justify-around rounded-md border">
          <Button
            variant={`${invitationType === 'INDIVIDIUAL' ? 'secondary' : 'none'}`}
            size="sm"
            className="flex w-1/2 items-center justify-center gap-1"
            onClick={() => setInvitationType('INDIVIDIUAL')}
          >
            <User size={20} />
            Individual Invitation
          </Button>
          <Button
            variant={`${invitationType === 'BULK' ? 'secondary' : 'none'}`}
            size="sm"
            className="flex w-1/2 items-center justify-center gap-1"
            onClick={() => setInvitationType('BULK')}
          >
            <Users size={20} /> Bulk Invitation
          </Button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              {invitationType === 'INDIVIDIUAL' && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel required>Email address</FormLabel>
                      <FormControl>
                        <Input className="bg-background" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              {invitationType === 'BULK' && (
                <div className="flex h-full flex-col space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field: { onChange, value } }) => (
                      <FormItem className="w-full">
                        <FormLabel required>Email address</FormLabel>
                        <FormControl>
                          <Textarea
                            className="bg-background placeholder:text-muted-foreground/50"
                            rows={4}
                            autoCorrect="off"
                            placeholder="timur@ercan.com, lucas@smith.com"
                            value={value}
                            onChange={(e) => {
                              const targetValues = e.target.value.split(/[\n,]/);
                              const emails =
                                targetValues.length === 1
                                  ? targetValues[0].trim().toLocaleLowerCase()
                                  : targetValues.map((email) => email.trim().toLocaleLowerCase());

                              return onChange(emails);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (uploadRef.current) {
                        uploadRef.current.click();
                      }
                    }}
                    variant="secondary"
                    className="flex gap-1"
                  >
                    <FileUp size={18} /> <p>Upload a .csv file</p>
                  </Button>
                  <Input
                    ref={uploadRef}
                    hidden
                    type="file"
                    accept=".csv"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </div>
              )}
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
