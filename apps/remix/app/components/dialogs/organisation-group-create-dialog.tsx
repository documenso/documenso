import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { ORGANISATION_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/organisations';
import { EXTENDED_ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationGroupRequestSchema } from '@documenso/trpc/server/organisation-router/create-organisation-group.types';
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
import { OrganisationMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  type OrganisationMemberOption,
  OrganisationMembersMultiSelectCombobox,
} from '~/components/general/organisation-members-multiselect-combobox';

export type OrganisationGroupCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreateOrganisationGroupFormSchema = ZCreateOrganisationGroupRequestSchema.pick({
  name: true,
  memberIds: true,
  organisationRole: true,
});

type TCreateOrganisationGroupFormSchema = z.infer<typeof ZCreateOrganisationGroupFormSchema>;

export const OrganisationGroupCreateDialog = ({ trigger, ...props }: OrganisationGroupCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<OrganisationMemberOption[]>([]);
  const organisation = useCurrentOrganisation();

  const form = useForm({
    resolver: zodResolver(ZCreateOrganisationGroupFormSchema),
    defaultValues: {
      name: '',
      organisationRole: OrganisationMemberRole.MEMBER,
      memberIds: [],
    },
  });

  const { mutateAsync: createOrganisationGroup } = trpc.organisation.group.create.useMutation();

  const onFormSubmit = async ({ name, organisationRole, memberIds }: TCreateOrganisationGroupFormSchema) => {
    try {
      await createOrganisationGroup({
        organisationId: organisation.id,
        name,
        organisationRole,
        memberIds,
      });

      setOpen(false);

      toast({
        title: t`Success`,
        description: t`Group has been created.`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to create a group. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    form.reset();
    setSelectedMembers([]);
  }, [open, form]);

  return (
    <Dialog {...props} open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create group</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create group</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Organise your members into groups which can be assigned to teams</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Group Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" {...field} />
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
                      <Trans>Organisation role</Trans>
                    </FormLabel>
                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full text-muted-foreground">
                          <SelectValue />
                        </SelectTrigger>

                        <SelectContent position="popper">
                          {ORGANISATION_MEMBER_ROLE_HIERARCHY[organisation.currentOrganisationRole].map((role) => (
                            <SelectItem key={role} value={role}>
                              {t(EXTENDED_ORGANISATION_MEMBER_ROLE_MAP[role]) ?? role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                    <FormMessage />
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
                        className="w-full bg-background"
                        dataTestId="group-members-picker"
                      />
                    </FormControl>

                    <FormDescription>
                      <Trans>Select the members to add to this group</Trans>
                    </FormDescription>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-button"
                  loading={form.formState.isSubmitting}
                >
                  <Trans>Create</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
