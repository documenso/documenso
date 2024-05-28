'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { renderSVG } from 'uqr';
import { z } from 'zod';

import { downloadFile } from '@documenso/lib/client-only/download-file';
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
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { RecoveryCodeList } from './recovery-code-list';

export const ZEnable2FAForm = z.object({
  token: z.string(),
});

export type TEnable2FAForm = z.infer<typeof ZEnable2FAForm>;

export type EnableAuthenticatorAppDialogProps = {
  onSuccess?: () => void;
};

export const EnableAuthenticatorAppDialog = ({ onSuccess }: EnableAuthenticatorAppDialogProps) => {
  const { toast } = useToast();

  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const { mutateAsync: enable2FA } = trpc.twoFactorAuthentication.enable.useMutation();

  const {
    mutateAsync: setup2FA,
    data: setup2FAData,
    isLoading: isSettingUp2FA,
  } = trpc.twoFactorAuthentication.setup.useMutation({
    onError: () => {
      toast({
        title: 'Unable to setup two-factor authentication',
        description:
          'We were unable to setup two-factor authentication for your account. Please ensure that you have entered your code correctly and try again.',
        variant: 'destructive',
      });
    },
  });

  const enable2FAForm = useForm<TEnable2FAForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZEnable2FAForm),
  });

  const { isSubmitting: isEnabling2FA } = enable2FAForm.formState;

  const onEnable2FAFormSubmit = async ({ token }: TEnable2FAForm) => {
    try {
      const data = await enable2FA({ code: token });

      setRecoveryCodes(data.recoveryCodes);
      onSuccess?.();

      toast({
        title: 'Two-factor authentication enabled',
        description:
          'You will now be required to enter a code from your authenticator app when signing in.',
      });
    } catch (_err) {
      toast({
        title: 'Unable to setup two-factor authentication',
        description:
          'We were unable to setup two-factor authentication for your account. Please ensure that you have entered your code correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  const downloadRecoveryCodes = () => {
    if (recoveryCodes) {
      const blob = new Blob([recoveryCodes.join('\n')], {
        type: 'text/plain',
      });

      downloadFile({
        filename: 'documenso-2FA-recovery-codes.txt',
        data: blob,
      });
    }
  };

  const handleEnable2FA = async () => {
    if (!setup2FAData) {
      await setup2FA();
    }

    setIsOpen(true);
  };

  useEffect(() => {
    enable2FAForm.reset();

    if (!isOpen && recoveryCodes && recoveryCodes.length > 0) {
      setRecoveryCodes(null);
      router.refresh();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild={true}>
        <Button
          className="flex-shrink-0"
          loading={isSettingUp2FA}
          onClick={(e) => {
            e.preventDefault();
            void handleEnable2FA();
          }}
        >
          Enable 2FA
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        {setup2FAData && (
          <>
            {recoveryCodes ? (
              <div>
                <DialogHeader>
                  <DialogTitle>Backup codes</DialogTitle>
                  <DialogDescription>
                    Your recovery codes are listed below. Please store them in a safe place.
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                  <RecoveryCodeList recoveryCodes={recoveryCodes} />
                </div>

                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">Close</Button>
                  </DialogClose>

                  <Button onClick={downloadRecoveryCodes}>Download</Button>
                </DialogFooter>
              </div>
            ) : (
              <Form {...enable2FAForm}>
                <form onSubmit={enable2FAForm.handleSubmit(onEnable2FAFormSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Enable Authenticator App</DialogTitle>
                    <DialogDescription>
                      To enable two-factor authentication, scan the following QR code using your
                      authenticator app.
                    </DialogDescription>
                  </DialogHeader>

                  <fieldset disabled={isEnabling2FA} className="mt-4 flex flex-col gap-y-4">
                    <div
                      className="flex h-36 justify-center"
                      dangerouslySetInnerHTML={{
                        __html: renderSVG(setup2FAData?.uri ?? ''),
                      }}
                    />

                    <p className="text-muted-foreground text-sm">
                      If your authenticator app does not support QR codes, you can use the following
                      code instead:
                    </p>

                    <p className="bg-muted/60 text-muted-foreground rounded-lg p-2 text-center font-mono tracking-widest">
                      {setup2FAData?.secret}
                    </p>

                    <p className="text-muted-foreground text-sm">
                      Once you have scanned the QR code or entered the code manually, enter the code
                      provided by your authenticator app below.
                    </p>

                    <FormField
                      name="token"
                      control={enable2FAForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">Token</FormLabel>
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
                        <Button variant="secondary">Cancel</Button>
                      </DialogClose>

                      <Button type="submit" loading={isEnabling2FA}>
                        Enable 2FA
                      </Button>
                    </DialogFooter>
                  </fieldset>
                </form>
              </Form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
