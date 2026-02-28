import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { trpc } from '@documenso/trpc/react';
import { ZCreateOrganisationWithUserRequestSchema } from '@documenso/trpc/server/admin-router/create-organisation-with-user.types';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type AdminOrganisationWithUserCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZFormSchema = ZCreateOrganisationWithUserRequestSchema.shape.data;

type TFormSchema = z.infer<typeof ZFormSchema>;

const CLAIM_OPTIONS = [
  { value: INTERNAL_CLAIM_ID.FREE, label: 'Free' },
  { value: INTERNAL_CLAIM_ID.TEAM, label: 'Team' },
  { value: INTERNAL_CLAIM_ID.ENTERPRISE, label: 'Enterprise' },
];

export const AdminOrganisationWithUserCreateDialog = ({
  trigger,
  ...props
}: AdminOrganisationWithUserCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  const form = useForm<TFormSchema>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      organisationName: '',
      userEmail: '',
      userName: '',
      subscriptionClaimId: INTERNAL_CLAIM_ID.FREE,
    },
  });

  const { mutateAsync: createOrganisationWithUser } =
    trpc.admin.organisation.createWithUser.useMutation();

  const onFormSubmit = async (data: TFormSchema) => {
    try {
      const result = await createOrganisationWithUser({
        data,
      });

      await navigate(`/admin/organisations/${result.organisationId}`);

      setOpen(false);

      toast({
        title: t`Success`,
        description: result.isNewUser
          ? t`Organisation created and welcome email sent to new user`
          : t`Organisation created and existing user added`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An error occurred`,
        description:
          error.message ||
          t`We encountered an error while creating the organisation. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create Organisation + User</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create Organisation + User</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>
              Create an organisation and add a user as the owner. If the email exists, the existing
              user will be linked to the new organisation.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="organisationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Organisation Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>User Email</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormDescription>
                      <Trans>
                        If this email exists, the user will be added to the organisation. Otherwise,
                        a new user will be created.
                      </Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="userName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>User Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      <Trans>Used only if creating a new user</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subscriptionClaimId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Subscription Plan</Trans>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t`Select a plan`} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CLAIM_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="submit"
                  data-testid="dialog-create-organisation-with-user-button"
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
