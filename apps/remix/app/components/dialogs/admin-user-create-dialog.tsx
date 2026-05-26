import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { ZCreateUserRequestSchema } from '@documenso/trpc/server/admin-router/create-user.types';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

export type AdminUserCreateDialogProps = {
  trigger?: React.ReactNode;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZFormSchema = ZCreateUserRequestSchema;

type TFormSchema = z.infer<typeof ZFormSchema>;

export const AdminUserCreateDialog = ({ trigger, ...props }: AdminUserCreateDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const navigate = useNavigate();

  const form = useForm<TFormSchema>({
    resolver: zodResolver(ZFormSchema),
    defaultValues: {
      email: '',
      name: '',
    },
  });

  const { mutateAsync: createUser } = trpc.admin.user.create.useMutation();

  const onFormSubmit = async (data: TFormSchema) => {
    try {
      const result = await createUser(data);

      await navigate(`/admin/users/${result.userId}`);

      setOpen(false);

      toast({
        title: t`Success`,
        description: t`User created and welcome email sent`,
        duration: 5000,
      });
    } catch (err) {
      const error = AppError.parseError(err);

      console.error(error);

      toast({
        title: t`An error occurred`,
        description: error.message || t`We encountered an error while creating the user. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    form.reset();
  }, [open, form]);

  return (
    <Dialog {...props} open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button className="flex-shrink-0" variant="secondary">
            <Trans>Create User</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Create User</Trans>
          </DialogTitle>

          <DialogDescription>
            <Trans>Create a new user. A welcome email will be sent with a link to set their password.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset className="flex h-full flex-col space-y-4" disabled={form.formState.isSubmitting}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Email</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" data-testid="dialog-create-user-button" loading={form.formState.isSubmitting}>
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
