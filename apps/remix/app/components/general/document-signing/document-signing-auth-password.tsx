import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAuth, type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthPasswordProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const ZPasswordAuthFormSchema = z.object({
  password: z
    .string()
    .min(1, { message: 'Password is required' })
    .max(72, { message: 'Password must be at most 72 characters long' }),
});

type TPasswordAuthFormSchema = z.infer<typeof ZPasswordAuthFormSchema>;

export const DocumentSigningAuthPassword = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentSigningAuthPasswordProps) => {
  const { t } = useLingui();

  const { recipient, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentSigningAuthContext();

  const form = useForm<TPasswordAuthFormSchema>({
    resolver: zodResolver(ZPasswordAuthFormSchema),
    defaultValues: {
      password: '',
    },
  });

  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const onFormSubmit = async ({ password }: TPasswordAuthFormSchema) => {
    try {
      setIsCurrentlyAuthenticating(true);

      await onReauthFormSubmit({
        type: DocumentAuth.PASSWORD,
        password,
      });

      setIsCurrentlyAuthenticating(false);

      onOpenChange(false);
    } catch (err) {
      setIsCurrentlyAuthenticating(false);

      const error = AppError.parseError(err);
      setFormErrorCode(error.code);

      // Todo: Alert.
    }
  };

  useEffect(() => {
    form.reset({
      password: '',
    });

    setFormErrorCode(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={isCurrentlyAuthenticating}>
          <div className="space-y-4">
            {formErrorCode && (
              <Alert variant="destructive">
                <AlertTitle>
                  <Trans>Unauthorized</Trans>
                </AlertTitle>
                <AlertDescription>
                  <Trans>
                    We were unable to verify your details. Please try again or contact support
                  </Trans>
                </AlertDescription>
              </Alert>
            )}

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>
                    <Trans>Password</Trans>
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="password"
                      placeholder={t`Enter your password`}
                      {...field}
                      autoComplete="current-password"
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                <Trans>Cancel</Trans>
              </Button>

              <Button type="submit" loading={isCurrentlyAuthenticating}>
                <Trans>Sign</Trans>
              </Button>
            </DialogFooter>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
