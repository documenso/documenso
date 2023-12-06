'use client';

import { useMemo, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useSession } from 'next-auth/react';
import { useForm } from 'react-hook-form';

import { TIME_ZONES } from '@documenso/lib/constants/time-zones';
import { completeDocumentWithToken } from '@documenso/lib/server-only/document/complete-document-with-token';
import { sortFieldsByPosition, validateFieldsInserted } from '@documenso/lib/utils/fields';
import type { Document, Field, Recipient } from '@documenso/prisma/client';
import { FieldToolTip } from '@documenso/ui/components/field/field-tooltip';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Card, CardContent } from '@documenso/ui/primitives/card';
import { Input } from '@documenso/ui/primitives/input';
import { Label } from '@documenso/ui/primitives/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@documenso/ui/primitives/select';
import { SignaturePad } from '@documenso/ui/primitives/signature-pad';

import { DATE_FORMATS } from '~/helpers/constants';

import { useRequiredSigningContext } from './provider';
import { SignDialog } from './sign-dialog';

export type SigningFormProps = {
  document: Document;
  recipient: Recipient;
  fields: Field[];
};

export const SigningForm = ({ document, recipient, fields }: SigningFormProps) => {
  const router = useRouter();
  const { data: session } = useSession();

  const {
    fullName,
    signature,
    setFullName,
    setSignature,
    dateFormat,
    setDateFormat,
    timeFormat,
    setTimeFormat,
  } = useRequiredSigningContext();

  const [validateUninsertedFields, setValidateUninsertedFields] = useState(false);

  const hasDateField = fields.find((field) => field.type === 'DATE');

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useForm();

  const uninsertedFields = useMemo(() => {
    return sortFieldsByPosition(fields.filter((field) => !field.inserted));
  }, [fields]);

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

    router.push(`/sign/${recipient.token}/complete`);
  };

  console.log('TZ Bruh', TIME_ZONES);

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
        <div className={cn('flex flex-1 flex-col')}>
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

              {hasDateField && (
                <div>
                  <Label htmlFor="date-format">Date Format</Label>

                  <Select
                    onValueChange={(value) => {
                      setDateFormat(value);
                    }}
                    defaultValue={dateFormat}
                  >
                    <SelectTrigger className="bg-background mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((format) => (
                        <SelectItem key={format.key} value={format.value}>
                          {format.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {hasDateField && (
                <div>
                  <Label htmlFor="time-format">Time Format</Label>

                  <Select
                    onValueChange={(value) => {
                      setTimeFormat(value);
                    }}
                    defaultValue={timeFormat}
                  >
                    <SelectTrigger className="bg-background mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_ZONES.map((zone) => (
                        <SelectItem key={zone} value={zone}>
                          {zone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label htmlFor="Signature">Signature</Label>

                <Card className="mt-2" gradient degrees={-120}>
                  <CardContent className="p-0">
                    <SignaturePad
                      className="h-44 w-full"
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
              />
            </div>
          </div>
        </div>
      </fieldset>
    </form>
  );
};
