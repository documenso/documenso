import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
import { Input } from '@documenso/ui/primitives/input';

import { DocumentSigningDisclosure } from '../general/document-signing/document-signing-disclosure';

export type NextSigner = {
  name: string;
  email: string;
};

type ConfirmationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (nextSigner?: NextSigner) => void;
  hasUninsertedFields: boolean;
  isSubmitting: boolean;
  allowDictateNextSigner?: boolean;
  defaultNextSigner?: NextSigner;
};

const ZNextSignerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

type TNextSignerFormSchema = z.infer<typeof ZNextSignerFormSchema>;

export function AssistantConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  hasUninsertedFields,
  isSubmitting,
  allowDictateNextSigner = false,
  defaultNextSigner,
}: ConfirmationDialogProps) {
  const [isEditingNextSigner, setIsEditingNextSigner] = useState(false);

  const form = useForm<TNextSignerFormSchema>({
    resolver: zodResolver(ZNextSignerFormSchema),
    defaultValues: {
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    },
  });

  const onOpenChange = () => {
    if (form.formState.isSubmitting) {
      return;
    }

    form.reset({
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    });

    setIsEditingNextSigner(false);
    onClose();
  };

  const onFormSubmit = async (data: TNextSignerFormSchema) => {
    if (allowDictateNextSigner && data.name && data.email) {
      await onConfirm({
        name: data.name,
        email: data.email,
      });
    } else {
      await onConfirm();
    }
  };

  const isNextSignerValid = !allowDictateNextSigner || (form.watch('name') && form.watch('email'));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset
              disabled={form.formState.isSubmitting || isSubmitting}
              className="border-none p-0"
            >
              <DialogHeader>
                <DialogTitle>
                  <Trans>Complete Document</Trans>
                </DialogTitle>
                <DialogDescription>
                  <Trans>
                    Are you sure you want to complete the document? This action cannot be undone.
                    Please ensure that you have completed prefilling all relevant fields before
                    proceeding.
                  </Trans>
                </DialogDescription>
              </DialogHeader>

              <div className="mt-4 flex flex-col gap-4">
                {allowDictateNextSigner && (
                  <div className="space-y-4">
                    {!isEditingNextSigner && (
                      <div>
                        <p className="text-muted-foreground text-sm">
                          The next recipient to sign this document will be{' '}
                          <span className="font-semibold">{form.watch('name')}</span> (
                          <span className="font-semibold">{form.watch('email')}</span>).
                        </p>

                        <Button
                          type="button"
                          className="mt-2"
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditingNextSigner((prev) => !prev)}
                        >
                          <Trans>Update Recipient</Trans>
                        </Button>
                      </div>
                    )}

                    {isEditingNextSigner && (
                      <div className="flex flex-col gap-4 md:flex-row">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Name</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  className="mt-2"
                                  placeholder="Enter the next signer's name"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel>
                                <Trans>Email</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="email"
                                  className="mt-2"
                                  placeholder="Enter the next signer's email"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}

                <DocumentSigningDisclosure className="mt-4" />
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onClose}
                  disabled={form.formState.isSubmitting}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  type="submit"
                  variant={hasUninsertedFields ? 'destructive' : 'default'}
                  disabled={form.formState.isSubmitting || !isNextSignerValid}
                  loading={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? (
                    <Trans>Submitting...</Trans>
                  ) : hasUninsertedFields ? (
                    <Trans>Proceed</Trans>
                  ) : (
                    <Trans>Continue</Trans>
                  )}
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
