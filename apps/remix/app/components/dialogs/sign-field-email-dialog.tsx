import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { createCallable } from 'react-call';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

const ZSignFieldEmailFormSchema = z.object({
  email: z
    .string()
    .email()
    .min(1, { message: msg`Email is required`.id }),
});

type TSignFieldEmailFormSchema = z.infer<typeof ZSignFieldEmailFormSchema>;

export type SignFieldEmailDialogProps = {
  placeholderEmail: string | null;
};

export const SignFieldEmailDialog = createCallable<SignFieldEmailDialogProps, string | null>(
  ({ call, placeholderEmail }) => {
    const form = useForm<TSignFieldEmailFormSchema>({
      resolver: zodResolver(ZSignFieldEmailFormSchema),
      defaultValues: {
        email: placeholderEmail || '',
      },
    });

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Enter Email</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Please enter your email address</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.email))}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => call.end(null)}>
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button type="submit">
                    <Trans>Enter</Trans>
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    );
  },
);
