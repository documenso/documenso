'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { ErrorCode, isErrorCode } from '@documenso/lib/next-auth/error-codes';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
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

type AuthenticatorAppDisableDialogProps = {
  open: boolean;
  onOpenChange: (_val: boolean) => void;
  onDisabled: () => void;
};

const formSchema = z.object({
  password: z.string().min(6),
  code: z.string().optional(),
  backupCode: z.string().optional(),
});

type TFormSchema = z.infer<typeof formSchema>;

const FIELD_ERROR_MESSAGES: Partial<
  Record<keyof typeof ErrorCode, { message: string; field: keyof TFormSchema }>
> = {
  [ErrorCode.INCORRECT_PASSWORD]: { message: 'incorrect password', field: 'password' },
  [ErrorCode.INCORRECT_TWO_FACTOR_CODE]: { message: 'incorrect 2fa code', field: 'code' },
  [ErrorCode.INCORRECT_TWO_FACTOR_BACKUP_CODE]: {
    message: 'incorrect backup code',
    field: 'backupCode',
  },
};

export const AuthenticatorAppDisableDialog = ({
  onOpenChange,
  open,
  onDisabled,
}: AuthenticatorAppDisableDialogProps) => {
  const { toast } = useToast();

  const [credentialType, setCredentialType] = useState<'backup-code' | 'otp'>('otp');

  const form = useForm<TFormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
      code: '',
    },
  });

  const { mutateAsync: disable } = trpc.twoFactor.disable.useMutation({
    onSuccess: () => {
      onDisabled();
      form.reset();
      toast({
        title: 'Success',
        description: 'successfully disabled 2fa',
        variant: 'default',
      });
    },

    onError: ({ message }) => {
      if (isErrorCode(message)) {
        const fieldError = FIELD_ERROR_MESSAGES?.[message];
        if (fieldError) {
          form.setError(fieldError.field, {
            type: `custom`,
            message: fieldError.message,
          });
        }
      }
    },
  });

  const onSubmit = async (data: TFormSchema) => {
    try {
      await disable(data);
    } catch (error) {
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        form.reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            className="flex flex-col gap-y-4"
            id="disable-2fa"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {credentialType === 'otp' ? (
              <FormField
                control={form.control}
                name="code"
                rules={{
                  minLength: 6,
                  maxLength: 6,
                  required: {
                    message: 'this field is required',
                    value: true,
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Two-Factor Code</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                    message: 'this field is required',
                    value: true,
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Backup Code</FormLabel>
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

            <Button disabled={form.formState.isSubmitting} type="submit" form="disable-2fa">
              Disable
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
