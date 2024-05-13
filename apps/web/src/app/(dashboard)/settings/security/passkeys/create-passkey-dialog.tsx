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
        description: 'წარმატებით შეიქმნა passkey',
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
            დაამატე passkey
          </Button>
        )}
      </DialogTrigger>

      <DialogContent position="center">
        <DialogHeader>
          <DialogTitle>დაამატე passkey</DialogTitle>

          <DialogDescription className="mt-4">
            Passkey გაძლევთ საშუალებას შეხვიდეთ და დაადასტუროთ ბიომეტრიის, პაროლის მენეჯერების და
            ა.შ.{' '}
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
                    <FormLabel required>Passkey სახელი</FormLabel>
                    <FormControl>
                      <Input className="bg-background" placeholder="eg. Mac" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert variant="neutral">
                <AlertDescription>
                  როდესაც დააჭირეთ გაგრძელებას, გთხოვთ დაამატოთ პირველი ხელმისაწვდომი
                  ავთენტიფიკატორი თქვენს სისტემაში.
                </AlertDescription>

                <AlertDescription className="mt-2">
                  თუ არ გსურთ მოთხოვნილი ავთენტიფიკატორის გამოყენება, შეგიძლიათ დახუროთ ის, რაც
                  შემდეგ გამოჩენს შემდეგ ხელმისაწვდომ ავთენტიფიკატორს.
                </AlertDescription>
              </Alert>

              {formError && (
                <Alert variant="destructive">
                  {match(formError)
                    .with('ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED', () => (
                      <AlertDescription>ეს passkey უკვე დარეგისტრირებულია.</AlertDescription>
                    ))
                    .with('TOO_MANY_PASSKEYS', () => (
                      <AlertDescription>
                        თქვენ არ შეგიძლიათ გქონდეთ {MAXIMUM_PASSKEYS}-ზე მეტი passkeys.
                      </AlertDescription>
                    ))
                    .with('InvalidStateError', () => (
                      <>
                        <AlertTitle className="text-sm">
                          passkey შექმნა გაუქმდა ერთ-ერთი შემდეგი მიზეზის გამო:
                        </AlertTitle>
                        <AlertDescription>
                          <ul className="mt-1 list-inside list-disc">
                            <li>გაუქმდა მომხმარებლის მიერ</li>
                            <li>Passkey უკვე არსებობს მითითებული ავთენტიფიკატორისთვის</li>
                            <li>Exceeded timeout</li>
                          </ul>
                        </AlertDescription>
                      </>
                    ))
                    .otherwise(() => (
                      <AlertDescription>
                        დაფიქსირდა ხარვეზი. გთხოვთ სცადოთ თავიდან ან დაგვიკავშირდეთ.
                      </AlertDescription>
                    ))}
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  გაუქმება
                </Button>

                <Button type="submit" loading={form.formState.isSubmitting}>
                  გაგრძელება
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
