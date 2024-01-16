'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { Document, Field, Recipient } from '@documenso/prisma/client';
import { trpc } from '@documenso/trpc/react';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';

import { useRequiredSigningContext } from './provider';
import { SignDialog } from './sign-dialog';

export type SigningFormProps = {
  document: Document;
  recipient: Recipient;
  fields: Field[];
};

const ZSigningpadSchema = z.union([
  z.object({
    signatureDataUrl: z.string().min(1),
    signatureText: z.null().or(z.string().max(0)),
  }),
  z.object({
    signatureDataUrl: z.null().or(z.string().max(0)),
    signatureText: z.string().trim().min(1),
  }),
]);

export type TSigningpadSchema = z.infer<typeof ZSigningpadSchema>;

export const SigningForm = ({ document, recipient, fields }: SigningFormProps) => {
  const router = useRouter();
  const analytics = useAnalytics();
  const { data: session } = useSession();

  const { fullName, signature, setFullName, setSignature } = useRequiredSigningContext();

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

  const { mutateAsync: completeDocumentWithToken } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  console.log(signature);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<TSigningpadSchema>({
    mode: 'onChange',
    defaultValues: {
      signatureDataUrl: signature || null,
      signatureText: '',
    },
    resolver: zodResolver(ZSigningpadSchema),
  });

  const signatureDataUrl = watch('signatureDataUrl');
  const signatureText = watch('signatureText');

  const uninsertedFields = useMemo(() => {
    return sortFieldsByPosition(fields.filter((field) => !field.inserted));
  }, [fields]);

  const fieldsValidated = () => {
    setValidateUninsertedFields(true);
    validateFieldsInserted(fields);
  };

  const onFormSubmit = async () => {
    setValidateUninsertedFields(true);

    const isFieldsValid = validateFieldsInserted(fields);

    if (!isFieldsValid) {
      return;
    }

    await completeDocumentWithToken({
      token: recipient.token,
      documentId: document.id,
    });

    analytics.capture('App: Recipient has completed signing', {
      signerId: recipient.id,
      documentId: document.id,
      timestamp: new Date().toISOString(),
    });

    router.push(`/sign/${recipient.token}/complete`);
  };

  return (
    <form
      className={cn(
        'dark:bg-background border-border bg-widget sticky flex h-full flex-col rounded-xl border px-4 py-6',
        {
          'top-20 max-h-[min(68rem,calc(100vh-6rem))]': session,
          'top-4 max-h-[min(68rem,calc(100vh-2rem))]': !session,
        },
      )}
      onSubmit={handleSubmit(onFormSubmit)}
    >
      {validateUninsertedFields && uninsertedFields[0] && (
        <FieldToolTip key={uninsertedFields[0].id} field={uninsertedFields[0]} color="warning">
          Click to insert field
        </FieldToolTip>
      )}

      <fieldset
        disabled={isSubmitting}
        className={cn('-mx-2 flex flex-1 flex-col overflow-hidden px-2')}
      >
        <div
          className={cn(
            'custom-scrollbar -mx-2 flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2',
          )}
        >
          <h3 className="text-foreground text-2xl font-semibold">Sign Document</h3>

          <p className="text-muted-foreground mt-2 text-sm">
            Please review the document before signing.
          </p>

          <hr className="border-border mb-8 mt-4" />

          <div className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
            <div className="flex flex-1 flex-col gap-y-4">
              <div>
                <Label htmlFor="full-name">Full Name</Label>

                <Input
                  type="text"
                  id="full-name"
                  className="bg-background mt-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.trimStart())}
                />
              </div>

              <div>
                <Label htmlFor="Signature">Signature</Label>

                <Card id="signature" className="mt-4" degrees={-120} gradient>
                  <CardContent role="button" className="relative cursor-pointer pt-6">
                    <div className="flex h-44 items-center justify-center pb-6">
                      {!signatureText && (
                        <SignaturePad
                          className="h-44 w-full"
                          defaultValue={signature ?? undefined}
                          clearSignatureClassName="absolute -bottom-6 -right-2 z-10 cursor-pointer"
                          undoSignatureClassName="absolute -top-32 -left-4 z-10 cursor-pointer"
                          onChange={(value) => {
                            setSignature(value);
                          }}
                        />
                      )}

                      {signatureText && (
                        <p className={cn('text-foreground font-signature text-4xl font-semibold')}>
                          {signatureText}
                        </p>
                      )}
                    </div>

                    <div
                      className="absolute inset-x-0 bottom-0 flex cursor-auto items-end justify-between px-4 pb-1 pt-2"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Input
                        id="signatureText"
                        className="text-foreground placeholder:text-muted-foreground border-0 border-none bg-transparent p-0 text-sm focus-visible:ring-transparent"
                        placeholder="Draw or type name here"
                        disabled={isSubmitting || signature?.startsWith('data:')}
                        {...register('signatureText', {
                          onChange: (e) => {
                            if (e.target.value !== '') {
                              setValue('signatureDataUrl', null);
                            }

                            setValue('signatureText', e.target.value);
                          },

                          onBlur: (e) => {
                            if (e.target.value === '') {
                              return setValue('signatureText', '');
                            }

                            setSignature(e.target.value.trimStart());
                          },
                        })}
                      />
                      {signatureText && (
                        <div className="absolute bottom-3 right-4 z-10 cursor-pointer">
                          <button
                            type="button"
                            className="focus-visible:ring-ring ring-offset-background text-muted-foreground rounded-full p-0 text-xs focus-visible:outline-none focus-visible:ring-2"
                            onClick={() => {
                              setValue('signatureText', '');
                              setValue('signatureDataUrl', null);
                            }}
                          >
                            Clear Signature
                          </button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:flex-row">
              <Button
                type="button"
                className="dark:bg-muted dark:hover:bg-muted/80 w-full  bg-black/5 hover:bg-black/10"
                variant="secondary"
                size="lg"
                disabled={typeof window !== 'undefined' && window.history.length <= 1}
                onClick={() => router.back()}
              >
                Cancel
              </Button>

              <SignDialog
                isSubmitting={isSubmitting}
                onSignatureComplete={handleSubmit(onFormSubmit)}
                document={document}
                fields={fields}
                fieldsValidated={fieldsValidated}
              />
            </div>
          </div>
        </div>
      </fieldset>
    </form>
  );
};
