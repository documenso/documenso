import { SUPPORT_EMAIL } from '@documenso/lib/constants/app';
import { trpc } from '@documenso/trpc/react';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import { RadioGroup, RadioGroupItem } from '@documenso/ui/primitives/radio-group';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { EmailSuppressionScope } from '@prisma/client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

export type RecipientEmailSuppressionFormProps = {
  className?: string;
  token: string;
  recipientEmail: string;

  /**
   * Null when the sender's emails hide who sent them, so this form doesn't reveal it either.
   */
  senderName: string | null;
  teamName: string | null;
  organisationName: string | null;
};

const ZRecipientEmailSuppressionFormSchema = z.object({
  scope: z.nativeEnum(EmailSuppressionScope),
});

type TRecipientEmailSuppressionFormSchema = z.infer<typeof ZRecipientEmailSuppressionFormSchema>;

export const RecipientEmailSuppressionForm = ({
  className,
  token,
  recipientEmail,
  senderName,
  teamName,
  organisationName,
}: RecipientEmailSuppressionFormProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [isSuppressed, setIsSuppressed] = useState(false);

  const options = [
    {
      scope: EmailSuppressionScope.USER,
      label: senderName,
      description: t`Emails sent by this person.`,
    },
    {
      scope: EmailSuppressionScope.TEAM,
      label: teamName,
      description: t`Emails sent on behalf of this team.`,
    },
    {
      scope: EmailSuppressionScope.ORGANISATION,
      label: organisationName,
      description: t`Emails sent by anyone in this organisation.`,
    },
    {
      scope: EmailSuppressionScope.GLOBAL,
      label: t`All senders`,
      description: t`Emails from everyone, including senders you know.`,
    },
  ].flatMap((option) => (option.label ? [{ ...option, label: option.label }] : []));

  const form = useForm<TRecipientEmailSuppressionFormSchema>({
    resolver: zodResolver(ZRecipientEmailSuppressionFormSchema),
    defaultValues: {
      scope: options[0].scope,
    },
  });

  const { mutateAsync: suppressEmails } = trpc.envelope.recipient.suppressEmails.useMutation();

  const onFormSubmit = async ({ scope }: TRecipientEmailSuppressionFormSchema) => {
    try {
      await suppressEmails({ token, scope });

      setIsSuppressed(true);
    } catch {
      toast({
        title: t`Something went wrong`,
        description: t`We were unable to stop these emails at this time. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  if (isSuppressed) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <h2 className="text-center font-semibold text-xl">
          <Trans>Emails stopped</Trans>
        </h2>

        <p className="mt-4 max-w-[60ch] text-center text-muted-foreground leading-normal">
          <Trans>
            You will no longer receive these emails at {recipientEmail}. If you change your mind, please contact our{' '}
            <a className="text-documenso-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
              support team
            </a>
            .
          </Trans>
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <h2 className="text-center font-semibold text-xl">
        <Trans>Stop receiving emails</Trans>
      </h2>

      <p className="mt-4 max-w-[60ch] text-center text-muted-foreground leading-normal">
        <Trans>Choose who can no longer email {recipientEmail} through us. This does not report the sender.</Trans>
      </p>

      <Form {...form}>
        <form className="mt-6 w-full" onSubmit={form.handleSubmit(onFormSubmit)}>
          <fieldset className="flex flex-col items-center" disabled={form.formState.isSubmitting}>
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="w-full">
                  <FormControl>
                    <RadioGroup
                      aria-label={t`Stop emails from`}
                      value={field.value}
                      onValueChange={field.onChange}
                      className="gap-3"
                    >
                      {options.map((option) => (
                        <label
                          key={option.scope}
                          htmlFor={`email-suppression-scope-${option.scope}`}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[[data-state=checked]]:border-primary"
                        >
                          <RadioGroupItem
                            id={`email-suppression-scope-${option.scope}`}
                            value={option.scope}
                            className="mt-0.5"
                          />

                          <span className="flex flex-col gap-1">
                            <span className="font-medium text-sm">{option.label}</span>
                            <span className="text-muted-foreground text-sm">{option.description}</span>
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="mt-6" loading={form.formState.isSubmitting}>
              <Trans>Stop emails</Trans>
            </Button>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
