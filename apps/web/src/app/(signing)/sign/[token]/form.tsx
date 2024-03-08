'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';

import { useAnalytics } from '@documenso/lib/client-only/hooks/use-analytics';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import { type Document, type Field, type Recipient, RecipientRole } from '@documenso/prisma/client';
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
  redirectUrl?: string | null;
};

export const SigningForm = ({ document, recipient, fields, redirectUrl }: SigningFormProps) => {
  const router = useRouter();
  const analytics = useAnalytics();
  const { data: session } = useSession();

  const { fullName, signature, setFullName, setSignature } = useRequiredSigningContext();

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

  const { mutateAsync: completeDocumentWithToken } =
    trpc.recipient.completeDocumentWithToken.useMutation();

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

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

    redirectUrl ? router.push(redirectUrl) : router.push(`/sign/${recipient.token}/complete`);
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
        className={cn(
          'custom-scrollbar -mx-2 flex flex-1 flex-col overflow-y-auto overflow-x-hidden px-2',
        )}
      >
        <div className={cn('flex flex-1 flex-col')}>
          <h3 className="text-foreground text-2xl font-semibold">
            {recipient.role === RecipientRole.VIEWER && 'View Document'}
            {recipient.role === RecipientRole.SIGNER && 'Sign Document'}
            {recipient.role === RecipientRole.APPROVER && 'Approve Document'}
          </h3>

          {recipient.role === RecipientRole.VIEWER ? (
            <>
              <p className="text-muted-foreground mt-2 text-sm">
                Please mark as viewed to complete
              </p>

              <hr className="border-border mb-8 mt-4" />

              <div className="-mx-2 flex flex-1 flex-col gap-4 overflow-y-auto px-2">
                <div className="flex flex-1 flex-col gap-y-4" />
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
                    role={recipient.role}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
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

                    <Card className="mt-2" gradient degrees={-120}>
                      <CardContent className="p-0">
                        <SignaturePad
                          className="h-44 w-full"
                          disabled={isSubmitting}
                          defaultValue={signature ?? undefined}
                          onChange={(value) => {
                            setSignature(value);
                          }}
                        />
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
                    role={recipient.role}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </fieldset>
    </form>
  );
};
