'use client';

import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/macro';
import { ArrowRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import type { Field } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogClose,
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

import { SigningDisclosure } from '~/components/general/signing-disclosure';

export type StepSignDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: (nextSigner?: { email: string; name: string }) => void | Promise<void>;
  role: RecipientRole;
  disabled?: boolean;
  canModifyNextSigner?: boolean;
};

const formSchema = z.object({
  nextSigner: z
    .object({
      email: z.string().email({ message: 'Please enter a valid email address' }).optional(),
      name: z.string().min(1, { message: 'Name is required' }).optional(),
    })
    .refine(
      (data) => {
        if (data.name) {
          return !!data.email;
        }
        return true;
      },
      {
        message: 'Email is required when name is provided',
        path: ['email'],
      },
    ),
});

type TFormSchema = z.infer<typeof formSchema>;

export default function StepSignDialog({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
  disabled = false,
  canModifyNextSigner = false,
}: StepSignDialogProps) {
  const [step, setStep] = useState(1);
  const [showDialog, setShowDialog] = useState(false);

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  const handleOpenChange = (open: boolean) => {
    if (isSubmitting || !isComplete) {
      return;
    }

    setShowDialog(open);
  };

  const totalSteps = 2;

  const handleContinue = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const form = useForm<TFormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nextSigner: {
        email: '',
        name: '',
      },
    },
  });

  const onFormSubmit = async (data: TFormSchema) => {
    try {
      await fieldsValidated();

      if (!canModifyNextSigner || !data.nextSigner.email) {
        await onSignatureComplete();
        return;
      }

      await onSignatureComplete({
        email: data.nextSigner.email.trim().toLowerCase(),
        name: data.nextSigner.name?.trim() ?? '',
      });

      setShowDialog(false);
      form.reset();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      {!canModifyNextSigner ? (
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
              {isComplete ? <Trans>Complete</Trans> : <Trans>Next field</Trans>}
            </Button>
          </DialogTrigger>

          <DialogContent>
            <DialogTitle>
              <div className="text-foreground text-xl font-semibold">
                {role === RecipientRole.VIEWER && <Trans>Complete Viewing</Trans>}
                {role === RecipientRole.SIGNER && <Trans>Complete Signing</Trans>}
                {role === RecipientRole.APPROVER && <Trans>Complete Approval</Trans>}
              </div>
            </DialogTitle>

            <div className="text-muted-foreground max-w-[50ch]">
              {role === RecipientRole.VIEWER && (
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
              )}
              {role === RecipientRole.SIGNER && (
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
              )}
              {role === RecipientRole.APPROVER && (
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
              )}
            </div>

            <SigningDisclosure className="mt-4" />

            <DialogFooter>
              <div className="flex w-full flex-1 flex-nowrap gap-4">
                <Button
                  type="button"
                  className="dark:bg-muted dark:hover:bg-muted/80 flex-1 bg-black/5 hover:bg-black/10"
                  variant="secondary"
                  onClick={() => {
                    setShowDialog(false);
                  }}
                >
                  <Trans>Cancel</Trans>
                </Button>

                <Button
                  type="button"
                  className="flex-1"
                  disabled={!isComplete}
                  loading={isSubmitting}
                  onClick={async (e) => {
                    e.preventDefault();
                    await onSignatureComplete();
                  }}
                >
                  {role === RecipientRole.VIEWER && <Trans>Mark as Viewed</Trans>}
                  {role === RecipientRole.SIGNER && <Trans>Sign</Trans>}
                  {role === RecipientRole.APPROVER && <Trans>Approve</Trans>}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Dialog
          onOpenChange={(open) => {
            if (open) setStep(1);
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="w-full"
              type="button"
              size="lg"
              onClick={fieldsValidated}
              loading={isSubmitting}
              disabled={disabled}
            >
              {isComplete ? <Trans>Complete</Trans> : <Trans>Next field</Trans>}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>
              {step === 1 && (
                <div className="text-foreground text-xl font-semibold">
                  <Trans>Modify Next Signer</Trans>
                </div>
              )}

              {step === 2 && (
                <div className="text-foreground text-xl font-semibold">
                  {role === RecipientRole.VIEWER && <Trans>Complete Viewing</Trans>}
                  {role === RecipientRole.SIGNER && <Trans>Complete Signing</Trans>}
                  {role === RecipientRole.APPROVER && <Trans>Complete Approval</Trans>}
                </div>
              )}
            </DialogTitle>

            {step === 1 && (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onFormSubmit)} className="flex flex-col gap-y-4">
                  <FormField
                    control={form.control}
                    name="nextSigner.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Next Signer Email</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nextSigner.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          <Trans>Next Signer Name</Trans>
                        </FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {step === 2 && (
              <>
                <div className="text-muted-foreground max-w-[50ch]">
                  {role === RecipientRole.VIEWER && (
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
                  )}
                  {role === RecipientRole.SIGNER && (
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
                  )}
                  {role === RecipientRole.APPROVER && (
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
                  )}
                </div>

                <SigningDisclosure className="mt-4" />
              </>
            )}

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex justify-center space-x-1.5 max-sm:order-1">
                {[...Array(totalSteps)].map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setStep(index + 1)}
                    className={cn(
                      'bg-primary h-1.5 w-1.5 rounded-full',
                      index + 1 === step ? 'bg-primary' : 'opacity-20',
                    )}
                    type="button"
                    aria-label={`Go to step ${index + 1}`}
                  />
                ))}
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="ghost">
                    Cancel
                  </Button>
                </DialogClose>
                {step === 1 && (
                  <Button className="group" type="button" onClick={handleContinue}>
                    Next
                    <ArrowRight
                      className="-me-1 ms-2 opacity-60 transition-transform group-hover:translate-x-0.5"
                      size={16}
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  </Button>
                )}

                {step === 2 && (
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={!isComplete}
                    loading={isSubmitting}
                    onClick={form.handleSubmit(onFormSubmit)}
                  >
                    {role === RecipientRole.VIEWER && <Trans>Mark as Viewed</Trans>}
                    {role === RecipientRole.SIGNER && <Trans>Sign</Trans>}
                    {role === RecipientRole.APPROVER && <Trans>Approve</Trans>}
                  </Button>
                )}
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
