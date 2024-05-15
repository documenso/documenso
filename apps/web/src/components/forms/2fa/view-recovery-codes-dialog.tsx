'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { AppError } from '@documenso/lib/errors/app-error';
import { ErrorCode } from '@documenso/lib/next-auth/error-codes';
import { trpc } from '@documenso/trpc/react';
import { Alert, AlertDescription } from '@documenso/ui/primitives/alert';
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
import { Input } from '@documenso/ui/primitives/input';

import { RecoveryCodeList } from './recovery-code-list';

export const ZViewRecoveryCodesForm = z.object({
  token: z.string().min(1, { message: 'Token is required' }),
});

export type TViewRecoveryCodesForm = z.infer<typeof ZViewRecoveryCodesForm>;

export const ViewRecoveryCodesDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  const {
    data: recoveryCodes,
    mutate,
    isLoading,
    error,
  } = trpc.twoFactorAuthentication.viewRecoveryCodes.useMutation();

  const viewRecoveryCodesForm = useForm<TViewRecoveryCodesForm>({
    defaultValues: {
      token: '',
    },
    resolver: zodResolver(ZViewRecoveryCodesForm),
  });

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

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="flex-shrink-0">View Codes</Button>
      </DialogTrigger>

      <DialogContent className="w-full max-w-xl md:max-w-xl lg:max-w-xl">
        {recoveryCodes ? (
          <div>
            <DialogHeader className="mb-4">
              <DialogTitle>იხილეთ აღდგენის კოდები</DialogTitle>

              <DialogDescription>
                თქვენი აღდგენის კოდები მოცემულია ქვემოთ. გთხოვთ შეინახოთ ისინი უსაფრთხო ადგილას.
              </DialogDescription>
            </DialogHeader>

            <RecoveryCodeList recoveryCodes={recoveryCodes} />

            <DialogFooter className="mt-4">
              <DialogClose asChild>
                <Button variant="secondary">დახურვა</Button>
              </DialogClose>

              <Button onClick={downloadRecoveryCodes}>ჩამოტვირთვა</Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...viewRecoveryCodesForm}>
            <form onSubmit={viewRecoveryCodesForm.handleSubmit((value) => mutate(value))}>
              <DialogHeader className="mb-4">
                <DialogTitle>იხილეთ აღდგენის კოდები</DialogTitle>

                <DialogDescription>
                  გთხოვთ მოგვაწოდოთ ტოკენი თქვენი ავთენტიფიკატორიდან ან სარეზერვო კოდი.
                </DialogDescription>
              </DialogHeader>

              <fieldset className="flex flex-col space-y-4" disabled={isLoading}>
                <FormField
                  name="token"
                  control={viewRecoveryCodesForm.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input {...field} placeholder="Token" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {match(AppError.parseError(error).message)
                        .with(
                          ErrorCode.INCORRECT_TWO_FACTOR_CODE,
                          () => 'არასწორი კოდი. გთხოვთ თავიდან სცადოთ.',
                        )
                        .otherwise(
                          () => 'დაფიქსირდა ხარვეზი. გთხოვთ თავიდან სცადოთ ან დაგვიკავშირდეთ.',
                        )}
                    </AlertDescription>
                  </Alert>
                )}

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      დახურვა
                    </Button>
                  </DialogClose>

                  <Button type="submit" loading={isLoading}>
                    ნახვა
                  </Button>
                </DialogFooter>
              </fieldset>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
