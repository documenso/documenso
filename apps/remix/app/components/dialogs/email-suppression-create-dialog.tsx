import { EMAIL_SUPPRESSION_SCOPE_MAP } from '@documenso/lib/constants/email-suppression-translations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TEmailSuppressionTarget } from '@documenso/lib/types/email-suppression';
import { zEmail } from '@documenso/lib/utils/zod';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { EmailSuppressionScope } from '@prisma/client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

const ZEmailSuppressionFormSchema = z
  .object({
    email: zEmail().trim().toLowerCase().max(254),
    scope: z.nativeEnum(EmailSuppressionScope),
    senderId: z.string().trim(),
    reason: z.string().trim().max(500),
  })
  .superRefine(({ scope, senderId }, ctx) => {
    if (scope === EmailSuppressionScope.GLOBAL) {
      return;
    }

    if (!senderId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['senderId'],
        message: 'An ID is required.',
      });

      return;
    }

    const isNumericId = scope === EmailSuppressionScope.TEAM || scope === EmailSuppressionScope.USER;

    if (isNumericId && !/^\d+$/.test(senderId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['senderId'],
        message: 'The ID must be a number.',
      });
    }
  });

type TEmailSuppressionFormSchema = z.infer<typeof ZEmailSuppressionFormSchema>;

export const EmailSuppressionCreateDialog = () => {
  const { t, i18n } = useLingui();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);

  const form = useForm<TEmailSuppressionFormSchema>({
    resolver: zodResolver(ZEmailSuppressionFormSchema),
    defaultValues: {
      email: '',
      scope: EmailSuppressionScope.GLOBAL,
      senderId: '',
      reason: '',
    },
  });

  const scope = form.watch('scope');

  const { mutateAsync: createSuppression } = trpc.admin.emailSuppression.create.useMutation();

  const onFormSubmit = async (values: TEmailSuppressionFormSchema) => {
    try {
      await createSuppression({
        email: values.email,
        target: toSuppressionTarget(values),
        reason: values.reason || undefined,
      });

      toast({
        title: t`Suppression added.`,
      });

      setOpen(false);
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.NOT_FOUND) {
        form.setError('senderId', {
          type: 'manual',
          message: match(values.scope)
            .with(EmailSuppressionScope.ORGANISATION, () => t`No organisation exists with this ID.`)
            .with(EmailSuppressionScope.TEAM, () => t`No team exists with this ID.`)
            .otherwise(() => t`No user exists with this ID.`),
        });

        return;
      }

      if (error.code === AppErrorCode.ALREADY_EXISTS) {
        form.setError('email', {
          type: 'manual',
          message: t`This email is already suppressed for this sender.`,
        });

        return;
      }

      toast({
        title: t`Failed to add suppression.`,
        description: t`We encountered an unknown error while attempting to add this suppression. Please try again later.`,
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}>
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        <Button className="flex-shrink-0">
          <Trans>Add suppression</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add Email Suppression</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>
              Stop emails such as signing requests, reminders and invites from being sent to an email address. Account
              and security emails are still sent.
            </Trans>
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
                      <Input type="email" placeholder="example@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Blocked sender</Trans>
                    </FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(EmailSuppressionScope).map((value) => (
                          <SelectItem key={value} value={value}>
                            {i18n._(EMAIL_SUPPRESSION_SCOPE_MAP[value])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {scope !== EmailSuppressionScope.GLOBAL && (
                <FormField
                  control={form.control}
                  name="senderId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>
                        {match(scope)
                          .with(EmailSuppressionScope.ORGANISATION, () => <Trans>Organisation ID</Trans>)
                          .with(EmailSuppressionScope.TEAM, () => <Trans>Team ID</Trans>)
                          .with(EmailSuppressionScope.USER, () => <Trans>User ID</Trans>)
                          .exhaustive()}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>Reason</Trans>
                    </FormLabel>
                    <FormControl>
                      <Textarea placeholder={t`Optional note for other admins`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Add</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const toSuppressionTarget = ({ scope, senderId }: TEmailSuppressionFormSchema) =>
  match<EmailSuppressionScope, TEmailSuppressionTarget>(scope)
    .with(EmailSuppressionScope.GLOBAL, (scope) => ({ scope }))
    .with(EmailSuppressionScope.ORGANISATION, (scope) => ({ scope, organisationId: senderId }))
    .with(EmailSuppressionScope.TEAM, (scope) => ({ scope, teamId: Number(senderId) }))
    .with(EmailSuppressionScope.USER, (scope) => ({ scope, userId: Number(senderId) }))
    .exhaustive();
