/**
 * Note: This file has some commented out stuff for password auth which is no longer possible.
 *
 * Leaving it here until after we add passkeys and 2FA since it can be reused.
 */
import { useState } from 'react';

import { DateTime } from 'luxon';
import { signOut } from 'next-auth/react';
import { match } from 'ts-pattern';

import {
  DocumentAuth,
  type TRecipientActionAuth,
  type TRecipientActionAuthTypes,
} from '@documenso/lib/types/document-auth';
import type { FieldType } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuthDialogProps = {
  title?: string;
  documentAuthType: TRecipientActionAuthTypes;
  description?: string;
  actionTarget: FieldType | 'DOCUMENT';
  isSubmitting?: boolean;
  open: boolean;
  onOpenChange: (value: boolean) => void;

  /**
   * The callback to run when the reauth form is filled out.
   */
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

// const ZReauthFormSchema = z.object({
//   password: ZCurrentPasswordSchema,
// });
// type TReauthFormSchema = z.infer<typeof ZReauthFormSchema>;

export const DocumentActionAuthDialog = ({
  title,
  description,
  documentAuthType,
  // onReauthFormSubmit,
  isSubmitting,
  open,
  onOpenChange,
}: DocumentActionAuthDialogProps) => {
  const { recipient } = useRequiredDocumentAuthContext();

  // const form = useForm({
  //   resolver: zodResolver(ZReauthFormSchema),
  //   defaultValues: {
  //     password: '',
  //   },
  // });

  const [isSigningOut, setIsSigningOut] = useState(false);

  const isLoading = isSigningOut || isSubmitting; // || form.formState.isSubmitting;

  const { mutateAsync: encryptSecondaryData } = trpc.crypto.encryptSecondaryData.useMutation();

  // const [formErrorCode, setFormErrorCode] = useState<string | null>(null);
  // const onFormSubmit = async (_values: TReauthFormSchema) => {
  //   const documentAuthValue: TRecipientActionAuth = match(documentAuthType)
  //     // Todo: Add passkey.
  //     // .with(DocumentAuthType.PASSKEY, (type) => ({
  //     //   type,
  //     //   value,
  //     // }))
  //     .otherwise((type) => ({
  //       type,
  //     }));

  //   try {
  //     await onReauthFormSubmit(documentAuthValue);

  //     onOpenChange(false);
  //   } catch (e) {
  //     const error = AppError.parseError(e);
  //     setFormErrorCode(error.code);

  //     // Suppress unauthorized errors since it's handled in this component.
  //     if (error.code === AppErrorCode.UNAUTHORIZED) {
  //       return;
  //     }

  //     throw error;
  //   }
  // };

  const handleChangeAccount = async (email: string) => {
    try {
      setIsSigningOut(true);

      const encryptedEmail = await encryptSecondaryData({
        data: email,
        expiresAt: DateTime.now().plus({ days: 1 }).toMillis(),
      });

      await signOut({
        callbackUrl: `/signin?email=${encodeURIComponent(encryptedEmail)}`,
      });
    } catch {
      setIsSigningOut(false);

      // Todo: Alert.
    }
  };

  const handleOnOpenChange = (value: boolean) => {
    if (isLoading) {
      return;
    }

    onOpenChange(value);
  };

  // useEffect(() => {
  //   form.reset();
  //   setFormErrorCode(null);
  // }, [open, form]);

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title || 'Sign field'}</DialogTitle>

          <DialogDescription>
            {description || `Reauthentication is required to sign the field`}
          </DialogDescription>
        </DialogHeader>

        {match(documentAuthType)
          .with(DocumentAuth.ACCOUNT, () => (
            <fieldset disabled={isSigningOut} className="space-y-4">
              <Alert>
                <AlertDescription>
                  To sign this field, you need to be logged in as <strong>{recipient.email}</strong>
                </AlertDescription>
              </Alert>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  onClick={async () => handleChangeAccount(recipient.email)}
                  loading={isSigningOut}
                >
                  Login
                </Button>
              </DialogFooter>
            </fieldset>
          ))
          .with(DocumentAuth.EXPLICIT_NONE, () => null)
          .exhaustive()}

        {/* <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit)}>
              <fieldset className="flex h-full flex-col space-y-4" disabled={isLoading}>
                <FormItem>
                  <FormLabel required>Email</FormLabel>

                  <FormControl>
                    <Input className="bg-background" value={recipient.email} disabled />
                  </FormControl>
                </FormItem>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required>Password</FormLabel>

                      <FormControl>
                        <PasswordInput className="bg-background" {...field} />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                {formErrorCode && (
                  <Alert variant="destructive">
                    {match(formErrorCode)
                      .with(AppErrorCode.UNAUTHORIZED, () => (
                        <>
                          <AlertTitle>Unauthorized</AlertTitle>
                          <AlertDescription>
                            We were unable to verify your details. Please ensure the details are
                            correct
                          </AlertDescription>
                        </>
                      ))
                      .otherwise(() => (
                        <>
                          <AlertTitle>Something went wrong</AlertTitle>
                          <AlertDescription>
                            We were unable to sign this field at this time. Please try again or
                            contact support.
                          </AlertDescription>
                        </>
                      ))}
                  </Alert>
                )}

                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                    Cancel
                  </Button>

                  <Button type="submit" loading={isLoading}>
                    Sign field
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form> */}
      </DialogContent>
    </Dialog>
  );
};
