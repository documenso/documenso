import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

const ZSupportTicketSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type TSupportTicket = z.infer<typeof ZSupportTicketSchema>;

export type SupportTicketFormProps = {
  email: string;
  onSuccess?: () => void;
  onClose?: () => void;
};

export const SupportTicketForm = ({ email, onSuccess, onClose }: SupportTicketFormProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { mutateAsync: submitSupportTicket } = trpc.profile.submitSupportTicket.useMutation();

  const form = useForm<TSupportTicket>({
    resolver: zodResolver(ZSupportTicketSchema),
    defaultValues: {
      email: email || '',
      subject: '',
      message: '',
    },
  });

  const isLoading = form.formState.isLoading;

  const onSubmit = async (values: TSupportTicket) => {
    try {
      await submitSupportTicket(values);

      toast({
        title: t`Support ticket created`,
        description: t`Your support request has been submitted. We'll get back to you soon!`,
      });

      if (onSuccess) {
        onSuccess();
      }

      form.reset();
    } catch (err) {
      toast({
        title: t`Failed to create support ticket`,
        description: t`An error occurred. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <fieldset disabled={isLoading} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Email</Trans>
                  </FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Subject</Trans>
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
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Message</Trans>
                  </FormLabel>
                  <FormControl>
                    <Textarea rows={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-2 flex flex-row gap-2">
              <Button type="submit" size="sm" loading={isLoading}>
                <Trans>Submit</Trans>
              </Button>
              {onClose && (
                <Button variant="outline" size="sm" type="button" onClick={onClose}>
                  <Trans>Close</Trans>
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </Form>
    </>
  );
};
