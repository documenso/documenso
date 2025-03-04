import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { renderSVG } from 'uqr';
import { z } from 'zod';

import { authClient } from '@documenso/auth/client';
import { downloadFile } from '@documenso/lib/client-only/download-file';
import { useSession } from '@documenso/lib/client-only/providers/session';
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
  const { _ } = useLingui();
  const { toast } = useToast();
  const { refreshSession } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [isSettingUp2FA, setIsSettingUp2FA] = useState(false);
  const [setup2FAData, setSetup2FAData] = useState<{ uri: string; secret: string } | null>(null);

  const enable2FAForm = useForm<TEnable2FAForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZEnable2FAForm),
  });

  const { isSubmitting: isEnabling2FA } = enable2FAForm.formState;

  const setup2FA = async () => {
    if (isSettingUp2FA) {
      return;
    }

    setIsSettingUp2FA(true);
    setSetup2FAData(null);

    try {
      const data = await authClient.twoFactor.setup();
      await refreshSession();

      setSetup2FAData(data);
    } catch (err) {
      toast({
        title: _(msg`Unable to setup two-factor authentication`),
        description: _(
          msg`We were unable to setup two-factor authentication for your account. Please ensure that you have entered your code correctly and try again.`,
        ),
        variant: 'destructive',
      });
    }

    setIsSettingUp2FA(false);
  };

  const onEnable2FAFormSubmit = async ({ token }: TEnable2FAForm) => {
    try {
      const data = await authClient.twoFactor.enable({ code: token });
      await refreshSession();

      setRecoveryCodes(data.recoveryCodes);
      onSuccess?.();

      toast({
        title: _(msg`Two-factor authentication enabled`),
        description: _(
          msg`You will now be required to enter a code from your authenticator app when signing in.`,
        ),
      });
    } catch (_err) {
      toast({
        title: _(msg`Unable to setup two-factor authentication`),
        description: _(
          msg`We were unable to setup two-factor authentication for your account. Please ensure that you have entered your code correctly and try again.`,
        ),
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
          <Trans>Enable 2FA</Trans>
        </Button>
      </DialogTrigger>

      <DialogContent position="center">
        {setup2FAData && (
          <>
            {recoveryCodes ? (
              <div>
                <DialogHeader>
                  <DialogTitle>
                    <Trans>Backup codes</Trans>
                  </DialogTitle>
                  <DialogDescription>
                    <Trans>
                      Your recovery codes are listed below. Please store them in a safe place.
                    </Trans>
                  </DialogDescription>
                </DialogHeader>

                <div className="mt-4">
                  <RecoveryCodeList recoveryCodes={recoveryCodes} />
                </div>

                <DialogFooter className="mt-4">
                  <DialogClose asChild>
                    <Button variant="secondary">
                      <Trans>Close</Trans>
                    </Button>
                  </DialogClose>

                  <Button onClick={downloadRecoveryCodes}>
                    <Trans>Download</Trans>
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <Form {...enable2FAForm}>
                <form onSubmit={enable2FAForm.handleSubmit(onEnable2FAFormSubmit)}>
                  <DialogHeader>
                    <DialogTitle>
                      <Trans>Enable Authenticator App</Trans>
                    </DialogTitle>
                    <DialogDescription>
                      <Trans>
                        To enable two-factor authentication, scan the following QR code using your
                        authenticator app.
                      </Trans>
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
                      <Trans>
                        If your authenticator app does not support QR codes, you can use the
                        following code instead:
                      </Trans>
                    </p>

                    <p className="bg-muted/60 text-muted-foreground rounded-lg p-2 text-center font-mono tracking-widest">
                      {setup2FAData?.secret}
                    </p>

                    <p className="text-muted-foreground text-sm">
                      <Trans>
                        Once you have scanned the QR code or entered the code manually, enter the
                        code provided by your authenticator app below.
                      </Trans>
                    </p>

                    <FormField
                      name="token"
                      control={enable2FAForm.control}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">
                            <Trans>Token</Trans>
                          </FormLabel>
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
                        <Button variant="secondary">
                          <Trans>Cancel</Trans>
                        </Button>
                      </DialogClose>

                      <Button type="submit" loading={isEnabling2FA}>
                        <Trans>Enable 2FA</Trans>
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
