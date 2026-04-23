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
import { getRecipientColor } from '@documenso/ui/lib/recipient-colors';
import { useToast } from '@documenso/ui/primitives/use-toast';

import type { TDocumentEmailSettings } from '../../types/document-email';
import { mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { formatDocumentsPath, formatTemplatesPath } from '../../utils/teams';
import { useEditorFields } from '../hooks/use-editor-fields';
import type { TLocalField } from '../hooks/use-editor-fields';
import { useEditorRecipients } from '../hooks/use-editor-recipients';
import { useEditorRedactions } from '../hooks/use-editor-redactions';
import type { TLocalRedaction } from '../hooks/use-editor-redactions';
import { useEnvelopeAutosave } from '../hooks/use-envelope-autosave';

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
  editorRedactions: ReturnType<typeof useEditorRedactions>;
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
  editorConfig = DEFAULT_EDITOR_CONFIG,
  initialEnvelope,
  organisationEmails,
}: EnvelopeEditorProviderProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const [_searchParams, setSearchParams] = useSearchParams();

  const [envelope, _setEnvelope] = useState(initialEnvelope);
  const [autosaveError, setAutosaveError] = useState<boolean>(false);

  const envelopeRef = useRef(initialEnvelope);

  const externalFlushCallbacksRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const pendingMutationsRef = useRef<Set<Promise<unknown>>>(new Set());

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

  const setEnvelope: typeof _setEnvelope = (action) => {
    _setEnvelope((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      envelopeRef.current = next;
      return next;
    });
  };

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

  const createRedactionsMutation = trpc.redaction.createDocumentRedactions.useMutation();
  const updateRedactionsMutation = trpc.redaction.updateDocumentRedactions.useMutation();
  const deleteRedactionMutation = trpc.redaction.deleteDocumentRedaction.useMutation();

  // Ref used to break the circular dependency between `handleRedactionsUpdate`
  // (which needs to call `setRedactionIdByFormId` to attach server ids) and
  // `useEditorRedactions` (which needs `handleRedactionsUpdate` at creation time).
  const editorRedactionsRef = useRef<ReturnType<typeof useEditorRedactions> | null>(null);

  // FormIds for redactions whose CREATE mutation is currently in flight. We
  // filter these out of `toCreate` on subsequent handler calls so a drag or
  // resize during placement doesn't fire a second create for the same formId
  // (the real user sees one visual redaction; two server rows for it would
  // force a stale delete on the next action).
  const pendingCreateFormIdsRef = useRef<Set<string>>(new Set());

  const handleRedactionsUpdate = useCallback(
    async (next: TLocalRedaction[]) => {
      if (isEmbedded) {
        // Embedded mode doesn't persist redactions to our backend; noop.
        return;
      }

      const documentId = mapSecondaryIdToDocumentId(envelopeRef.current.secondaryId);
      const persisted = envelopeRef.current.redactions ?? [];

      const toCreate = next.filter(
        (r) => r.id === undefined && !pendingCreateFormIdsRef.current.has(r.formId),
      );

      const nextIds = new Set(next.filter((r) => r.id !== undefined).map((r) => r.id as number));
      const toDelete = persisted.filter((p) => !nextIds.has(p.id)).map((p) => p.id);

      // Diff for geometry changes on rows that already exist on the server.
      // Redaction update calls fire from drag-end / transform-end (see
      // use-editor-redactions.ts), so one mutation per user action is fine —
      // no debouncing required here.
      const EPSILON = 0.0001;
      const hasChanged = (a: (typeof persisted)[number], b: TLocalRedaction) =>
        a.page !== b.page ||
        Math.abs(Number(a.positionX) - b.positionX) > EPSILON ||
        Math.abs(Number(a.positionY) - b.positionY) > EPSILON ||
        Math.abs(Number(a.width) - b.width) > EPSILON ||
        Math.abs(Number(a.height) - b.height) > EPSILON;

      const toUpdate = next
        .filter((r): r is TLocalRedaction & { id: number } => r.id !== undefined)
        .map((r) => {
          const match = persisted.find((p) => p.id === r.id);
          return match && hasChanged(match, r) ? r : null;
        })
        .filter((r): r is TLocalRedaction & { id: number } => r !== null);

      try {
        if (toCreate.length > 0) {
          toCreate.forEach((r) => pendingCreateFormIdsRef.current.add(r.formId));

          let created;
          try {
            created = await createRedactionsMutation.mutateAsync({
              documentId,
              redactions: toCreate.map((r) => ({
                envelopeItemId: r.envelopeItemId,
                page: r.page,
                positionX: r.positionX,
                positionY: r.positionY,
                width: r.width,
                height: r.height,
              })),
            });
          } finally {
            toCreate.forEach((r) => pendingCreateFormIdsRef.current.delete(r.formId));
          }

          // Attach the server ids to the local records WITHOUT re-entering
          // `handleRedactionsUpdate` — bookkeeping only, not a user edit.
          created.redactions.forEach((serverRedaction, i) => {
            const local = toCreate[i];
            editorRedactionsRef.current?.setRedactionIdByFormId(local.formId, serverRedaction.id);
          });

          // Mirror the server rows into envelopeRef so subsequent diffs are correct.
          setEnvelope((prev) => ({
            ...prev,
            redactions: [
              ...(prev.redactions ?? []),
              ...created.redactions.map((r) => ({
                id: r.id,
                secondaryId: r.secondaryId,
                envelopeId: envelopeRef.current.id,
                envelopeItemId: r.envelopeItemId,
                page: r.page,
                positionX: new Prisma.Decimal(r.positionX),
                positionY: new Prisma.Decimal(r.positionY),
                width: new Prisma.Decimal(r.width),
                height: new Prisma.Decimal(r.height),
              })),
            ],
          }));
        }

        if (toUpdate.length > 0) {
          await updateRedactionsMutation.mutateAsync({
            documentId,
            redactions: toUpdate.map((r) => ({
              id: r.id,
              page: r.page,
              positionX: r.positionX,
              positionY: r.positionY,
              width: r.width,
              height: r.height,
            })),
          });

          // Mirror updates into envelopeRef so subsequent diffs are correct.
          setEnvelope((prev) => ({
            ...prev,
            redactions: (prev.redactions ?? []).map((p) => {
              const updated = toUpdate.find((u) => u.id === p.id);

              if (!updated) {
                return p;
              }

              return {
                ...p,
                page: updated.page,
                positionX: new Prisma.Decimal(updated.positionX),
                positionY: new Prisma.Decimal(updated.positionY),
                width: new Prisma.Decimal(updated.width),
                height: new Prisma.Decimal(updated.height),
              };
            }),
          }));
        }

        if (toDelete.length > 0) {
          await Promise.all(
            toDelete.map(async (id) =>
              deleteRedactionMutation.mutateAsync({ documentId, redactionId: id }),
            ),
          );

          setEnvelope((prev) => ({
            ...prev,
            redactions: (prev.redactions ?? []).filter((r) => !toDelete.includes(r.id)),
          }));
        }
      } catch (err) {
        console.error(err);
        setAutosaveError(true);
        toast({
          title: t`Save failed`,
          description: t`We encountered an error while saving your redactions. Your changes cannot be saved at this time.`,
          variant: 'destructive',
          duration: 7500,
        });
      }
    },
    [
      isEmbedded,
      createRedactionsMutation,
      updateRedactionsMutation,
      deleteRedactionMutation,
      toast,
      t,
    ],
  );

  const editorRedactions = useEditorRedactions({
    initialRedactions: envelope.redactions,
    handleRedactionsUpdate,
  });

  editorRedactionsRef.current = editorRedactions;

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
    (recipientId: number) =>
      getRecipientColor(envelope.recipients.findIndex((r) => r.id === recipientId)),
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
      editorRedactions.resetForm(fetchedEnvelopeData.data.redactions);
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
    editorRecipients.resetForm({
      recipients: envelopeRef.current.recipients,
      documentMeta: envelopeRef.current.documentMeta,
    });

    editorFields.resetForm(envelopeRef.current.fields);
    editorRedactions.resetForm(envelopeRef.current.redactions);
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
        editorRedactions,
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
