import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAuth, type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { RecipientRole } from '@documenso/prisma/client';
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

import { EnableAuthenticatorAppDialog } from '~/components/forms/2fa/enable-authenticator-app-dialog';

import { useRequiredDocumentAuthContext } from './document-auth-provider';

export type DocumentActionAuth2FAProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const Z2FAAuthFormSchema = z.object({
  token: z
    .string()
    .min(4, { message: 'ტოკენი უნდა შეიცავდეს მინიმუმ 4 სიმბოლოს' })
    .max(10, { message: 'ტოკენი უნდა შეიცავდეს მაქსიმუმ 10 სიმბოლოს' }),
});

type T2FAAuthFormSchema = z.infer<typeof Z2FAAuthFormSchema>;

export const DocumentActionAuth2FA = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  onReauthFormSubmit,
  open,
  onOpenChange,
}: DocumentActionAuth2FAProps) => {
  const { recipient, user, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentAuthContext();

  const form = useForm<T2FAAuthFormSchema>({
    resolver: zodResolver(Z2FAAuthFormSchema),
    defaultValues: {
      token: '',
    },
  });

  const [is2FASetupSuccessful, setIs2FASetupSuccessful] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const onFormSubmit = async ({ token }: T2FAAuthFormSchema) => {
    try {
      setIsCurrentlyAuthenticating(true);

      await onReauthFormSubmit({
        type: DocumentAuth.TWO_FACTOR_AUTH,
        token,
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
      token: '',
    });

    setIs2FASetupSuccessful(false);
    setFormErrorCode(null);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!user?.twoFactorEnabled && !is2FASetupSuccessful) {
    return (
      <div className="space-y-4">
        <Alert variant="warning">
          <AlertDescription>
            <p>
              {recipient.role === RecipientRole.VIEWER && actionTarget === 'DOCUMENT'
                ? 'თქვენ უნდა დააყენოთ ორფაქტორიანი ავთენტიფიკაცია (2FA), ეს დოკუმენტი ნანახად, რომ მოინიშნოს.'
                : `You need to setup 2FA to ${actionVerb.toLowerCase()} this ${actionTarget.toLowerCase()}.`}
            </p>

            {user?.identityProvider === 'DOCUMENSO' && (
              <p className="mt-2">
                2FA-ს გააქტიურებით, თქვენ მოგიწევთ შეიყვანოთ კოდი თქვენი ავთენტიფიკაციის
                აპლიკაციიდან ყოველი შემოსვლის დროს.
              </p>
            )}
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            დახურვა
          </Button>

          <EnableAuthenticatorAppDialog onSuccess={() => setIs2FASetupSuccessful(true)} />
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
              name="token"
              render={({ field }) => (
                <FormItem>
                  <FormLabel required>2FA ტოკენი</FormLabel>

                  <FormControl>
                    <Input {...field} placeholder="Token" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {formErrorCode && (
              <Alert variant="destructive">
                <AlertTitle>არა ავტორიზებული</AlertTitle>
                <AlertDescription>
                  ჩვენ ვერ შევძელით თქვენი დეტალების გადამოწმება. გთხოვთ სცადოთ ხელახლა ან
                  დაგვიკავშირდეთ.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                დახურვა
              </Button>

              <Button type="submit" loading={isCurrentlyAuthenticating}>
                ხელის მოწერა
              </Button>
            </DialogFooter>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
