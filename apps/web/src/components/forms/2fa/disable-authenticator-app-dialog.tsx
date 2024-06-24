'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { flushSync } from 'react-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export const ZDisable2FAForm = z.object({
  token: z.string(),
});

export type TDisable2FAForm = z.infer<typeof ZDisable2FAForm>;

export const DisableAuthenticatorAppDialog = () => {
  const router = useRouter();

  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);

  const { mutateAsync: disable2FA } = trpc.twoFactorAuthentication.disable.useMutation();

  const disable2FAForm = useForm<TDisable2FAForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZDisable2FAForm),
  });

  const { isSubmitting: isDisable2FASubmitting } = disable2FAForm.formState;

  const onDisable2FAFormSubmit = async ({ token }: TDisable2FAForm) => {
    try {
      await disable2FA({ token });

      toast({
        title: 'Two-factor authentication disabled',
        description:
          'Two-factor authentication has been disabled for your account. You will no longer be required to enter a code from your authenticator app when signing in.',
      });

      flushSync(() => {
        setIsOpen(false);
      });

      router.refresh();
    } catch (_err) {
      toast({
        title: 'Unable to disable two-factor authentication',
        description:
          'We were unable to disable two-factor authentication for your account. Please ensure that you have entered your password and backup code correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild={true}>
        <Button className="flex-shrink-0" variant="destructive">
          Disable 2FA
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Disable 2FA</DialogTitle>

          <DialogDescription>
            Please provide a token from the authenticator, or a backup code. If you do not have a
            backup code available, please contact support.
          </DialogDescription>
        </DialogHeader>

        <Form {...disable2FAForm}>
          <form onSubmit={disable2FAForm.handleSubmit(onDisable2FAFormSubmit)}>
            <fieldset className="flex flex-col gap-y-4" disabled={isDisable2FASubmitting}>
              <FormField
                name="token"
                control={disable2FAForm.control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <PinInput {...field} value={field.value ?? ''} maxLength={6}>
                        {Array(6)
                          .fill(null)
                          .map((_, i) => (
                            <PinInputGroup key={i}>
                              <PinInputSlot index={i} />
                            </PinInputGroup>
                          ))}
                      </PinInput>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>

                <Button type="submit" variant="destructive" loading={isDisable2FASubmitting}>
                  Disable 2FA
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
