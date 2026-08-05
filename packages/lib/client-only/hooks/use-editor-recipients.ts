import { IS_INSTANCE_CSC_MODE } from '@documenso/lib/constants/app';
import { ZRecipientActionAuthTypesSchema, ZRecipientAuthOptionsSchema } from '@documenso/lib/types/document-auth';
import type { TEditorEnvelope } from '@documenso/lib/types/envelope-editor';
import { ZRecipientEmailSchema } from '@documenso/lib/types/recipient';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { useId } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { normalizeGroupedSigningOrders } from '../../utils/recipient-groups';
import { isCcRecipient, sortRecipientsForSigningOrder } from '../../utils/recipients';

const LocalRecipientSchema = z.object({
  formId: z.string().min(1),
  id: z.number().optional(),
  email: ZRecipientEmailSchema,
  name: z.string(),
  role: z.nativeEnum(RecipientRole),
  signingOrder: z.number().optional(),
  actionAuth: z.array(ZRecipientActionAuthTypesSchema).optional().default([]),
});

type TLocalRecipient = z.infer<typeof LocalRecipientSchema>;

/**
 * Backstop validation that mirrors the CSC-mode UI overrides in
 * `EnvelopeEditorProvider`. If anything bypasses the disabled controls (URL
 * tampering, legacy form state, embedded host) the form refuses to submit
 * rather than persisting values the TSP flow can't honour.
 */
export const ZEditorRecipientsFormSchema = z
  .object({
    signers: z.array(LocalRecipientSchema),
    signingOrder: z.nativeEnum(DocumentSigningOrder),
    allowDictateNextSigner: z.boolean().default(false),
  })
  .superRefine((data, ctx) => {
    if (!IS_INSTANCE_CSC_MODE()) {
      return;
    }

    if (data.signingOrder !== DocumentSigningOrder.SEQUENTIAL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CSC envelopes must use SEQUENTIAL signing order.',
        path: ['signingOrder'],
      });
    }

    if (data.allowDictateNextSigner) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CSC envelopes do not support next-signer dictation.',
        path: ['allowDictateNextSigner'],
      });
    }

    data.signers.forEach((signer, index) => {
      if (signer.role === RecipientRole.ASSISTANT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CSC envelopes do not support the assistant role.',
          path: ['signers', index, 'role'],
        });
      }
    });

    const seenSigningOrders = new Set<number>();

    data.signers.forEach((signer, index) => {
      if (signer.role === RecipientRole.CC || typeof signer.signingOrder !== 'number') {
        return;
      }

      if (seenSigningOrders.has(signer.signingOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'CSC envelopes do not support recipient signing groups.',
          path: ['signers', index, 'signingOrder'],
        });
      }

      seenSigningOrders.add(signer.signingOrder);
    });
  });

export type TEditorRecipientsFormSchema = z.infer<typeof ZEditorRecipientsFormSchema>;

/**
 * Replaces the signers array while keeping controlled inputs in sync.
 *
 * Rows are rendered with stable `formId` keys (required for drag and drop),
 * so react-hook-form `Controller`s never remount and their leaf
 * subscriptions are NOT re-notified by a root-level array `setValue`. Any
 * value that changes while a signer keeps its index (e.g. a role change)
 * must be leaf-set first so the controlled input actually re-renders.
 */
export const updateEditorSigners = (
  form: UseFormReturn<TEditorRecipientsFormSchema>,
  updatedSigners: TEditorRecipientsFormSchema['signers'],
) => {
  const previousSigners = form.getValues('signers');

  updatedSigners.forEach((signer, index) => {
    const previousSigner = previousSigners[index];

    // Only slot-stable signers need leaf notifications — moved signers get a
    // new field name and re-subscribe with fresh values on their own.
    if (!previousSigner || previousSigner.formId !== signer.formId) {
      return;
    }

    if (previousSigner.role !== signer.role) {
      form.setValue(`signers.${index}.role`, signer.role, { shouldDirty: true });
    }

    if (previousSigner.email !== signer.email) {
      form.setValue(`signers.${index}.email`, signer.email, { shouldDirty: true });
    }

    if (previousSigner.name !== signer.name) {
      form.setValue(`signers.${index}.name`, signer.name, { shouldDirty: true });
    }
  });

  form.setValue('signers', updatedSigners, {
    shouldValidate: true,
    shouldDirty: true,
  });
};

type EditorRecipientsProps = {
  envelope: TEditorEnvelope;
};

type ResetFormOptions = {
  recipients?: TEditorEnvelope['recipients'];
  documentMeta?: TEditorEnvelope['documentMeta'];
};

type UseEditorRecipientsResponse = {
  form: UseFormReturn<TEditorRecipientsFormSchema>;
  resetForm: (options?: ResetFormOptions) => void;
};

export const useEditorRecipients = ({ envelope }: EditorRecipientsProps): UseEditorRecipientsResponse => {
  const initialId = useId();

  const generateDefaultValues = (options?: ResetFormOptions) => {
    const { recipients, documentMeta } = options ?? {};

    const formRecipients = (recipients || envelope.recipients).map((recipient, index) => ({
      id: recipient.id,
      formId: String(recipient.id),
      name: recipient.name,
      email: recipient.email,
      role: recipient.role,
      signingOrder: isCcRecipient(recipient) ? undefined : (recipient.signingOrder ?? index + 1),
      actionAuth: ZRecipientAuthOptionsSchema.parse(recipient.authOptions)?.actionAuth ?? undefined,
    }));

    const signers: TLocalRecipient[] =
      formRecipients.length > 0
        ? normalizeGroupedSigningOrders(sortRecipientsForSigningOrder(formRecipients))
        : [
            {
              formId: initialId,
              name: '',
              email: '',
              role: RecipientRole.SIGNER,
              signingOrder: 1,
              actionAuth: [],
            },
          ];

    return {
      signers,
      signingOrder: documentMeta?.signingOrder ?? envelope.documentMeta.signingOrder,
      allowDictateNextSigner: documentMeta?.allowDictateNextSigner ?? envelope.documentMeta.allowDictateNextSigner,
    };
  };

  const form = useForm<TEditorRecipientsFormSchema>({
    defaultValues: generateDefaultValues(),
    resolver: zodResolver(ZEditorRecipientsFormSchema),
    mode: 'onChange', // Used for autosave purposes, maybe can try onBlur instead?
  });

  const resetForm = (options?: ResetFormOptions) => {
    form.reset(generateDefaultValues(options));
  };

  return {
    form,
    resetForm,
  };
};
