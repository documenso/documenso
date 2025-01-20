'use client';

import { useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trans, msg } from '@lingui/macro';
import { useLingui } from '@lingui/react';
import { Loader } from 'lucide-react';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { RecipientWithFields } from '@documenso/prisma/types/recipient-with-fields';
import { trpc } from '@documenso/trpc/react';
import type {
  TRemovedSignedFieldWithTokenMutationSchema,
  TSignFieldWithTokenMutationSchema,
} from '@documenso/trpc/server/field-router/schema';
import { useToast } from '@documenso/ui/primitives/use-toast';

import { SigningFieldContainer } from './signing-field-container';

export type AssistantEmailFieldProps = {
  field: FieldWithSignature;
  onSignField?: (value: TSignFieldWithTokenMutationSchema) => Promise<void> | void;
  onUnsignField?: (value: TRemovedSignedFieldWithTokenMutationSchema) => Promise<void> | void;
  selectedSigner: RecipientWithFields | null;
  recipient: RecipientWithFields;
};

export const AssistantEmailField = ({
  field,
  onSignField,
  onUnsignField,
  selectedSigner,
  recipient,
}: AssistantEmailFieldProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { _ } = useLingui();

  const [isPending, startTransition] = useTransition();

  const { mutateAsync: signFieldWithToken, isLoading: isSignFieldWithTokenLoading } =
    trpc.field.signFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const {
    mutateAsync: removeSignedFieldWithToken,
    isLoading: isRemoveSignedFieldWithTokenLoading,
  } = trpc.field.removeSignedFieldWithToken.useMutation(DO_NOT_INVALIDATE_QUERY_ON_MUTATION);

  const isLoading = isSignFieldWithTokenLoading || isRemoveSignedFieldWithTokenLoading || isPending;

  const onSign = async () => {
    try {
      if (!selectedSigner) {
        return;
      }

      const payload: TSignFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
        value: selectedSigner.email,
        isBase64: false,
        isAssistantPrefill: true,
        assistantId: recipient.id,
      };

      if (onSignField) {
        await onSignField(payload);
        return;
      }

      await signFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      const error = AppError.parseError(err);

      if (error.code === AppErrorCode.UNAUTHORIZED) {
        throw error;
      }

      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while signing as assistant.`),
        variant: 'destructive',
      });
    }
  };

  const onRemove = async () => {
    try {
      if (!selectedSigner) {
        return;
      }

      const payload: TRemovedSignedFieldWithTokenMutationSchema = {
        token: selectedSigner.token,
        fieldId: field.id,
      };

      if (onUnsignField) {
        await onUnsignField(payload);
        return;
      }

      await removeSignedFieldWithToken(payload);

      startTransition(() => router.refresh());
    } catch (err) {
      console.error(err);

      toast({
        title: _(msg`Error`),
        description: _(msg`An error occurred while removing the field.`),
        variant: 'destructive',
      });
    }
  };

  return (
    <SigningFieldContainer field={field} onSign={onSign} onRemove={onRemove} type="Email">
      {isLoading && (
        <div className="bg-background absolute inset-0 flex items-center justify-center rounded-md">
          <Loader className="text-primary h-5 w-5 animate-spin md:h-8 md:w-8" />
        </div>
      )}

      {!field.inserted && (
        <p className="group-hover:text-primary text-muted-foreground text-[clamp(0.425rem,25cqw,0.825rem)] duration-200 group-hover:text-yellow-300">
          <Trans>Email</Trans>
        </p>
      )}

      {field.inserted && (
        <p className="text-muted-foreground dark:text-background/80 text-[clamp(0.425rem,25cqw,0.825rem)] duration-200">
          {field.customText}
        </p>
      )}
    </SigningFieldContainer>
  );
};
