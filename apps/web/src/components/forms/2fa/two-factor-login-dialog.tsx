import { useState } from 'react';

import { signIn } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { useTranslation } from '@documenso/ui/i18n/client';
import { LocaleTypes } from '@documenso/ui/i18n/settings';
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
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { useToast } from '@documenso/ui/primitives/use-toast';

type TwoFactorLoginDialogProps = {
  open: boolean;
  locale: LocaleTypes;
  onOpenChange: (_state: boolean) => void;
  credentials: { password: string; email: string } | null;
};

const formSchema = z.object({
  totpCode: z.string().optional(),
  backupCode: z.string().optional(),
});

type TFormSchema = z.infer<typeof formSchema>;

const FIELD_ERROR_MESSAGES: Partial<
  Record<keyof typeof ErrorCode, { message: string; field: keyof TFormSchema }>
> = {
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: { message: 'incorrect 2fa code', field: 'totpCode' },
  [ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE]: {
    message: 'incorrect {t(`backup-code`)}',
    field: 'backupCode',
  },
};

export const TwoFactorLoginDialog = ({
  open,
  onOpenChange,
  credentials,
  locale,
}: TwoFactorLoginDialogProps) => {
  const { toast } = useToast();
  const [credentialType, setCredentialType] = useState<'backup-code' | 'otp'>('otp');
  const { t } = useTranslation(locale, 'dashboard');

  const form = useForm<TFormSchema>({
    defaultValues: {
      totpCode: '',
      backupCode: '',
    },
  });

  const onSubmit = async (data: TFormSchema) => {
    if (credentials) {
      const { email, password } = credentials;
      const { totpCode, backupCode } = data;
      try {
        const result = await signIn('credentials', {
          email,
          password,
          totpCode,
          backupCode,
          callbackUrl: '/documents',
          redirect: false,
        });

        if (result?.error && isErrorCode(result.error)) {
          const fieldError = FIELD_ERROR_MESSAGES?.[result.error];
          if (fieldError) {
            form.setError(fieldError.field, {
              type: `custom`,
              message: fieldError.message,
            });
          } else {
            throw new Error(result.error);
          }
        }

        if (!result?.url) {
          throw new Error('An unknown error occurred');
        }

        window.location.href = result.url;
      } catch (err) {
        toast({
          title: t(`unknown-error`),
          description: t(`we-encountered-an-unknown-error`),
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(`2fa-code`)}</DialogTitle>
          <DialogDescription>{t(`enter-6-digits`)}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="2fa-login" onSubmit={form.handleSubmit(onSubmit)}>
            {credentialType === 'otp' ? (
              <FormField
                control={form.control}
                name="totpCode"
                rules={{
                  minLength: 6,
                  maxLength: 6,
                  required: {
                    message: t(`this-field-is-required`),
                    value: true,
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`2fa-code`)}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="xxxxxx"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="backupCode"
                rules={{
                  required: {
                    value: true,
                    message: t(`this-field-is-required`),
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`backup-code`)}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <DialogFooter>
          <div className="flex w-full items-center justify-between">
            <Button
              variant="secondary"
              onClick={() => {
                setCredentialType(credentialType === 'otp' ? 'backup-code' : 'otp');
              }}
            >
              Use {credentialType === 'backup-code' ? 'secret' : ' backup'} code
            </Button>

            <Button type="submit" form="2fa-login">
              {t('submit')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
