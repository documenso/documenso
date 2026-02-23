import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { EnvelopeType, Prisma, ReadStatus, SendStatus, SigningStatus } from '@prisma/client';
import { useSearchParams } from 'react-router';

import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import {
  DEFAULT_EDITOR_CONFIG,
  type EnvelopeEditorConfig,
  type TEditorEnvelope,
} from '@documenso/lib/types/envelope-editor';
import { trpc } from '@documenso/trpc/react';
import type { TSetEnvelopeFieldsResponse } from '@documenso/trpc/server/envelope-router/set-envelope-fields.types';
import type { TSetEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';
import type { TUpdateEnvelopeRequest } from '@documenso/trpc/server/envelope-router/update-envelope.types';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { AVAILABLE_RECIPIENT_COLORS } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TDocumentEmailSettings } from '../../types/document-email';
import { formatDocumentsPath, formatTemplatesPath } from '../../utils/teams';
import { useEditorFields } from '../hooks/use-editor-fields';
import type { TLocalField } from '../hooks/use-editor-fields';
import { useEditorRecipients } from '../hooks/use-editor-recipients';
import { useEnvelopeAutosave } from '../hooks/use-envelope-autosave';

export const useDebounceFunction = <Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
) => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    (...args: Args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );
};

export type EnvelopeEditorStep = 'upload' | 'addFields' | 'preview';

type UpdateEnvelopePayload = Pick<TUpdateEnvelopeRequest, 'data' | 'meta'>;

type EnvelopeEditorProviderValue = {
  editorConfig: EnvelopeEditorConfig;

  envelope: TEditorEnvelope;

  isEmbedded: boolean;
  isDocument: boolean;
  isTemplate: boolean;

  setLocalEnvelope: (localEnvelope: Partial<TEditorEnvelope>) => void;
  updateEnvelope: (envelopeUpdates: UpdateEnvelopePayload) => void;
  updateEnvelopeAsync: (envelopeUpdates: UpdateEnvelopePayload) => Promise<void>;
  setRecipientsDebounced: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => void;
  setRecipientsAsync: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => Promise<void>;

  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  editorFields: ReturnType<typeof useEditorFields>;
  editorRecipients: ReturnType<typeof useEditorRecipients>;

  isAutosaving: boolean;
  flushAutosave: () => Promise<TEditorEnvelope>;
  autosaveError: boolean;

  relativePath: {
    basePath: string;
    envelopePath: string;
    editorPath: string;
    documentRootPath: string;
    templateRootPath: string;
  };

  navigateToStep: (step: EnvelopeEditorStep) => Promise<void>;
  syncEnvelope: () => Promise<void>;
};

interface EnvelopeEditorProviderProps {
  children: React.ReactNode;
  editorConfig?: EnvelopeEditorConfig;
  initialEnvelope: TEditorEnvelope;
}

const EnvelopeEditorContext = createContext<EnvelopeEditorProviderValue | null>(null);

export const useCurrentEnvelopeEditor = () => {
  const context = useContext(EnvelopeEditorContext);

  if (!context) {
    throw new Error('useCurrentEnvelopeEditor must be used within a EnvelopeEditorProvider');
  }

  return context;
};

export const EnvelopeEditorProvider = ({
  children,
  editorConfig = DEFAULT_EDITOR_CONFIG,
  initialEnvelope,
}: EnvelopeEditorProviderProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [_searchParams, setSearchParams] = useSearchParams();

  const [envelope, _setEnvelope] = useState(initialEnvelope);
  const [autosaveError, setAutosaveError] = useState<boolean>(false);

  const envelopeRef = useRef(initialEnvelope);

  const setEnvelope: typeof _setEnvelope = (action) => {
    _setEnvelope((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      envelopeRef.current = next;
      return next;
    });
  };

  const isEmbedded = editorConfig.embeded !== undefined;

  const editorFields = useEditorFields({
    envelope,
    handleFieldsUpdate: (fields) => setFieldsDebounced(fields),
  });

  const editorRecipients = useEditorRecipients({
    envelope,
  });

  const setRecipientsMutation = trpc.envelope.recipient.set.useMutation();
  const setFieldsMutation = trpc.envelope.field.set.useMutation();
  const updateEnvelopeMutation = trpc.envelope.update.useMutation();

  /**
   * Handles debouncing the recipients updates to the server.
   *
   * Will set the local envelope recipients and fields after the update is complete.
   */
  const {
    triggerSave: setRecipientsDebounced,
    flush: flushSetRecipients,
    isPending: isRecipientsMutationPending,
  } = useEnvelopeAutosave(async (localRecipients: TSetEnvelopeRecipientsRequest['recipients']) => {
    try {
      let recipients: TEditorEnvelope['recipients'] = [];

      if (!isEmbedded) {
        const response = await setRecipientsMutation.mutateAsync({
          envelopeId: envelope.id,
          envelopeType: envelope.type,
          recipients: localRecipients,
        });

        recipients = response.data;
      } else {
        recipients = mapLocalRecipientsToRecipients({ envelope, localRecipients });
      }

      setEnvelope((prev) => ({
        ...prev,
        recipients,
        fields: prev.fields.filter((field) =>
          recipients.some((recipient) => recipient.id === field.recipientId),
        ),
      }));

      // Reset the local fields to ensure deleted recipient fields are removed.
      editorFields.resetForm(
        envelope.fields.filter((field) =>
          recipients.some((recipient) => recipient.id === field.recipientId),
        ),
      );

      setAutosaveError(false);
    } catch (err) {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  }, 1000);

  const setRecipientsAsync = async (
    localRecipients: TSetEnvelopeRecipientsRequest['recipients'],
  ) => {
    setRecipientsDebounced(localRecipients);
    await flushSetRecipients();
  };

  /**
   * Handles debouncing the fields updates to the server.
   *
   * Will set the local envelope fields after the update is complete.
   */
  const {
    triggerSave: setFieldsDebounced,
    flush: flushSetFields,
    isPending: isFieldsMutationPending,
  } = useEnvelopeAutosave(async (localFields: TLocalField[]) => {
    try {
      let fields: TSetEnvelopeFieldsResponse['data'] = [];

      if (!isEmbedded) {
        const response = await setFieldsMutation.mutateAsync({
          envelopeId: envelope.id,
          envelopeType: envelope.type,
          fields: localFields,
        });

        fields = response.data;
      } else {
        fields = mapLocalFieldsToFields({ envelope, localFields });
      }

      setEnvelope((prev) => ({
        ...prev,
        fields,
      }));

      setAutosaveError(false);

      // Insert the IDs into the local fields.
      fields.forEach((field) => {
        const localField = localFields.find((localField) => localField.formId === field.formId);

        if (localField && !localField.id) {
          localField.id = field.id;

          editorFields.setFieldId(localField.formId, field.id);
        }
      });
    } catch (err) {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  }, 2000);

  const setFieldsAsync = async (localFields: TLocalField[]) => {
    setFieldsDebounced(localFields);
    await flushSetFields();
  };

  /**
   * Handles debouncing the envelope updates to the server.
   *
   * Will set the local envelope after the update is complete.
   */
  const {
    triggerSave: updateEnvelopeDebounced,
    flush: flushUpdateEnvelope,
    isPending: isEnvelopeMutationPending,
  } = useEnvelopeAutosave(async ({ data, meta }: UpdateEnvelopePayload) => {
    try {
      const response = !isEmbedded
        ? await updateEnvelopeMutation.mutateAsync({
            envelopeId: envelope.id,
            data,
            meta,
          })
        : {};

      setEnvelope((prev) => ({
        ...prev,
        ...data,
        authOptions: {
          globalAccessAuth: data?.globalAccessAuth || [],
          globalActionAuth: data?.globalActionAuth || [],
        },
        ...response,
        documentMeta: {
          ...prev.documentMeta,
          ...meta,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          emailSettings: (meta?.emailSettings || null) as unknown as TDocumentEmailSettings | null,
        },
      }));

      setAutosaveError(false);
    } catch (err) {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  }, 1000);

  const updateEnvelopeAsync = async (envelopeUpdates: UpdateEnvelopePayload) => {
    updateEnvelopeDebounced(envelopeUpdates);
    await flushUpdateEnvelope();
  };

  /**
   * Updates the local envelope and debounces the update to the server.
   *
   * Use this when you want to update the local envelope immediately while debouncing
   * the actual update to the server.
   */
  const updateEnvelope = (envelopeUpdates: UpdateEnvelopePayload) => {
    setEnvelope((prev) => ({
      ...prev,
      ...envelopeUpdates.data,
      meta: {
        ...prev.documentMeta,
        ...envelopeUpdates.meta,
      },
    }));

    updateEnvelopeDebounced(envelopeUpdates);
  };

  const getRecipientColorKey = useCallback(
    (recipientId: number) => {
      const recipientIndex = envelope.recipients.findIndex(
        (recipient) => recipient.id === recipientId,
      );

      return AVAILABLE_RECIPIENT_COLORS[
        Math.max(recipientIndex, 0) % AVAILABLE_RECIPIENT_COLORS.length
      ];
    },
    [envelope.recipients],
  );

  const { refetch: reloadEnvelope } = trpc.envelope.get.useQuery(
    {
      envelopeId: envelope.id,
    },
    {
      enabled: !isEmbedded,
      ...DO_NOT_INVALIDATE_QUERY_ON_MUTATION,
    },
  );

  /**
   * Fetch and sync the envelope back into the editor.
   *
   * Overrides everything.
   */
  const syncEnvelope = async () => {
    await flushAutosave();

    // Bypass syncing for embedded mode.
    if (isEmbedded) {
      return;
    }

    const fetchedEnvelopeData = await reloadEnvelope();

    if (fetchedEnvelopeData.data) {
      setEnvelope(fetchedEnvelopeData.data);

      editorRecipients.resetForm({
        recipients: fetchedEnvelopeData.data.recipients,
        documentMeta: fetchedEnvelopeData.data.documentMeta,
      });

      editorFields.resetForm(fetchedEnvelopeData.data.fields);
    }
  };

  const setLocalEnvelope = (localEnvelope: Partial<TEditorEnvelope>) => {
    setEnvelope((prev) => ({ ...prev, ...localEnvelope }));
  };

  const isAutosaving = useMemo(() => {
    return isFieldsMutationPending || isRecipientsMutationPending || isEnvelopeMutationPending;
  }, [isFieldsMutationPending, isRecipientsMutationPending, isEnvelopeMutationPending]);

  const relativePath = useMemo(() => {
    let documentRootPath = formatDocumentsPath(envelope.team.url);
    let templateRootPath = formatTemplatesPath(envelope.team.url);

    const basePath = envelope.type === EnvelopeType.DOCUMENT ? documentRootPath : templateRootPath;
    let envelopePath = `${basePath}/${envelope.id}`;
    let editorPath = `${basePath}/${envelope.id}/edit`;

    if (editorConfig.embeded) {
      let embeddedEditorPath =
        editorConfig.embeded.mode === 'edit'
          ? `/embed/v2/authoring/envelope/edit/${envelope.id}`
          : `/embed/v2/authoring/envelope/create`;

      embeddedEditorPath += `?token=${editorConfig.embeded.presignToken}`;

      // Todo: Embeds - This should be thought about more.
      envelopePath = embeddedEditorPath;
      editorPath = embeddedEditorPath;
      documentRootPath = embeddedEditorPath;
      templateRootPath = embeddedEditorPath;
    }

    return {
      basePath,
      envelopePath,
      editorPath,
      documentRootPath,
      templateRootPath,
    };
  }, [envelope.type, envelope.id]);

  const navigateToStep = async (step: EnvelopeEditorStep) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);

      if (step === 'upload') {
        newParams.delete('step');
      } else {
        newParams.set('step', step);
      }

      return newParams;
    });

    await flushAutosave();

    resetForms();
  };

  const resetForms = () => {
    editorRecipients.resetForm({
      recipients: envelopeRef.current.recipients,
      documentMeta: envelopeRef.current.documentMeta,
    });

    editorFields.resetForm(envelopeRef.current.fields);
  };

  const flushAutosave = async (): Promise<TEditorEnvelope> => {
    await Promise.all([flushSetFields(), flushSetRecipients(), flushUpdateEnvelope()]);
    return envelopeRef.current;
  };

  return (
    <EnvelopeEditorContext.Provider
      value={{
        editorConfig,
        envelope,
        isEmbedded,
        isDocument: envelope.type === EnvelopeType.DOCUMENT,
        isTemplate: envelope.type === EnvelopeType.TEMPLATE,
        setLocalEnvelope,
        getRecipientColorKey,
        updateEnvelope,
        updateEnvelopeAsync,
        setRecipientsDebounced,
        setRecipientsAsync,
        editorFields,
        editorRecipients,
        autosaveError,
        flushAutosave,
        isAutosaving,
        relativePath,
        syncEnvelope,
        navigateToStep,
      }}
    >
      {children}
    </EnvelopeEditorContext.Provider>
  );
};

type MapLocalRecipientsToRecipientsOptions = {
  envelope: TEditorEnvelope;
  localRecipients: TSetEnvelopeRecipientsRequest['recipients'];
};

const mapLocalRecipientsToRecipients = ({
  envelope,
  localRecipients,
}: MapLocalRecipientsToRecipientsOptions): TEditorEnvelope['recipients'] => {
  let smallestRecipientId = localRecipients.reduce((min, recipient) => {
    if (recipient.id && recipient.id < min) {
      return recipient.id;
    }

    return min;
  }, -1);

  return localRecipients.map((recipient) => {
    const foundRecipient = envelope.recipients.find((recipient) => recipient.id === recipient.id);

    let recipientId = recipient.id;

    if (recipientId === undefined) {
      recipientId = smallestRecipientId;
      smallestRecipientId--;
    }

    return {
      id: recipientId,
      envelopeId: envelope.id,
      email: recipient.email,
      name: recipient.name,
      token: foundRecipient?.token || '',
      documentDeletedAt: foundRecipient?.documentDeletedAt || null,
      expired: foundRecipient?.expired || null,
      signedAt: foundRecipient?.signedAt || null,
      authOptions:
        recipient.actionAuth.length > 0
          ? { actionAuth: recipient.actionAuth, accessAuth: [] }
          : null,
      signingOrder: recipient.signingOrder ?? null,
      rejectionReason: foundRecipient?.rejectionReason || null,
      role: recipient.role,
      readStatus: foundRecipient?.readStatus || ReadStatus.NOT_OPENED,
      signingStatus: foundRecipient?.signingStatus || SigningStatus.NOT_SIGNED,
      sendStatus: foundRecipient?.sendStatus || SendStatus.NOT_SENT,
    };
  });
};

type MapLocalFieldsToFieldsOptions = {
  localFields: TLocalField[];
  envelope: TEditorEnvelope;
};

const mapLocalFieldsToFields = ({
  envelope,
  localFields,
}: MapLocalFieldsToFieldsOptions): TSetEnvelopeFieldsResponse['data'] => {
  let smallestFieldId = localFields.reduce((min, field) => {
    if (field.id && field.id < min) {
      return field.id;
    }

    return min;
  }, -1);

  return localFields.map((field) => {
    const foundField = envelope.fields.find((envelopeField) => envelopeField.id === field.id);

    let fieldId = field.id;

    if (fieldId === undefined) {
      fieldId = smallestFieldId;
      smallestFieldId--;
    }

    return {
      ...field,
      formId: field.formId,
      id: fieldId,
      envelopeId: envelope.id,
      envelopeItemId: field.envelopeItemId,
      type: field.type,
      recipientId: field.recipientId,
      positionX: new Prisma.Decimal(field.positionX),
      positionY: new Prisma.Decimal(field.positionY),
      width: new Prisma.Decimal(field.width),
      height: new Prisma.Decimal(field.height),
      secondaryId: foundField?.secondaryId || '',
      inserted: foundField?.inserted || false,
      customText: foundField?.customText || '',
      fieldMeta: field.fieldMeta || null,
    };
  });
};
