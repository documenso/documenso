import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';

import { trpc } from '@documenso/trpc/react';
import type { TSetEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';
import type { TUpdateEnvelopeRequest } from '@documenso/trpc/server/envelope-router/update-envelope.types';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { AVAILABLE_RECIPIENT_COLORS } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TDocumentEmailSettings } from '../../types/document-email';
import type { TEnvelope } from '../../types/envelope';
import { formatDocumentsPath, formatTemplatesPath } from '../../utils/teams';
import { useEditorFields } from '../hooks/use-editor-fields';
import type { TLocalField } from '../hooks/use-editor-fields';
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

type UpdateEnvelopePayload = Pick<TUpdateEnvelopeRequest, 'data' | 'meta'>;

type EnvelopeEditorProviderValue = {
  envelope: TEnvelope;
  isDocument: boolean;
  isTemplate: boolean;
  setLocalEnvelope: (localEnvelope: Partial<TEnvelope>) => void;

  updateEnvelope: (envelopeUpdates: UpdateEnvelopePayload) => void;
  updateEnvelopeAsync: (envelopeUpdates: UpdateEnvelopePayload) => Promise<void>;
  setRecipientsDebounced: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => void;
  setRecipientsAsync: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => Promise<void>;

  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  editorFields: ReturnType<typeof useEditorFields>;

  isAutosaving: boolean;
  flushAutosave: () => Promise<void>;
  autosaveError: boolean;

  relativePath: {
    basePath: string;
    envelopePath: string;
    editorPath: string;
    documentRootPath: string;
    templateRootPath: string;
  };

  syncEnvelope: () => Promise<void>;
};

interface EnvelopeEditorProviderProps {
  children: React.ReactNode;
  initialEnvelope: TEnvelope;
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
  initialEnvelope,
}: EnvelopeEditorProviderProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [envelope, setEnvelope] = useState(initialEnvelope);
  const [autosaveError, setAutosaveError] = useState<boolean>(false);

  const editorFields = useEditorFields({
    envelope,
    handleFieldsUpdate: (fields) => setFieldsDebounced(fields),
  });

  const envelopeUpdateMutationQuery = trpc.envelope.update.useMutation({
    onSuccess: (response, input) => {
      setEnvelope({
        ...envelope,
        ...response,
        documentMeta: {
          ...envelope.documentMeta,
          ...input.meta,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          emailSettings: (input.meta?.emailSettings ||
            null) as unknown as TDocumentEmailSettings | null,
        },
      });

      setAutosaveError(false);
    },
    onError: (err) => {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const envelopeFieldSetMutationQuery = trpc.envelope.field.set.useMutation({
    onSuccess: () => {
      setAutosaveError(false);
    },
    onError: (err) => {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const envelopeRecipientSetMutationQuery = trpc.envelope.recipient.set.useMutation({
    onSuccess: ({ data: recipients }) => {
      setEnvelope((prev) => ({
        ...prev,
        recipients,
      }));

      setAutosaveError(false);
    },
    onError: (err) => {
      console.error(err);

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    },
  });

  const {
    triggerSave: setRecipientsDebounced,
    flush: setRecipientsAsync,
    isPending: isRecipientsMutationPending,
  } = useEnvelopeAutosave(async (recipients: TSetEnvelopeRecipientsRequest['recipients']) => {
    await envelopeRecipientSetMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      envelopeType: envelope.type,
      recipients,
    });
  }, 1000);

  const {
    triggerSave: setFieldsDebounced,
    flush: setFieldsAsync,
    isPending: isFieldsMutationPending,
  } = useEnvelopeAutosave(async (localFields: TLocalField[]) => {
    const envelopeFields = await envelopeFieldSetMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      envelopeType: envelope.type,
      fields: localFields,
    });

    // Insert the IDs into the local fields.
    envelopeFields.data.forEach((field) => {
      const localField = localFields.find((localField) => localField.formId === field.formId);

      if (localField && !localField.id) {
        localField.id = field.id;

        editorFields.setFieldId(localField.formId, field.id);
      }
    });
  }, 2000);

  const {
    triggerSave: setEnvelopeDebounced,
    flush: setEnvelopeAsync,
    isPending: isEnvelopeMutationPending,
  } = useEnvelopeAutosave(async (envelopeUpdates: UpdateEnvelopePayload) => {
    await envelopeUpdateMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      data: envelopeUpdates.data,
      meta: envelopeUpdates.meta,
    });
  }, 1000);

  /**
   * Updates the local envelope and debounces the update to the server.
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

    setEnvelopeDebounced(envelopeUpdates);
  };

  const updateEnvelopeAsync = async (envelopeUpdates: UpdateEnvelopePayload) => {
    await envelopeUpdateMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      ...envelopeUpdates,
    });
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

  const { refetch: reloadEnvelope, isLoading: isReloadingEnvelope } = trpc.envelope.get.useQuery(
    {
      envelopeId: envelope.id,
    },
    {
      initialData: envelope,
    },
  );

  /**
   * Fetch and sycn the envelope back into the editor.
   *
   * Overrides everything.
   */
  const syncEnvelope = async () => {
    await flushAutosave();

    const fetchedEnvelopeData = await reloadEnvelope();

    if (fetchedEnvelopeData.data) {
      setEnvelope(fetchedEnvelopeData.data);
    }
  };

  const setLocalEnvelope = (localEnvelope: Partial<TEnvelope>) => {
    setEnvelope((prev) => ({ ...prev, ...localEnvelope }));
  };

  const isAutosaving = useMemo(() => {
    return (
      envelopeFieldSetMutationQuery.isPending ||
      envelopeRecipientSetMutationQuery.isPending ||
      envelopeUpdateMutationQuery.isPending ||
      isFieldsMutationPending ||
      isRecipientsMutationPending ||
      isEnvelopeMutationPending
    );
  }, [
    envelopeFieldSetMutationQuery.isPending,
    envelopeRecipientSetMutationQuery.isPending,
    envelopeUpdateMutationQuery.isPending,
    isFieldsMutationPending,
    isRecipientsMutationPending,
    isEnvelopeMutationPending,
  ]);

  const relativePath = useMemo(() => {
    const documentRootPath = formatDocumentsPath(envelope.team.url);
    const templateRootPath = formatTemplatesPath(envelope.team.url);

    const basePath = envelope.type === EnvelopeType.DOCUMENT ? documentRootPath : templateRootPath;

    return {
      basePath,
      envelopePath: `${basePath}/${envelope.id}`,
      editorPath: `${basePath}/${envelope.id}/edit`,
      documentRootPath,
      templateRootPath,
    };
  }, [envelope.type, envelope.id]);

  const flushAutosave = async (): Promise<void> => {
    await Promise.all([setFieldsAsync(), setRecipientsAsync(), setEnvelopeAsync()]);
  };

  return (
    <EnvelopeEditorContext.Provider
      value={{
        envelope,
        isDocument: envelope.type === EnvelopeType.DOCUMENT,
        isTemplate: envelope.type === EnvelopeType.TEMPLATE,
        setLocalEnvelope,
        getRecipientColorKey,
        updateEnvelope,
        updateEnvelopeAsync,
        setRecipientsDebounced,
        setRecipientsAsync,
        editorFields,
        autosaveError,
        flushAutosave,
        isAutosaving,
        relativePath,
        syncEnvelope,
      }}
    >
      {children}
    </EnvelopeEditorContext.Provider>
  );
};
