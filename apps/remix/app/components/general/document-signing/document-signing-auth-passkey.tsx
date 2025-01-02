import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { browserSupportsWebAuthn, startAuthentication } from '@simplewebauthn/browser';
import { Loader } from 'lucide-react';
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

import { PasskeyCreateDialog } from '~/components/dialogs/passkey-create-dialog';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthPasskeyProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const ZPasskeyAuthFormSchema = z.object({
  passkeyId: z.string(),
});

type TPasskeyAuthFormSchema = z.infer<typeof ZPasskeyAuthFormSchema>;

export const DocumentSigningAuthPasskey = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentSigningAuthPasskeyProps) => {
  const { _ } = useLingui();

  const {
    recipient,
    passkeyData,
    preferredPasskeyId,
    setPreferredPasskeyId,
    isCurrentlyAuthenticating,
    setIsCurrentlyAuthenticating,
    refetchPasskeys,
  } = useRequiredDocumentSigningAuthContext();

  const form = useForm<TPasskeyAuthFormSchema>({
    resolver: zodResolver(ZPasskeyAuthFormSchema),
    defaultValues: {
      passkeyId: preferredPasskeyId || '',
    },
  });

  const { mutateAsync: createPasskeyAuthenticationOptions } =
    trpc.auth.createPasskeyAuthenticationOptions.useMutation();

  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const onFormSubmit = async ({ passkeyId }: TPasskeyAuthFormSchema) => {
    try {
      setPreferredPasskeyId(passkeyId);
      setIsCurrentlyAuthenticating(true);

      const { options, tokenReference } = await createPasskeyAuthenticationOptions({
        preferredPasskeyId: passkeyId,
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
      passkeyId: preferredPasskeyId || '',
    });

    setFormErrorCode(null);
  }, [open, form, preferredPasskeyId]);

  if (!browserSupportsWebAuthn()) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertDescription>
            {/* Todo: Translate */}
            Your browser does not support passkeys, which is required to {actionVerb.toLowerCase()}{' '}
            this {actionTarget.toLowerCase()}.
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Close</Trans>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (passkeyData.isInitialLoading || (passkeyData.isError && passkeyData.passkeys.length === 0)) {
    return (
      <div className="flex h-28 items-center justify-center">
        <Loader className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (passkeyData.isError) {
    return (
      <div className="h-28 space-y-4">
        <Alert variant="destructive">
          <AlertDescription>
            <Trans>Something went wrong while loading your passkeys.</Trans>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <Button type="button" onClick={() => void refetchPasskeys()}>
            <Trans>Retry</Trans>
          </Button>
        </DialogFooter>
      </div>
    );
  }

  if (passkeyData.passkeys.length === 0) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertDescription>
            {/* Todo: Translate */}
            {recipient.role === RecipientRole.VIEWER && actionTarget === 'DOCUMENT'
              ? 'You need to setup a passkey to mark this document as viewed.'
              : `You need to setup a passkey to ${actionVerb.toLowerCase()} this ${actionTarget.toLowerCase()}.`}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            <Trans>Cancel</Trans>
          </Button>

          <PasskeyCreateDialog
            onSuccess={async () => refetchPasskeys()}
            trigger={
              <Button>
                <Trans>Setup</Trans>
              </Button>
            }
          />
        </DialogFooter>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)}>
        <fieldset disabled={isCurrentlyAuthenticating}>
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="passkeyId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>Passkey</FormLabel>

                  <FormControl>
                    <Select {...field} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-background text-muted-foreground">
                        <SelectValue
                          data-testid="documentAccessSelectValue"
                          placeholder={_(msg`Select passkey`)}
                        />
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
        </fieldset>
      </form>
    </Form>
  );
};
