import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { OrganisationMemberRole } from '@prisma/client';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ORGANISATION_MEMBER_ROLE_HIERARCHY } from '@documenso/lib/constants/organisations';
import { ORGANISATION_MEMBER_ROLE_MAP } from '@documenso/lib/constants/organisations-translations';
import { isOrganisationRoleWithinUserHierarchy } from '@documenso/lib/utils/organisations';
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

export type OrganisationMemberUpdateDialogProps = {
  currentUserOrganisationRole: OrganisationMemberRole;
  trigger?: React.ReactNode;
  organisationId: string;
  organisationMemberId: string;
  organisationMemberName: string;
  organisationMemberRole: OrganisationMemberRole;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZUpdateOrganisationMemberFormSchema = z.object({
  role: z.nativeEnum(OrganisationMemberRole),
});

type ZUpdateOrganisationMemberSchema = z.infer<typeof ZUpdateOrganisationMemberFormSchema>;

export const OrganisationMemberUpdateDialog = ({
  currentUserOrganisationRole,
  trigger,
  organisationId,
  organisationMemberId,
  organisationMemberName,
  organisationMemberRole,
  ...props
}: OrganisationMemberUpdateDialogProps) => {
  const [open, setOpen] = useState(false);

  const { _ } = useLingui();
  const { toast } = useToast();

  const form = useForm<ZUpdateOrganisationMemberSchema>({
    resolver: zodResolver(ZUpdateOrganisationMemberFormSchema),
    defaultValues: {
      role: organisationMemberRole,
    },
  });

  const { mutateAsync: updateOrganisationMember } = trpc.organisation.member.update.useMutation();

  const onFormSubmit = async ({ role }: ZUpdateOrganisationMemberSchema) => {
    try {
      await updateOrganisationMember({
        organisationId,
        organisationMemberId,
        data: {
          role,
        },
      });

      toast({
        title: _(msg`Success`),
        description: _(msg`You have updated ${organisationMemberName}.`),
        duration: 5000,
      });

      setOpen(false);
    } catch {
      toast({
        title: _(msg`An unknown error occurred`),
        description: _(
          msg`We encountered an unknown error while attempting to update this organisation member. Please try again later.`,
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

    if (
      !isOrganisationRoleWithinUserHierarchy(currentUserOrganisationRole, organisationMemberRole)
    ) {
      setOpen(false);

      toast({
        title: _(msg`You cannot modify a organisation member who has a higher role than you.`),
        variant: 'destructive',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentUserOrganisationRole, organisationMemberRole, form, toast]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {trigger ?? (
          <Button variant="secondary">
            <Trans>Update organisation member</Trans>
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
              You are currently updating{' '}
              <span className="font-bold">{organisationMemberName}.</span>
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
                          {ORGANISATION_MEMBER_ROLE_HIERARCHY[currentUserOrganisationRole].map(
                            (role) => (
                              <SelectItem key={role} value={role}>
                                {_(ORGANISATION_MEMBER_ROLE_MAP[role]) ?? role}
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
