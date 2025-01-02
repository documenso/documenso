import { useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Plural, Trans } from '@lingui/react/macro';
import type { Field, Recipient } from '@prisma/client';
import { FieldType } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { useRevalidator } from 'react-router';
import { P, match } from 'ts-pattern';

import { unsafe_useEffectOnce } from '@documenso/lib/client-only/hooks/use-effect-once';
import { DocumentAuth } from '@documenso/lib/types/document-auth';
import { extractInitials } from '@documenso/lib/utils/recipient-formatter';
import { trpc } from '@documenso/trpc/react';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';
import { FRIENDLY_FIELD_TYPE } from '@documenso/ui/primitives/document-flow/types';
import { Form } from '@documenso/ui/primitives/form/form';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { useRequiredDocumentSigningContext } from './document-signing-provider';

const AUTO_SIGNABLE_FIELD_TYPES: string[] = [
  FieldType.NAME,
  FieldType.INITIALS,
  FieldType.EMAIL,
  FieldType.DATE,
];

// The action auth types that are not allowed to be auto signed
//
// Reasoning: If the action auth is a passkey or 2FA, it's likely that the owner of the document
// intends on having the user manually sign due to the additional security measures employed for
// other field types.
const NON_AUTO_SIGNABLE_ACTION_AUTH_TYPES: string[] = [
  DocumentAuth.PASSKEY,
  DocumentAuth.TWO_FACTOR_AUTH,
];

// The threshold for the number of fields that could be autosigned before displaying the dialog
//
// Reasoning: If there aren't that many fields, it's likely going to be easier to manually sign each one
// while for larger documents with many fields it will be beneficial to sign away the boilerplate fields.
const AUTO_SIGN_THRESHOLD = 5;

export type DocumentSigningAutoSignProps = {
  recipient: Pick<Recipient, 'id' | 'token'>;
  fields: Field[];
};

export const DocumentSigningAutoSign = ({ recipient, fields }: DocumentSigningAutoSignProps) => {
  const { _ } = useLingui();
  const { toast } = useToast();
  const { revalidate } = useRevalidator();

  const { email, fullName } = useRequiredDocumentSigningContext();
  const { derivedRecipientActionAuth } = useRequiredDocumentSigningAuthContext();

  const [open, setOpen] = useState(false);

  const form = useForm();

  const { mutateAsync: signFieldWithToken } = trpc.field.signFieldWithToken.useMutation();

  const autoSignableFields = fields.filter((field) => {
    if (field.inserted) {
      return false;
    }

    if (!AUTO_SIGNABLE_FIELD_TYPES.includes(field.type)) {
      return false;
    }

    if (field.type === FieldType.NAME && !fullName) {
      return false;
    }

    if (field.type === FieldType.INITIALS && !fullName) {
      return false;
    }

    if (field.type === FieldType.EMAIL && !email) {
      return false;
    }

    return true;
  });

  const actionAuthAllowsAutoSign = !NON_AUTO_SIGNABLE_ACTION_AUTH_TYPES.includes(
    derivedRecipientActionAuth ?? '',
  );

  const onSubmit = async () => {
    const results = await Promise.allSettled(
      autoSignableFields.map(async (field) => {
        const value = match(field.type)
          .with(FieldType.NAME, () => fullName)
          .with(FieldType.INITIALS, () => extractInitials(fullName))
          .with(FieldType.EMAIL, () => email)
          .with(FieldType.DATE, () => new Date().toISOString())
          .otherwise(() => '');

        const authOptions = match(derivedRecipientActionAuth)
          .with(DocumentAuth.ACCOUNT, () => ({
            type: DocumentAuth.ACCOUNT,
          }))
          .with(DocumentAuth.EXPLICIT_NONE, () => ({
            type: DocumentAuth.EXPLICIT_NONE,
          }))
          .with(null, () => undefined)
          .with(
            P.union(DocumentAuth.PASSKEY, DocumentAuth.TWO_FACTOR_AUTH),
            // This is a bit dirty, but the sentinel value used here is incredibly short-lived.
            () => 'NOT_SUPPORTED' as const,
          )
          .exhaustive();

        if (authOptions === 'NOT_SUPPORTED') {
          throw new Error('Action auth is not supported for auto signing');
        }

        if (!value) {
          throw new Error('No value to sign');
        }

        return await signFieldWithToken({
          token: recipient.token,
          fieldId: field.id,
          value,
          isBase64: false,
          authOptions,
        });
      }),
    );

    if (results.some((result) => result.status === 'rejected')) {
      toast({
        title: _(msg`Error`),
        description: _(
          msg`An error occurred while auto-signing the document, some fields may not be signed. Please review and manually sign any remaining fields.`,
        ),
        duration: 5000,
        variant: 'destructive',
      });
    }

    await revalidate();
  };

  unsafe_useEffectOnce(() => {
    if (actionAuthAllowsAutoSign && autoSignableFields.length > AUTO_SIGN_THRESHOLD) {
      setOpen(true);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Automatically sign fields</DialogTitle>
        </DialogHeader>

        <div className="text-muted-foreground max-w-[50ch]">
          <p>
            <Trans>
              When you sign a document, we can automatically fill in and sign the following fields
              using information that has already been provided. You can also manually sign or remove
              any automatically signed fields afterwards if you desire.
            </Trans>
          </p>

          <ul className="mt-4 flex list-inside list-disc flex-col gap-y-0.5">
            {AUTO_SIGNABLE_FIELD_TYPES.map((fieldType) => (
              <li key={fieldType}>
                <Trans>{_(FRIENDLY_FIELD_TYPE[fieldType as FieldType])}</Trans>
                <span className="pl-2 text-sm">
                  (
                  <Plural
                    value={autoSignableFields.filter((f) => f.type === fieldType).length}
                    one="1 matching field"
                    other="# matching fields"
                  />
                  )
                </span>
              </li>
            ))}
          </ul>
        </div>

        <DocumentSigningDisclosure className="mt-4" />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogFooter className="flex w-full flex-1 flex-nowrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setOpen(false);
                }}
              >
                <Trans>Cancel</Trans>
              </Button>

              <Button
                type="submit"
                className="min-w-[6rem]"
                loading={form.formState.isSubmitting}
                disabled={!autoSignableFields.length}
              >
                <Trans>Sign</Trans>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
