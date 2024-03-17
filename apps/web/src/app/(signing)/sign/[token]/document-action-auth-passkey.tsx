import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAuth, type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { trpc } from '@documenso/trpc/react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';

import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuthPasskeyProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const ZPasskeyAuthFormSchema = z.object({
  preferredPasskeyId: z.string(),
});

type TPasskeyAuthFormSchema = z.infer<typeof ZPasskeyAuthFormSchema>;

export const DocumentActionAuthPasskey = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentActionAuthPasskeyProps) => {
  const {
    passkeyData,
    preferredPasskeyId,
    setPreferredPasskeyId,
    isCurrentlyAuthenticating,
    setIsCurrentlyAuthenticating,
  } = useRequiredDocumentAuthContext();

  const form = useForm({
    resolver: zodResolver(ZPasskeyAuthFormSchema),
    defaultValues: {
      preferredPasskeyId: preferredPasskeyId ?? '',
    },
  });

  const { mutateAsync: createPasskeyAuthenticationOptions } =
    trpc.auth.createPasskeyAuthenticationOptions.useMutation();

  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const onFormSubmit = async (values: TPasskeyAuthFormSchema) => {
    try {
      setPreferredPasskeyId(values.preferredPasskeyId);
      setIsCurrentlyAuthenticating(true);

      const { options, tokenReference } = await createPasskeyAuthenticationOptions({
        preferredPasskeyId: values.preferredPasskeyId,
      });

      const authenticationResponse = await startAuthentication(options);

      await onReauthFormSubmit({
        type: DocumentAuth.PASSKEY,
        authenticationResponse,
        tokenReference,
      });

      setIsCurrentlyAuthenticating(false);

      onOpenChange(false);
    } catch (err) {
      setIsCurrentlyAuthenticating(false);

      if (err.name === 'NotAllowedError') {
        return;
      }

      const error = AppError.parseError(err);
      setFormErrorCode(error.code);

      // Todo: Alert.
    }
  };

  useEffect(() => {
    form.reset({
      preferredPasskeyId: preferredPasskeyId ?? '',
    });

    setFormErrorCode(null);
  }, [open, form, preferredPasskeyId]);

  if (!browserSupportsWebAuthn()) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertDescription>
            Your browser does not support passkeys, which is required to {actionVerb.toLowerCase()}{' '}
            this {actionTarget.toLowerCase()}.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={isCurrentlyAuthenticating}>
          {passkeyData.passkeys.length === 0 && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  You need to setup a passkey to {actionVerb.toLowerCase()} this{' '}
                  {actionTarget.toLowerCase()}.
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>

                {/* Todo */}
                <Button asChild>Setup</Button>
              </DialogFooter>
            </div>
          )}

          {passkeyData.passkeys.length > 0 && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="preferredPasskeyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Passkey</FormLabel>

                    <FormControl>
                      <Select {...field} onValueChange={field.onChange}>
                        <SelectTrigger className="bg-background text-muted-foreground">
                          <SelectValue data-testid="documentAccessSelectValue" />
                        </SelectTrigger>

                        <SelectContent position="popper">
                          {passkeyData.passkeys.map((passkey) => (
                            <SelectItem key={passkey.id} value={passkey.id}>
                              {passkey.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                )}
              />

              {formErrorCode && (
                <Alert variant="destructive">
                  <AlertTitle>Unauthorized</AlertTitle>
                  <AlertDescription>
                    We were unable to verify your details. Please try again or contact support
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>

                <Button type="submit" loading={isCurrentlyAuthenticating}>
                  Sign
                </Button>
              </DialogFooter>
            </div>
          )}
        </fieldset>
      </form>
    </Form>
  );
};
