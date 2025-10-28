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

const ZSignFieldNameFormSchema = z.object({
  name: z.string().min(1, { message: msg`Name is required`.id }),
});

type TSignFieldNameFormSchema = z.infer<typeof ZSignFieldNameFormSchema>;

export type SignFieldNameDialogProps = {
  //
};

export const SignFieldNameDialog = createCallable<SignFieldNameDialogProps, string | null>(
  ({ call }) => {
    const form = useForm<TSignFieldNameFormSchema>({
      resolver: zodResolver(ZSignFieldNameFormSchema),
      defaultValues: {
        name: '',
      },
    });

    return (
      <Dialog open={true} onOpenChange={(value) => (!value ? call.end(null) : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Trans>Sign Name</Trans>
            </DialogTitle>

            <DialogDescription className="mt-4">
              <Trans>Sign your full name into the field</Trans>
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => call.end(data.name))}>
              <fieldset
                className="flex h-full flex-col space-y-4"
                disabled={form.formState.isSubmitting}
              >
                <FormField
                  control={form.control}
                  name="name"
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
                    <Trans>Sign</Trans>
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
