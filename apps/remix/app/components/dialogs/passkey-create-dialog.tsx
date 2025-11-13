import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import type * as DialogPrimitive from '@radix-ui/react-dialog';
import { startRegistration } from '@simplewebauthn/browser';
import { KeyRoundIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { UAParser } from 'ua-parser-js';
import { z } from 'zod';

import { MAXIMUM_PASSKEYS } from '@documenso/lib/constants/auth';
import { AppError } from '@documenso/lib/errors/app-error';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
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
import { Input } from '@documenso/ui/primitives/input';
import { useToast } from '@documenso/ui/primitives/use-toast';

export type PasskeyCreateDialogProps = {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreatePasskeyFormSchema = z.object({
  passkeyName: z.string().min(3),
});

type TCreatePasskeyFormSchema = z.infer<typeof ZCreatePasskeyFormSchema>;

const parser = new UAParser();

export const PasskeyCreateDialog = ({ trigger, onSuccess, ...props }: PasskeyCreateDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { t } = useLingui();
  const { toast } = useToast();

  const form = useForm<TCreatePasskeyFormSchema>({
    resolver: zodResolver(ZCreatePasskeyFormSchema),
    defaultValues: {
      passkeyName: '',
    },
  });

  const { mutateAsync: createPasskeyRegistrationOptions, isPending } =
    trpc.auth.passkey.createRegistrationOptions.useMutation();

  const { mutateAsync: createPasskey } = trpc.auth.passkey.create.useMutation();

  const onFormSubmit = async ({ passkeyName }: TCreatePasskeyFormSchema) => {
    setFormError(null);

    try {
      const passkeyRegistrationOptions = await createPasskeyRegistrationOptions();

      const registrationResult = await startRegistration(passkeyRegistrationOptions);

      await createPasskey({
        passkeyName,
        verificationResponse: registrationResult,
      });

      toast({
        description: t`Successfully created passkey`,
        duration: 5000,
      });

      onSuccess?.();
      setOpen(false);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        return;
      }

      const error = AppError.parseError(err);

      setFormError(err.code || error.code);
    }
  };

  const extractDefaultPasskeyName = () => {
    if (!window || !window.navigator) {
      return;
    }

    parser.setUA(window.navigator.userAgent);

    const result = parser.getResult();
    const operatingSystem = result.os.name;
    const browser = result.browser.name;

    let passkeyName = '';

    if (operatingSystem && browser) {
      passkeyName = `${browser} (${operatingSystem})`;
    }

    return passkeyName;
  };

  useEffect(() => {
    if (!open) {
      const defaultPasskeyName = extractDefaultPasskeyName();

      form.reset({
        passkeyName: defaultPasskeyName,
      });

      setFormError(null);
    }
  }, [open, form]);

  return (
    <Dialog
      {...props}
      open={open}
      onOpenChange={(value) => !form.formState.isSubmitting && setOpen(value)}
    >
      <DialogTrigger onClick={(e) => e.stopPropagation()} asChild={true}>
        {trigger ?? (
          <Button variant="secondary" loading={isPending}>
            <KeyRoundIcon className="-ml-1 mr-1 h-5 w-5" />
            <Trans>Add passkey</Trans>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>
            <Trans>Add passkey</Trans>
          </DialogTitle>

          <DialogDescription className="mt-4">
            <Trans>
              Passkeys allow you to sign in and authenticate using biometrics, password managers,
              etc.
            </Trans>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              className="flex h-full flex-col space-y-4"
              disabled={form.formState.isSubmitting}
            >
              <FormField
                control={form.control}
                name="passkeyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>
                      <Trans>Passkey name</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input className="bg-background" placeholder={t`eg. Mac`} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert variant="neutral">
                <AlertDescription>
                  <Trans>
                    When you click continue, you will be prompted to add the first available
                    authenticator on your system.
                  </Trans>
                </AlertDescription>

                <AlertDescription className="mt-2">
                  <Trans>
                    If you do not want to use the authenticator prompted, you can close it, which
                    will then display the next available authenticator.
                  </Trans>
                </AlertDescription>
              </Alert>

              {formError && (
                <Alert variant="destructive">
                  {match(formError)
                    .with('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', () => (
                      <AlertDescription>
                        <Trans>This passkey has already been registered.</Trans>
                      </AlertDescription>
                    ))
                    .with('TOO_MANY_PASSKEYS', () => (
                      <AlertDescription>
                        <Plural
                          value={MAXIMUM_PASSKEYS}
                          one="You cannot have more than # passkey."
                          other="You cannot have more than # passkeys."
                        />
                      </AlertDescription>
                    ))
                    .with('InvalidStateError', () => (
                      <>
                        <AlertTitle className="text-sm">
                          <Trans>
                            Passkey creation cancelled due to one of the following reasons:
                          </Trans>
                        </AlertTitle>
                        <AlertDescription>
                          <ul className="mt-1 list-inside list-disc">
                            <li>
                              <Trans>Cancelled by user</Trans>
                            </li>
                            <li>
                              <Trans>Passkey already exists for the provided authenticator</Trans>
                            </li>
                            <li>
                              <Trans>Exceeded timeout</Trans>
                            </li>
                          </ul>
                        </AlertDescription>
                      </>
                    ))
                    .otherwise(() => (
                      <AlertDescription>
                        <Trans>Something went wrong. Please try again or contact support.</Trans>
                      </AlertDescription>
                    ))}
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  <Trans>Continue</Trans>
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
