import { IS_INSTANCE_CSC_MODE } from '@documenso/lib/constants/app';
import { DO_NOT_INVALIDATE_QUERY_ON_MUTATION } from '@documenso/lib/constants/trpc';
import {
  DEFAULT_EDITOR_CONFIG,
  type EnvelopeEditorConfig,
  type TEditorEnvelope,
} from '@documenso/lib/types/envelope-editor';
import { trpc } from '@documenso/trpc/react';
import type { TSetEnvelopeFieldsResponse } from '@documenso/trpc/server/envelope-router/set-envelope-fields.types';
import type {
  TSetEnvelopeRecipientsRequest,
  TSetEnvelopeRecipientsResponse,
} from '@documenso/trpc/server/envelope-router/set-envelope-recipients.types';
import type { TUpdateEnvelopeRequest } from '@documenso/trpc/server/envelope-router/update-envelope.types';
import type { TRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { getRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';
import { useLingui } from '@lingui/react/macro';
import { EnvelopeType, Prisma, ReadStatus, SendStatus, SigningStatus } from '@prisma/client';
import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';

import type { TDocumentEmailSettings } from '../../types/document-email';
import { formatDocumentsPath, formatTemplatesPath } from '../../utils/teams';
import { useAnalytics } from '../hooks/use-analytics';
import type { TLocalField } from '../hooks/use-editor-fields';
import { useEditorFields } from '../hooks/use-editor-fields';
import { useEditorRecipients } from '../hooks/use-editor-recipients';
import { useEnvelopeAutosave } from '../hooks/use-envelope-autosave';

export type EnvelopeEditorStep = 'upload' | 'addFields' | 'preview';

type UpdateEnvelopePayload = Pick<TUpdateEnvelopeRequest, 'data' | 'meta'>;

type SetRecipientsPayload = (TSetEnvelopeRecipientsRequest['recipients'][number] & {
  /**
   * Stable client-side key for the signer row, echoed to the server as
   * `clientId` so newly created recipients can adopt their server-assigned id.
   */
  formId?: string;
})[];

type EnvelopeEditorProviderValue = {
  editorConfig: EnvelopeEditorConfig;

  envelope: TEditorEnvelope;

  isEmbedded: boolean;
  isDocument: boolean;
  isTemplate: boolean;
  /**
   * Whether the instance is running in CSC (Cloud Signature Consortium) mode.
   * Components can branch on this for any additional CSC-only UI gating
   * beyond the overrides already baked into `editorConfig`.
   */
  isCscMode: boolean;

  setLocalEnvelope: (localEnvelope: Partial<TEditorEnvelope>) => void;
  updateEnvelope: (envelopeUpdates: UpdateEnvelopePayload) => void;
  updateEnvelopeAsync: (envelopeUpdates: UpdateEnvelopePayload) => Promise<void>;
  setRecipientsDebounced: (recipients: SetRecipientsPayload) => void;
  setRecipientsAsync: (recipients: SetRecipientsPayload) => Promise<void>;

  getRecipientColorKey: (recipientId: number) => TRecipientColor;

  editorFields: ReturnType<typeof useEditorFields>;
  editorRecipients: ReturnType<typeof useEditorRecipients>;

  isAutosaving: boolean;
  flushAutosave: () => Promise<TEditorEnvelope>;
  autosaveError: boolean;
  resetForms: () => void;

  relativePath: {
    basePath: string;
    envelopePath: string;
    editorPath: string;
    documentRootPath: string;
    templateRootPath: string;
  };

  navigateToStep: (step: EnvelopeEditorStep) => void;
  syncEnvelope: () => Promise<void>;

  registerExternalFlush: (key: string, flush: () => Promise<void>) => () => void;
  registerPendingMutation: (promise: Promise<unknown>) => void;

  organisationEmails?: { id: string; email: string }[];
};

interface EnvelopeEditorProviderProps {
  children: React.ReactNode;
  editorConfig?: EnvelopeEditorConfig;
  initialEnvelope: TEditorEnvelope;
  organisationEmails?: { id: string; email: string }[];
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
  editorConfig: providedEditorConfig = DEFAULT_EDITOR_CONFIG,
  initialEnvelope,
  organisationEmails,
}: EnvelopeEditorProviderProps) => {
  const { t } = useLingui();
  const { toast } = useToast();
  const analytics = useAnalytics();

  const [_searchParams, setSearchParams] = useSearchParams();

  /**
   * The envelope is kept in a ref-backed external store instead of useState so
   * that async consumers (debounced autosave callbacks, flushAutosave, resetForms)
   * can synchronously read the latest value via `getEnvelope`.
   *
   * React subscribes to the store through useSyncExternalStore, keeping renders in
   * sync without maintaining a separate copy of the state.
   */
  const envelopeStoreRef = useRef(initialEnvelope);
  const envelopeStoreSubscribersRef = useRef(new Set<() => void>());

  const subscribeToEnvelopeStore = useCallback((onStoreChange: () => void) => {
    envelopeStoreSubscribersRef.current.add(onStoreChange);

    return () => {
      envelopeStoreSubscribersRef.current.delete(onStoreChange);
    };
  }, []);

  const getEnvelope = useCallback(() => envelopeStoreRef.current, []);

  const setEnvelope = useCallback((action: React.SetStateAction<TEditorEnvelope>) => {
    const next = typeof action === 'function' ? action(envelopeStoreRef.current) : action;

    envelopeStoreRef.current = next;

    for (const onStoreChange of envelopeStoreSubscribersRef.current) {
      onStoreChange();
    }
  }, []);

  const envelope = useSyncExternalStore(subscribeToEnvelopeStore, getEnvelope, getEnvelope);

  const [autosaveError, setAutosaveError] = useState<boolean>(false);

  const isCscMode = IS_INSTANCE_CSC_MODE();

  /**
   * CSC-mode overrides applied on top of any caller-supplied editor config.
   * TSP envelopes are forced SEQUENTIAL at send-time and the sign path has no
   * nextSigner dictation; the assistant role's pre-fill semantics don't map
   * onto each recipient signing their own complete PDF state. Hide all three
   * up-front so authors don't pick options that would get silently coerced.
   */
  const editorConfig = useMemo<EnvelopeEditorConfig>(() => {
    if (!isCscMode || !providedEditorConfig.recipients) {
      return providedEditorConfig;
    }

    return {
      ...providedEditorConfig,
      recipients: {
        ...providedEditorConfig.recipients,
        allowConfigureSigningOrder: false,
        allowConfigureDictateNextSigner: false,
        allowAssistantRole: false,
      },
    };
  }, [isCscMode, providedEditorConfig]);

  const externalFlushCallbacksRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const pendingMutationsRef = useRef<Set<Promise<unknown>>>(new Set());

  /**
   * Server-assigned ids for signers created during this session, keyed by
   * their stable formId. The recipients form only learns real ids on a form
   * reset (step navigation), so this map bridges the gap between autosaves.
   */
  const recipientIdByFormIdRef = useRef<Map<string, number>>(new Map());

  /**
   * Merges known server-assigned ids into the outgoing payload. Without
   * this, a newly created signer (id-less in the form until the next form
   * reset) would be deleted and recreated on every autosave — churning ids,
   * signing tokens and the audit log. The formId doubles as the `clientId`
   * echoed back by the server.
   */
  const withKnownRecipientIds = (localRecipients: SetRecipientsPayload) =>
    localRecipients.map((recipient) => ({
      ...recipient,
      id: recipient.id ?? (recipient.formId ? recipientIdByFormIdRef.current.get(recipient.formId) : undefined),
      clientId: recipient.formId,
    }));

  /**
   * Records the ids of newly created recipients from the save response. A
   * ref — rather than writing ids back into the form — is deliberate: the
   * response can land mid interaction, and a form write here re-renders the
   * signer rows, which breaks an in-progress recipient drag.
   */
  const rememberCreatedRecipientIds = (recipients: TSetEnvelopeRecipientsResponse['data']) => {
    for (const recipient of recipients) {
      if (recipient.clientId) {
        recipientIdByFormIdRef.current.set(recipient.clientId, recipient.id);
      }
    }
  };

  const registerExternalFlush = useCallback((key: string, flush: () => Promise<void>) => {
    externalFlushCallbacksRef.current.set(key, flush);

    return () => {
      externalFlushCallbacksRef.current.delete(key);
    };
  }, []);

  const registerPendingMutation = useCallback((promise: Promise<unknown>) => {
    pendingMutationsRef.current.add(promise);

    void promise.finally(() => {
      pendingMutationsRef.current.delete(promise);
    });
  }, []);

  const isEmbedded = editorConfig.embedded !== undefined;

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
  } = useEnvelopeAutosave(async (localRecipients: SetRecipientsPayload) => {
    try {
      let recipients: TEditorEnvelope['recipients'] = [];

      const currentEnvelope = getEnvelope();

      if (!isEmbedded) {
        const response = await setRecipientsMutation.mutateAsync({
          envelopeId: currentEnvelope.id,
          envelopeType: currentEnvelope.type,
          recipients: withKnownRecipientIds(localRecipients),
        });

        recipients = response.data;

        rememberCreatedRecipientIds(response.data);
      } else {
        recipients = mapLocalRecipientsToRecipients({ envelope: currentEnvelope, localRecipients });
      }

      setEnvelope((prev) => ({
        ...prev,
        recipients,
        fields: prev.fields.filter((field) => recipients.some((recipient) => recipient.id === field.recipientId)),
      }));

      // Reset the local fields to ensure deleted recipient fields are removed.
      editorFields.resetForm(getEnvelope().fields);

      setAutosaveError(false);
    } catch (err) {
      console.error(err);

      analytics.captureException(err, {
        source: isEmbedded ? 'embed' : 'editor',
        location: 'autosave_recipients',
        envelopeId: envelope.id,
      });

      setAutosaveError(true);

      toast({
        title: t`Save failed`,
        description: t`We encountered an error while attempting to save your changes. Your changes cannot be saved at this time.`,
        variant: 'destructive',
        duration: 7500,
      });
    }
  }, 1000);

  const setRecipientsAsync = async (localRecipients: SetRecipientsPayload) => {
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

      const currentEnvelope = getEnvelope();

      if (!isEmbedded) {
        const response = await setFieldsMutation.mutateAsync({
          envelopeId: currentEnvelope.id,
          envelopeType: currentEnvelope.type,
          fields: localFields,
        });

        fields = response.data;
      } else {
        fields = mapLocalFieldsToFields({ envelope: currentEnvelope, localFields });
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

      analytics.captureException(err, {
        source: isEmbedded ? 'embed' : 'editor',
        location: 'autosave_fields',
        envelopeId: envelope.id,
      });

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
            envelopeId: getEnvelope().id,
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

      analytics.captureException(err, {
        source: isEmbedded ? 'embed' : 'editor',
        location: 'autosave_meta',
        envelopeId: envelope.id,
      });

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
    (recipientId: number) => getRecipientColor(envelope.recipients.findIndex((r) => r.id === recipientId)),
    [envelope.recipients],
  );

  const { refetch: reloadEnvelope } = trpc.envelope.editor.get.useQuery(
    {
      envelopeId: envelope.id,
    },
    {
      enabled: !isEmbedded,
      gcTime: 0,
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

    if (editorConfig.embedded) {
      let embeddedEditorPath =
        editorConfig.embedded.mode === 'edit'
          ? `/embed/v2/authoring/envelope/edit/${envelope.id}`
          : `/embed/v2/authoring/envelope/create`;

      embeddedEditorPath += `?token=${editorConfig.embedded.presignToken}`;

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

  const navigateToStep = (step: EnvelopeEditorStep) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);

      if (step === 'upload') {
        newParams.delete('step');
      } else {
        newParams.set('step', step);
      }

      return newParams;
    });
  };

  const resetForms = () => {
    const currentEnvelope = getEnvelope();

    editorRecipients.resetForm({
      recipients: currentEnvelope.recipients,
      documentMeta: currentEnvelope.documentMeta,
    });

    editorFields.resetForm(currentEnvelope.fields);
  };

  const flushAutosave = async (): Promise<TEditorEnvelope> => {
    await Promise.all([flushSetFields(), flushSetRecipients(), flushUpdateEnvelope()]);

    // Flush all registered external flushes (e.g., upload page's debounced item updates).
    const externalFlushes = Array.from(externalFlushCallbacksRef.current.values());
    await Promise.all(externalFlushes.map(async (flush) => flush()));

    // Await all registered pending mutations (e.g., in-flight creates/deletes).
    // Use allSettled so a single failed mutation doesn't prevent awaiting the rest.
    if (pendingMutationsRef.current.size > 0) {
      await Promise.allSettled(Array.from(pendingMutationsRef.current));
    }

    return getEnvelope();
  };

  return (
    <EnvelopeEditorContext.Provider
      value={{
        editorConfig,
        envelope,
        isEmbedded,
        isDocument: envelope.type === EnvelopeType.DOCUMENT,
        isTemplate: envelope.type === EnvelopeType.TEMPLATE,
        isCscMode,
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
        resetForms,
        registerExternalFlush,
        registerPendingMutation,
        organisationEmails,
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
    const foundRecipient = envelope.recipients.find((r) => r.id === recipient.id);

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
      authOptions: recipient.actionAuth.length > 0 ? { actionAuth: recipient.actionAuth, accessAuth: [] } : null,
      signingOrder: recipient.signingOrder ?? null,
      rejectionReason: foundRecipient?.rejectionReason || null,
      role: recipient.role,
      readStatus: foundRecipient?.readStatus || ReadStatus.NOT_OPENED,
      signingStatus: foundRecipient?.signingStatus || SigningStatus.NOT_SIGNED,
      sendStatus: foundRecipient?.sendStatus || SendStatus.NOT_SENT,
      expiresAt: foundRecipient?.expiresAt || null,
      expirationNotifiedAt: foundRecipient?.expirationNotifiedAt || null,
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
