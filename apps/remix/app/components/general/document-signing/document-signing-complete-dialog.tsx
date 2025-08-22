import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

export type DocumentSigningCompleteDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: (nextSigner?: { name: string; email: string }) => void | Promise<void>;
  role: RecipientRole;
  disabled?: boolean;
  allowDictateNextSigner?: boolean;
  defaultNextSigner?: {
    name: string;
    email: string;
  };
};

const ZNextSignerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

type TNextSignerFormSchema = z.infer<typeof ZNextSignerFormSchema>;

export const DocumentSigningCompleteDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
  disabled = false,
  allowDictateNextSigner = false,
  defaultNextSigner,
}: DocumentSigningCompleteDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [isEditingNextSigner, setIsEditingNextSigner] = useState(false);

  const form = useForm<TNextSignerFormSchema>({
    resolver: allowDictateNextSigner ? zodResolver(ZNextSignerFormSchema) : undefined,
    defaultValues: {
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    },
  });

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  const handleOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting || !isComplete) {
      return;
    }

    if (open) {
      form.reset({
        name: defaultNextSigner?.name ?? '',
        email: defaultNextSigner?.email ?? '',
      });
    }

    setIsEditingNextSigner(false);
    setShowDialog(open);
  };

  const onFormSubmit = async (data: TNextSignerFormSchema) => {
    try {
      if (allowDictateNextSigner && data.name && data.email) {
        await onSignatureComplete({ name: data.name, email: data.email });
      } else {
        await onSignatureComplete();
      }
    } catch (error) {
      console.error('Error completing signature:', error);
    }
  };

  const isNextSignerValid = !allowDictateNextSigner || (form.watch('name') && form.watch('email'));

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size="lg"
          onClick={fieldsValidated}
          loading={isSubmitting}
          disabled={disabled}
        >
          {match({ isComplete, role })
            .with({ isComplete: false }, () => <Trans>Next field</Trans>)
            .with({ isComplete: true, role: RecipientRole.APPROVER }, () => <Trans>Approve</Trans>)
            .with({ isComplete: true, role: RecipientRole.VIEWER }, () => (
              <Trans>Mark as viewed</Trans>
            ))
            .with({ isComplete: true }, () => <Trans>Complete</Trans>)
            .exhaustive()}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="border-none p-0">
              <DialogTitle>
                <div className="text-foreground text-xl font-semibold">
                  {match(role)
                    .with(RecipientRole.VIEWER, () => <Trans>Complete Viewing</Trans>)
                    .with(RecipientRole.SIGNER, () => <Trans>Complete Signing</Trans>)
                    .with(RecipientRole.APPROVER, () => <Trans>Complete Approval</Trans>)
                    .with(RecipientRole.CC, () => <Trans>Complete Viewing</Trans>)
                    .with(RecipientRole.ASSISTANT, () => <Trans>Complete Assisting</Trans>)
                    .exhaustive()}
                </div>
              </DialogTitle>

              <div className="text-muted-foreground max-w-[50ch]">
                {match(role)
                  .with(RecipientRole.VIEWER, () => (
                    <span>
                      <Trans>
                        <span className="inline-flex flex-wrap">
                          You are about to complete viewing "
                          <span className="inline-block max-w-[11rem] truncate align-baseline">
                            {documentTitle}
                          </span>
                          ".
                        </span>
                        <br /> Are you sure?
                      </Trans>
                    </span>
                  ))
                  .with(RecipientRole.SIGNER, () => (
                    <span>
                      <Trans>
                        <span className="inline-flex flex-wrap">
                          You are about to complete signing "
                          <span className="inline-block max-w-[11rem] truncate align-baseline">
                            {documentTitle}
                          </span>
                          ".
                        </span>
                        <br /> Are you sure?
                      </Trans>
                    </span>
                  ))
                  .with(RecipientRole.APPROVER, () => (
                    <span>
                      <Trans>
                        <span className="inline-flex flex-wrap">
                          You are about to complete approving{' '}
                          <span className="inline-block max-w-[11rem] truncate align-baseline">
                            "{documentTitle}"
                          </span>
                          .
                        </span>
                        <br /> Are you sure?
                      </Trans>
                    </span>
                  ))
                  .otherwise(() => (
                    <span>
                      <Trans>
                        <span className="inline-flex flex-wrap">
                          You are about to complete viewing "
                          <span className="inline-block max-w-[11rem] truncate align-baseline">
                            {documentTitle}
                          </span>
                          ".
                        </span>
                        <br /> Are you sure?
                      </Trans>
                    </span>
                  ))}
              </div>

              {allowDictateNextSigner && (
                <div className="mt-4 flex flex-col gap-4">
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

              <DialogFooter className="mt-4">
                <div className="flex w-full flex-1 flex-nowrap gap-4">
                  <Button
                    type="button"
                    className="flex-1"
                    variant="secondary"
                    onClick={() => setShowDialog(false)}
                    disabled={form.formState.isSubmitting}
                  >
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!isComplete || !isNextSignerValid}
                    loading={form.formState.isSubmitting}
                  >
                    {match(role)
                      .with(RecipientRole.VIEWER, () => <Trans>Mark as Viewed</Trans>)
                      .with(RecipientRole.SIGNER, () => <Trans>Sign</Trans>)
                      .with(RecipientRole.APPROVER, () => <Trans>Approve</Trans>)
                      .with(RecipientRole.CC, () => <Trans>Mark as Viewed</Trans>)
                      .with(RecipientRole.ASSISTANT, () => <Trans>Complete</Trans>)
                      .exhaustive()}
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
