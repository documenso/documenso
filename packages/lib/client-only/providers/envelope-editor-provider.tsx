import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useLingui } from '@lingui/react/macro';
import { EnvelopeType } from '@prisma/client';

import { trpc } from '@documenso/trpc/react';
import type { TSetEnvelopeRecipientsRequest } from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';
import type { RecipientColorStyles, TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import {
  AVAILABLE_RECIPIENT_COLORS,
  getRecipientColorStyles,
} from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TDocumentEmailSettings } from '../../types/document-email';
import type { TEnvelope } from '../../types/envelope';
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

type EnvelopeEditorProviderValue = {
  envelope: TEnvelope;
  isDocument: boolean;
  isTemplate: boolean;
  setLocalEnvelope: (localEnvelope: Partial<TEnvelope>) => void;

  updateEnvelope: (envelopeUpdates: Partial<TEnvelope>) => void;
  setRecipientsDebounced: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => void;
  setRecipientsAsync: (recipients: TSetEnvelopeRecipientsRequest['recipients']) => Promise<void>;

  getFieldColor: (field: TLocalField) => RecipientColorStyles;
  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  editorFields: ReturnType<typeof useEditorFields>;

  isAutosaving: boolean;
  flushAutosave: () => void;
  autosaveError: boolean;

  // refetchEnvelope: () => Promise<void>;
  // updateEnvelope: (envelope: TEnvelope) => Promise<void>;
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

  const envelopeUpdateMutationQuery = trpc.envelope.update.useMutation({
    onSuccess: (response, input) => {
      console.log(input.meta?.emailSettings);
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
    onError: (error) => {
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
    onError: (error) => {
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
    onSuccess: ({ recipients }) => {
      setEnvelope((prev) => ({
        ...prev,
        recipients,
      }));

      setAutosaveError(false);
    },
    onError: (error) => {
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
  } = useEnvelopeAutosave(async (fields: TLocalField[]) => {
    await envelopeFieldSetMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      envelopeType: envelope.type,
      fields,
    });
  }, 1000);

  const {
    triggerSave: setEnvelopeDebounced,
    flush: setEnvelopeAsync,
    isPending: isEnvelopeMutationPending,
  } = useEnvelopeAutosave(async (envelopeUpdates: Partial<TEnvelope>) => {
    await envelopeUpdateMutationQuery.mutateAsync({
      envelopeId: envelope.id,
      envelopeType: envelope.type,
      data: {
        ...envelopeUpdates,
      },
    });
  }, 1000);

  /**
   * Updates the local envelope and debounces the update to the server.
   */
  const updateEnvelope = (envelopeUpdates: Partial<TEnvelope>) => {
    setEnvelope((prev) => ({ ...prev, ...envelopeUpdates }));
    setEnvelopeDebounced(envelopeUpdates);
  };

  const editorFields = useEditorFields({
    envelope,
    handleFieldsUpdate: (fields) => setFieldsDebounced(fields),
  });

  const getFieldColor = useCallback(
    (field: TLocalField) => {
      // Todo: Envelopes - Local recipients
      const recipientIndex = envelope.recipients.findIndex(
        (recipient) => recipient.id === field.recipientId,
      );

      return getRecipientColorStyles(Math.max(recipientIndex, 0));
    },
    [envelope.recipients], // Todo: Envelopes - Local recipients
  );

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

  const flushAutosave = () => {
    void setFieldsAsync();
    void setRecipientsAsync();
    void setEnvelopeAsync();
  };

  return (
    <EnvelopeEditorContext.Provider
      value={{
        envelope,
        isDocument: envelope.type === EnvelopeType.DOCUMENT,
        isTemplate: envelope.type === EnvelopeType.TEMPLATE,
        setLocalEnvelope,
        getFieldColor,
        getRecipientColorKey,
        updateEnvelope,
        setRecipientsDebounced,
        setRecipientsAsync,
        editorFields,
        autosaveError,
        flushAutosave,
        isAutosaving,
      }}
    >
      {children}
    </EnvelopeEditorContext.Provider>
  );
};
