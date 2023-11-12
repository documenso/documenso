'use client';

import { useParams } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

import { trpc } from '@documenso/trpc/react';
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
import { PasswordInput } from '@documenso/ui/primitives/input';

type PasswordCheckDialogProps = {
  title: string;
  open: boolean;
  onOpenChange: (_val: boolean) => void;
  onVerified: (_val: string) => Promise<void>;
};

const formSchema = z.object({
  password: z.string().min(6),
});

type TFormSchema = z.infer<typeof formSchema>;

export const PasswordCheckDialog = ({
  title,
  onOpenChange,
  open,
  onVerified,
}: PasswordCheckDialogProps) => {
  const form = useForm<TFormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: '',
    },
  });
  const locale = useParams()?.locale as LocaleTypes;

  const { t } = useTranslation(locale, 'dashboard');
  const { mutateAsync: verifyPassword } = trpc.auth.verifyPassword.useMutation({});

  const onSubmit = async (data: TFormSchema) => {
    const isVerified = (await verifyPassword(data)).verified;
    if (isVerified) {
      await onVerified(data.password);
      form.reset();
    } else {
      form.setError('password', {
        message: 'invalid password',
        type: 'custom',
      });
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t(`confirm-current-password`)}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form id="password-check" onSubmit={form.handleSubmit(onSubmit)}>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t(`current-password`)}</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
        <DialogFooter>
          <Button loading={form.formState.isSubmitting} form="password-check" type="submit">
            {t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
