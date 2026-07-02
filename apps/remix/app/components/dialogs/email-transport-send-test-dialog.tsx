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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const ZSendTestEmailFormSchema = z.object({
  to: z.string().email(),
});

type TSendTestEmailFormSchema = z.infer<typeof ZSendTestEmailFormSchema>;

export type EmailTransportSendTestDialogProps = {
  transportId: string;
  trigger: React.ReactNode;
};

export const EmailTransportSendTestDialog = ({ transportId, trigger }: EmailTransportSendTestDialogProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const { mutateAsync: sendTest } = trpc.admin.emailTransport.sendTest.useMutation({
    onSuccess: () => {
      toast({
        title: t`Test email sent.`,
      });
      setOpen(false);
    },
    onError: (error) => {
      toast({
        title: t`Test failed.`,
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const form = useForm<TSendTestEmailFormSchema>({
    resolver: zodResolver(ZSendTestEmailFormSchema),
    defaultValues: {
      to: '',
    },
  });

  const onFormSubmit = async ({ to }: TSendTestEmailFormSchema) => {
    await sendTest({ id: transportId, to });
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        {trigger}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <Trans>Send Test Email</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>Send a test email using this transport to verify the configuration.</Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="space-y-4">
              <FormField
                control={form.control}
                name="to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Email</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder={t`test@example.com`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setOpen(false)}
                  disabled={form.formState.isSubmitting}
                >
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Send</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
