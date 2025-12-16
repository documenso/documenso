import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { getHighestOrganisationRoleInGroup } from '@documenso/lib/utils/organisations';
import { trpc } from '@documenso/trpc/react';
import type { TGetAdminOrganisationResponse } from '@documenso/trpc/server/admin-router/get-admin-organisation.types';
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

export type AdminOrganisationMemberUpdateDialogProps = {
  trigger?: React.ReactNode;
  organisationId: string;
  organisationMember: TGetAdminOrganisationResponse['members'][number];
  isOwner: boolean;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateOrganisationMemberFormSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'MEMBER']),
});

type ZUpdateOrganisationMemberSchema = z.infer<typeof ZUpdateOrganisationMemberFormSchema>;

export const AdminOrganisationMemberUpdateDialog = ({
  trigger,
  organisationId,
  organisationMember,
  isOwner,
  ...props
}: AdminOrganisationMemberUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  const { t } = useLingui();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Determine the current role value for the form
  const currentRoleValue = isOwner
    ? 'OWNER'
    : getHighestOrganisationRoleInGroup(
        organisationMember.organisationGroupMembers.map((ogm) => ogm.group),
      );
  const organisationMemberName = organisationMember.user.name ?? organisationMember.user.email;

  const form = useForm<ZUpdateOrganisationMemberSchema>({
    resolver: zodResolver(ZUpdateOrganisationMemberFormSchema),
    defaultValues: {
      role: currentRoleValue,
    },
  });

  const { mutateAsync: updateOrganisationMemberRole } =
    trpc.admin.organisationMember.updateRole.useMutation();

  const onFormSubmit = async ({ role }: ZUpdateOrganisationMemberSchema) => {
    try {
      await updateOrganisationMemberRole({
        organisationId,
        userId: organisationMember.userId,
        role,
      });

      const roleLabel = match(role)
        .with('OWNER', () => t`Owner`)
        .with(OrganisationMemberRole.ADMIN, () => t`Admin`)
        .with(OrganisationMemberRole.MANAGER, () => t`Manager`)
        .with(OrganisationMemberRole.MEMBER, () => t`Member`)
        .exhaustive();

      toast({
        title: t`Success`,
        description:
          role === 'OWNER'
            ? t`Ownership transferred to ${organisationMemberName}.`
            : t`Updated ${organisationMemberName} to ${roleLabel}.`,
        duration: 5000,
      });

      setOpen(false);

      // Refresh the page to show updated data
      await navigate(0);
    } catch (err) {
      console.error(err);

      toast({
        title: t`An unknown error occurred`,
        description: t`We encountered an unknown error while attempting to update this organisation member. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    form.reset({
      role: currentRoleValue,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentRoleValue, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Update role</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Update organisation member</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              You are currently updating <span className="font-bold">{organisationMemberName}</span>
              .
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
                          <SelectItem value="OWNER">
                            <Trans>Owner</Trans>
                          </SelectItem>
                          <SelectItem value={OrganisationMemberRole.ADMIN}>
                            <Trans>Admin</Trans>
                          </SelectItem>
                          <SelectItem value={OrganisationMemberRole.MANAGER}>
                            <Trans>Manager</Trans>
                          </SelectItem>
                          <SelectItem value={OrganisationMemberRole.MEMBER}>
                            <Trans>Member</Trans>
                          </SelectItem>
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
