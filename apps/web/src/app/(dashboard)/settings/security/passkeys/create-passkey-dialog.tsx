'use client';

import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
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

export type CreatePasskeyDialogProps = {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
} & Omit<DialogPrimitive.DialogProps, 'children'>;

const ZCreatePasskeyFormSchema = z.object({
  passkeyName: z.string().min(3),
});

type TCreatePasskeyFormSchema = z.infer<typeof ZCreatePasskeyFormSchema>;

const parser = new UAParser();

export const CreatePasskeyDialog = ({ trigger, onSuccess, ...props }: CreatePasskeyDialogProps) => {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { toast } = useToast();

  const form = useForm<TCreatePasskeyFormSchema>({
    resolver: zodResolver(ZCreatePasskeyFormSchema),
    defaultValues: {
      passkeyName: '',
    },
  });

  const { mutateAsync: createPasskeyRegistrationOptions, isLoading } =
    trpc.auth.createPasskeyRegistrationOptions.useMutation();

  const { mutateAsync: createPasskey } = trpc.auth.createPasskey.useMutation();

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
        description: 'Successfully created passkey',
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
          <Button variant="secondary" loading={isLoading}>
            <KeyRoundIcon className="-ml-1 mr-1 h-5 w-5" />
            Add passkey
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>Add passkey</DialogTitle>

          <DialogDescription className="mt-4">
            Passkeys allow you to sign in and authenticate using biometrics, password managers, etc.
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
                    <FormLabel required>Passkey name</FormLabel>
                    <FormControl>
                      <Input className="bg-background" placeholder="eg. Mac" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert variant="neutral">
                <AlertDescription>
                  When you click continue, you will be prompted to add the first available
                  authenticator on your system.
                </AlertDescription>

                <AlertDescription className="mt-2">
                  If you do not want to use the authenticator prompted, you can close it, which will
                  then display the next available authenticator.
                </AlertDescription>
              </Alert>

              {formError && (
                <Alert variant="destructive">
                  {match(formError)
                    .with('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', () => (
                      <AlertDescription>This passkey has already been registered.</AlertDescription>
                    ))
                    .with('TOO_MANY_PASSKEYS', () => (
                      <AlertDescription>
                        You cannot have more than {MAXIMUM_PASSKEYS} passkeys.
                      </AlertDescription>
                    ))
                    .with('InvalidStateError', () => (
                      <>
                        <AlertTitle className="text-sm">
                          Passkey creation cancelled due to one of the following reasons:
                        </AlertTitle>
                        <AlertDescription>
                          <ul className="mt-1 list-inside list-disc">
                            <li>Cancelled by user</li>
                            <li>Passkey already exists for the provided authenticator</li>
                            <li>Exceeded timeout</li>
                          </ul>
                        </AlertDescription>
                      </>
                    ))
                    .otherwise(() => (
                      <AlertDescription>
                        Something went wrong. Please try again or contact support.
                      </AlertDescription>
                    ))}
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  Continue
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
