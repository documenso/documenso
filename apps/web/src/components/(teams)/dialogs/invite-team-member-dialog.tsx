'use client';

import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { Download, Import, Mail, PlusCircle, Trash, Upload, Users } from 'lucide-react';
import Papa, { type ParseResult } from 'papaparse';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { TEAM_MEMBER_ROLE_HIERARCHY, TEAM_MEMBER_ROLE_MAP } from '@documenso/lib/constants/teams';
import { TeamMemberRole } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { ZCreateTeamMemberInvitesMutationSchema } from '@documenso/trpc/server/team-router/schema';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
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

const ZImportTeamMemberSchema = z.array(
  z.object({
    email: z.string().email(),
    role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  }),
);

export const InviteTeamMembersDialog = ({
  currentUserTeamRole,
  teamId,
  trigger,
  ...props
}: InviteTeamMembersDialogProps) => {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvFile, setCSVFile] = useState<File>();
  const [invitationType, setInvitationType] = useState('INDIVIDIUAL');

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

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) {
      return;
    }
    const file = e.target.files[0];
    setCSVFile(file);
  };

  const onImport = () => {
    if (!csvFile) {
      return;
    }
    Papa.parse(csvFile, {
      skipEmptyLines: true,
      comments: 'Work email,Job title',
      complete: (results: ParseResult<string[]>) => {
        const members = results.data.map((csv) => {
          const values = csv.map((value, index) => {
            value = value.trim();
            if (index === 1) {
              value = value.toUpperCase();
              console.log(value);
            }
            return value;
          });
          return { email: values[0], role: values[1] as 'ADMIN' | 'MANAGER' | 'MEMBER' };
        });
        try {
          ZImportTeamMemberSchema.parse(members);
          form.setValue('invitations', members);
          setInvitationType('INDIVIDIUAL');
        } catch (error) {
          console.error(error.message);
          toast({
            variant: 'destructive',
            title: 'Something went wrong!',
            description: 'Please check the CSV file and make sure it is according to our format',
          });
        }
      },
    });
  };

  const downloadRecoveryCodes = () => {
    const data = [
      { email: 'lucas@gmail.com', role: 'manager' },
      { email: 'timur@gmail.com', role: 'admin' },
      { email: 'david@gmail.com', role: 'member' },
    ];
    const csvContent =
      'Email address,Role\n' + data.map((row) => `${row.email},${row.role}`).join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv',
    });

    downloadFile({
      filename: 'documenso-team-members-template.csv',
      data: blob,
    });
  };

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger
        onClick={(e) => {
          e.stopPropagation();
          setInvitationType('INDIVIDIUAL');
        }}
        asChild
      >
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
            <Mail size={20} />
            Invite Members
          </Button>
          <Button
            variant={`${invitationType === 'BULK' ? 'secondary' : 'none'}`}
            size="sm"
            className="flex w-1/2 items-center justify-center gap-1"
            onClick={() => setInvitationType('BULK')}
          >
            <Users size={20} /> Bulk Import
          </Button>
        </div>
        {invitationType === 'INDIVIDIUAL' && (
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
        )}
        {invitationType === 'BULK' && (
          <div className="space-y-4">
            <Card gradient className="h-32">
              <CardContent
                className="flex h-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-7 w-7 text-neutral-500" />
                <span className="text-sm text-neutral-500">
                  {csvFile ? csvFile.name : 'Click here to upload'}
                </span>
                <input
                  onChange={onFileInputChange}
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  hidden
                />
              </CardContent>
            </Card>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={downloadRecoveryCodes}>
                <Download className="mr-2 h-4 w-4" />
                Template
              </Button>
              <Button onClick={onImport} disabled={!csvFile}>
                <Import className="mr-2 h-4 w-4" />
                Import
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
