import { useEffect, useMemo } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { downloadFile } from '@documenso/lib/client-only/download-file';
import { trpc } from '@documenso/trpc/react';
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
import { PasswordInput } from '@documenso/ui/primitives/password-input';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { RecoveryCodeList } from './recovery-code-list';

export const ZViewRecoveryCodesForm = z.object({
  password: z.string().min(6).max(72),
});

export type TViewRecoveryCodesForm = z.infer<typeof ZViewRecoveryCodesForm>;

export type ViewRecoveryCodesDialogProps = {
  open: boolean;
  onOpenChange: (_open: boolean) => void;
};

export const ViewRecoveryCodesDialog = ({ open, onOpenChange }: ViewRecoveryCodesDialogProps) => {
  const { toast } = useToast();

  const {
    mutateAsync: viewRecoveryCodes,
    data: viewRecoveryCodesData,
    isLoading: isViewRecoveryCodesDataLoading,
  } = trpc.twoFactorAuthentication.viewRecoveryCodes.useMutation();

  const viewRecoveryCodesForm = useForm<TViewRecoveryCodesForm>({
    defaultValues: {
      password: '',
    },
    resolver: zodResolver(ZViewRecoveryCodesForm),
  });

  const { isSubmitting: isViewRecoveryCodesSubmitting } = viewRecoveryCodesForm.formState;

  const step = useMemo(() => {
    if (!viewRecoveryCodesData || isViewRecoveryCodesSubmitting) {
      return 'authenticate';
    }

    return 'view';
  }, [viewRecoveryCodesData, isViewRecoveryCodesSubmitting]);

  const downloadRecoveryCodes = () => {
    if (viewRecoveryCodesData && viewRecoveryCodesData.recoveryCodes) {
      const blob = new Blob([viewRecoveryCodesData.recoveryCodes.join('\n')], {
        type: 'text/plain',
      });

      downloadFile({
        filename: 'documenso-2FA-recovery-codes.txt',
        data: blob,
      });
    }
  };

  const onViewRecoveryCodesFormSubmit = async ({ password }: TViewRecoveryCodesForm) => {
    try {
      await viewRecoveryCodes({ password });
    } catch (_err) {
      toast({
        title: 'Unable to view recovery codes',
        description:
          'We were unable to view your recovery codes. Please ensure that you have entered your password correctly and try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    // Reset the form when the Dialog closes
    if (!open) {
      viewRecoveryCodesForm.reset();
    }
  }, [open, viewRecoveryCodesForm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xl md:max-w-xl lg:max-w-xl">
        <DialogHeader>
          <DialogTitle>View Recovery Codes</DialogTitle>

          {step === 'authenticate' && (
            <DialogDescription>
              To view your recovery codes, please enter your password below.
            </DialogDescription>
          )}

          {step === 'view' && (
            <DialogDescription>
              Your recovery codes are listed below. Please store them in a safe place.
            </DialogDescription>
          )}
        </DialogHeader>

        {match(step)
          .with('authenticate', () => {
            return (
              <Form {...viewRecoveryCodesForm}>
                <form
                  onSubmit={viewRecoveryCodesForm.handleSubmit(onViewRecoveryCodesFormSubmit)}
                  className="flex flex-col gap-y-4"
                >
                  <FormField
                    name="password"
                    control={viewRecoveryCodesForm.control}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">Password</FormLabel>
                        <FormControl>
                          <PasswordInput
                            {...field}
                            autoComplete="current-password"
                            value={field.value ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                      Cancel
                    </Button>

                    <Button type="submit" loading={isViewRecoveryCodesSubmitting}>
                      Continue
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            );
          })
          .with('view', () => (
            <div>
              {viewRecoveryCodesData?.recoveryCodes && (
                <RecoveryCodeList recoveryCodes={viewRecoveryCodesData.recoveryCodes} />
              )}

              <div className="mt-4 flex flex-row-reverse items-center gap-2">
                <Button onClick={() => onOpenChange(false)}>Complete</Button>

                <Button
                  variant="secondary"
                  disabled={!viewRecoveryCodesData?.recoveryCodes}
                  loading={isViewRecoveryCodesDataLoading}
                  onClick={downloadRecoveryCodes}
                >
                  Download
                </Button>
              </div>
            </div>
          ))
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};
