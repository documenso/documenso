import { useEffect, useRef, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { Download, Mail, MailIcon, PlusCircle, Trash, Upload, UsersIcon } from 'lucide-react';
import Papa, { type ParseResult } from 'papaparse';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ORGANISATION_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/organisations';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationMemberInvitesRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation-member-invites.types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@documenso/ui/primitives/tabs';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type OrganisationMemberInviteDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZInviteOrganisationMembersFormSchema = z
  .object({
    invitations: ZCreateOrganisationMemberInvitesRequestSchema.shape.invitations,
  })
  // Display exactly which rows are duplicates.
  .superRefine((items, ctx) => {
    const uniqueEmails = new Map<string, number>();

    for (const [index, invitation] of items.invitations.entries()) {
      const email = invitation.email.toLowerCase();

      const firstFoundIndex = uniqueEmails.get(email);

      if (firstFoundIndex === undefined) {
        uniqueEmails.set(email, index);
        continue;
      }

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emails must be unique',
        path: ['invitations', index, 'email'],
      });

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emails must be unique',
        path: ['invitations', firstFoundIndex, 'email'],
      });
    }
  });

type TInviteOrganisationMembersFormSchema = z.infer<typeof ZInviteOrganisationMembersFormSchema>;

type TabTypes = 'INDIVIDUAL' | 'BULK';

const ZImportOrganisationMemberSchema = z.array(
  z.object({
    email: z.string().email(),
    organisationRole: z.nativeEnum(OrganisationMemberRole),
  }),
);

export const OrganisationMemberInviteDialog = ({
  trigger,
  ...props
}: OrganisationMemberInviteDialogProps) => {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [invitationType, setInvitationType] = useState<TabTypes>('INDIVIDUAL');

  const { _ } = useLingui();
  const { toast } = useToast();

  const organisation = useCurrentOrganisation();

  const form = useForm<TInviteOrganisationMembersFormSchema>({
    resolver: zodResolver(ZInviteOrganisationMembersFormSchema),
    defaultValues: {
      invitations: [
        {
          email: '',
          organisationRole: OrganisationMemberRole.MEMBER,
        },
      ],
    },
  });

  const {
    append: appendOrganisationMemberInvite,
    fields: organisationMemberInvites,
    remove: removeOrganisationMemberInvite,
  } = useFieldArray({
    control: form.control,
    name: 'invitations',
  });

  const { mutateAsync: createOrganisationMemberInvites } =
    trpc.organisation.member.invite.createMany.useMutation();

  const onAddOrganisationMemberInvite = () => {
    appendOrganisationMemberInvite({
      email: '',
      organisationRole: OrganisationMemberRole.MEMBER,
    });
  };

  const onFormSubmit = async ({ invitations }: TInviteOrganisationMembersFormSchema) => {
    try {
      await createOrganisationMemberInvites({
        organisationId: organisation.id,
        invitations,
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`Organisation invitations have been sent.`),
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to invite organisation members. Please try again later.`,
        ),
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
      setInvitationType('INDIVIDUAL');
    }
  }, [open, form]);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) {
      return;
    }

    const csvFile = e.target.files[0];

    Papa.parse(csvFile, {
      skipEmptyLines: true,
      comments: 'Work email,Job title',
      complete: (results: ParseResult<string[]>) => {
        const members = results.data.map((row) => {
          const [email, role] = row;

          return {
            email: email.trim(),
            organisationRole: role.trim().toUpperCase(),
          };
        });

        // Remove the first row if it contains the headers.
        if (members.length > 1 && members[0].organisationRole.toUpperCase() === 'ROLE') {
          members.shift();
        }

        try {
          const importedInvitations = ZImportOrganisationMemberSchema.parse(members);

          form.setValue('invitations', importedInvitations);
          form.clearErrors('invitations');

          setInvitationType('INDIVIDUAL');
        } catch (err) {
          console.error(err);

          toast({
            title: _(msg`Something went wrong`),
            description: _(
              msg`Please check the CSV file and make sure it is according to our format`,
            ),
            variant: 'destructive',
          });
        }
      },
    });
  };

  const downloadTemplate = () => {
    const data = [
      { email: 'admin@documenso.com', role: 'Admin' },
      { email: 'manager@documenso.com', role: 'Manager' },
      { email: 'member@documenso.com', role: 'Member' },
    ];

    const csvContent =
      'Email address,Role\n' + data.map((row) => `${row.email},${row.role}`).join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv',
    });

    downloadFile({
      filename: 'documenso-organisation-member-invites-template.csv',
      data: blob,
    });
  };

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Invite member</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Invite organisation members</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>An email containing an invitation will be sent to each member.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Tabs
          defaultValue="INDIVIDUAL"
          value={invitationType}
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          onValueChange={(value) => setInvitationType(value as TabTypes)}
        >
          <TabsList className="w-full">
            <TabsTrigger value="INDIVIDUAL" className="hover:text-foreground w-full">
              <MailIcon size={20} className="mr-2" />
              <Trans>Invite Members</Trans>
            </TabsTrigger>

            <TabsTrigger value="BULK" className="hover:text-foreground w-full">
              <UsersIcon size={20} className="mr-2" /> <Trans>Bulk Import</Trans>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="INDIVIDUAL">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onFormSubmit)}>
                <fieldset
                  className="flex h-full flex-col space-y-4"
                  disabled={form.formState.isSubmitting}
                >
                  <div className="custom-scrollbar -m-1 max-h-[60vh] space-y-4 overflow-y-auto p-1">
                    {organisationMemberInvites.map((organisationMemberInvite, index) => (
                      <div
                        className="flex w-full flex-row space-x-4"
                        key={organisationMemberInvite.id}
                      >
                        <FormField
                          control={form.control}
                          name={`invitations.${index}.email`}
                          render={({ field }) => (
                            <FormItem className="w-full">
                              {index === 0 && (
                                <FormLabel required>
                                  <Trans>Email address</Trans>
                                </FormLabel>
                              )}
                              <FormControl>
                                <Input className="bg-background" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`invitations.${index}.organisationRole`}
                          render={({ field }) => (
                            <FormItem className="w-full">
                              {index === 0 && (
                                <FormLabel required>
                                  <Trans>Organisation Role</Trans>
                                </FormLabel>
                              )}
                              <FormControl>
                                <Select {...field} onValueChange={field.onChange}>
                                  <SelectTrigger className="text-muted-foreground max-w-[200px]">
                                    <SelectValue />
                                  </SelectTrigger>

                                  <SelectContent position="popper">
                                    {ORGANISATION_MEMBER_ROLE_HIERARCHY[
                                      organisation.currentOrganisationRole
                                    ].map((role) => (
                                      <SelectItem key={role} value={role}>
                                        {_(ORGANISATION_MEMBER_ROLE_MAP[role]) ?? role}
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
                          disabled={organisationMemberInvites.length === 1}
                          onClick={() => removeOrganisationMemberInvite(index)}
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => onAddOrganisationMemberInvite()}
                  >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    <Trans>Add more</Trans>
                  </Button>

                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                      <Trans>Cancel</Trans>
                    </Button>

                    <Button type="submit" loading={form.formState.isSubmitting}>
                      {!form.formState.isSubmitting && <Mail className="mr-2 h-4 w-4" />}
                      <Trans>Invite</Trans>
                    </Button>
                  </DialogFooter>
                </fieldset>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="BULK">
            <div className="mt-4 space-y-4">
              <Card gradient className="h-32">
                <CardContent
                  className="text-muted-foreground/80 hover:text-muted-foreground/90 flex h-full cursor-pointer flex-col items-center justify-center rounded-lg p-0 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-5 w-5" />

                  <p className="mt-1 text-sm">
                    <Trans>Click here to upload</Trans>
                  </p>

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
                <Button type="button" variant="secondary" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  <Trans>Template</Trans>
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
