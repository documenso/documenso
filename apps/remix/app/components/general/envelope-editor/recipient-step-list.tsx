import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  extractRecipientToNewStep,
  groupRecipientsBySigningOrder,
  mergeSteps,
  moveRecipientToStep,
  normalizeGroupedSigningOrders,
  reorderStep,
  ungroupStep,
} from '@documenso/lib/utils/recipient-groups';
import { canEditorRecipientBeModified, isAssistantLastSigner } from '@documenso/lib/utils/recipients';
import { trpc } from '@documenso/trpc/react';
import type { RecipientAutoCompleteOption } from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { cn } from '@documenso/ui/lib/utils';
import { useToast } from '@documenso/ui/primitives/use-toast';
import type { BeforeCapture, DropResult } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Trans, useLingui } from '@lingui/react/macro';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { useCallback, useMemo, useState } from 'react';

import { RecipientRow } from './recipient-row';
import { type DraggingType, RecipientStepCard } from './recipient-step-card';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

// Notes:
// - `type="RECIPIENT"` already scopes these droppables to recipient-row drags,
//   and `isDropDisabled` must not be toggled based on the active drag, as
//   @hello-pangea/dnd snapshots it at drag start (before state updates land).
// - The gap must keep a CONSTANT size: droppable geometry is captured when a
//   drag starts, so resizing during the drag would leave the visible strip and
//   the actual hit area in different places. Only colors may change mid-drag.
const RecipientStepGap = ({ gapIndex, draggingType }: { gapIndex: number; draggingType: DraggingType }) => (
  <Droppable droppableId={`gap-${gapIndex}`} type="RECIPIENT">
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        data-testid="recipient-step-gap"
        className={cn('h-6 rounded-md transition-colors', {
          'border border-dashed': draggingType === 'RECIPIENT',
          'border-primary bg-primary/10': snapshot.isDraggingOver,
        })}
      >
        {provided.placeholder}
      </div>
    )}
  </Droppable>
);

export type RecipientStepListProps = {
  showAdvancedSettings: boolean;
};

export const RecipientStepList = ({ showAdvancedSettings }: RecipientStepListProps) => {
  const { t } = useLingui();
  const { toast } = useToast();

  const { envelope, editorRecipients, isEmbedded } = useCurrentEnvelopeEditor();
  const { form } = editorRecipients;

  const [draggingType, setDraggingType] = useState<DraggingType>(null);
  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const debouncedRecipientSearchQuery = useDebouncedValue(recipientSearchQuery, 500);

  const { data: recipientSuggestionsData, isLoading } = trpc.recipient.suggestions.find.useQuery(
    {
      query: debouncedRecipientSearchQuery,
    },
    {
      enabled: debouncedRecipientSearchQuery.length > 1 && !isEmbedded,
      retry: false,
    },
  );

  const recipientSuggestions = recipientSuggestionsData?.results || [];

  const watchedSigners = form.watch('signers');
  const isSequential = form.watch('signingOrder') === DocumentSigningOrder.SEQUENTIAL;
  const { isSubmitting } = form.formState;

  const { steps, ccRecipients } = useMemo(() => groupRecipientsBySigningOrder(watchedSigners), [watchedSigners]);

  const isRemoveDisabled = watchedSigners.length === 1;

  const flatIndexByFormId = useMemo(
    () => new Map(watchedSigners.map((signer, index) => [signer.formId, index])),
    [watchedSigners],
  );

  const canSignerBeModified = useCallback(
    (signer: TEditorSigner) => canEditorRecipientBeModified(envelope, signer.id),
    [envelope],
  );

  const applySigners = useCallback(
    (updatedSigners: TEditorSigner[], options: { warnWhenAssistantLast?: boolean } = {}) => {
      const { warnWhenAssistantLast = true } = options;

      form.setValue('signers', updatedSigners, {
        shouldValidate: true,
        shouldDirty: true,
      });

      if (warnWhenAssistantLast && isAssistantLastSigner(updatedSigners)) {
        toast({
          title: t`Warning: Assistant as last signer`,
          description: t`Having an assistant as the last signer means they will be unable to take any action as there are no subsequent signers to assist.`,
        });
      }

      void form.trigger('signers');
    },
    [form, t, toast],
  );

  const handleRoleChange = useCallback(
    (signerIndex: number, role: RecipientRole) => {
      const currentSigners = form.getValues('signers');
      const signingOrder = form.getValues('signingOrder');

      if (role === RecipientRole.ASSISTANT && signingOrder === DocumentSigningOrder.PARALLEL) {
        form.setValue('signingOrder', DocumentSigningOrder.SEQUENTIAL, {
          shouldValidate: true,
          shouldDirty: true,
        });

        toast({
          title: t`Signing order is enabled.`,
          description: t`You cannot add assistants when signing order is disabled.`,
          variant: 'destructive',
        });

        return;
      }

      const updatedSigners = normalizeGroupedSigningOrders(
        currentSigners.map((signer, index) => ({
          ...signer,
          role: index === signerIndex ? role : signer.role,
        })),
        canSignerBeModified,
      );

      applySigners(updatedSigners, { warnWhenAssistantLast: role === RecipientRole.ASSISTANT });
    },
    [form, toast, t, canSignerBeModified, applySigners],
  );

  const handleRemove = useCallback(
    (signerIndex: number) => {
      const signer = form.getValues('signers')[signerIndex];

      if (!signer) {
        return;
      }

      if (!canSignerBeModified(signer)) {
        toast({
          title: t`Cannot remove signer`,
          description: t`This signer has already signed the document.`,
          variant: 'destructive',
        });

        return;
      }

      const updatedSigners = normalizeGroupedSigningOrders(
        form.getValues('signers').filter((s) => s.formId !== signer.formId),
        canSignerBeModified,
      );

      applySigners(updatedSigners, { warnWhenAssistantLast: false });
    },
    [form, toast, t, canSignerBeModified, applySigners],
  );

  const handleUngroup = useCallback(
    (stepIndex: number) => {
      applySigners(ungroupStep(form.getValues('signers'), stepIndex, canSignerBeModified));
    },
    [form, canSignerBeModified, applySigners],
  );

  const handleAutoCompleteSelect = useCallback(
    (signerIndex: number, suggestion: RecipientAutoCompleteOption) => {
      form.setValue(`signers.${signerIndex}.email`, suggestion.email, {
        shouldValidate: true,
        shouldDirty: true,
      });
      form.setValue(`signers.${signerIndex}.name`, suggestion.name || '', {
        shouldValidate: true,
        shouldDirty: true,
      });
    },
    [form],
  );

  const onBeforeCapture = useCallback((before: BeforeCapture) => {
    setDraggingType(before.draggableId.startsWith('step-') ? 'STEP' : 'RECIPIENT');
  }, []);

  const onDragEnd = useCallback(
    (result: DropResult) => {
      setDraggingType(null);

      const currentSigners = form.getValues('signers');

      if (result.type === 'STEP') {
        if (result.combine) {
          const targetStepIndex = Number(result.combine.draggableId.slice('step-'.length));

          applySigners(mergeSteps(currentSigners, result.source.index, targetStepIndex, canSignerBeModified));

          return;
        }

        if (result.destination) {
          applySigners(reorderStep(currentSigners, result.source.index, result.destination.index, canSignerBeModified));
        }

        return;
      }

      if (result.type === 'RECIPIENT' && result.destination) {
        const formId = result.draggableId.slice('recipient-'.length);
        const { droppableId } = result.destination;

        if (droppableId.startsWith('gap-')) {
          const gapIndex = Number(droppableId.slice('gap-'.length));

          applySigners(extractRecipientToNewStep(currentSigners, formId, gapIndex, canSignerBeModified));

          return;
        }

        if (droppableId.startsWith('step-members-')) {
          const targetStepIndex = Number(droppableId.slice('step-members-'.length));

          applySigners(moveRecipientToStep(currentSigners, formId, targetStepIndex, canSignerBeModified));
        }
      }
    },
    [form, canSignerBeModified, applySigners],
  );

  const sharedRowProps = {
    showAdvancedSettings,
    recipientSuggestions,
    isLoadingSuggestions: isLoading,
    onRoleChange: handleRoleChange,
    onRemove: handleRemove,
    onAutoCompleteSelect: handleAutoCompleteSelect,
    onSearchQueryChange: setRecipientSearchQuery,
  };

  return (
    <div>
      {!showAdvancedSettings && (
        <div className={cn('mb-1 flex flex-row gap-x-2 text-sm', { 'pl-[4.75rem]': isSequential })}>
          <span className="w-full">
            <Trans>Email</Trans>
          </span>
          <span className="w-full">
            <Trans>Name</Trans>
          </span>
          <span className="w-[7.5rem] flex-shrink-0" />
        </div>
      )}

      {!isSequential ? (
        <div className="flex w-full flex-col">
          {watchedSigners.map((signer, index) => (
            <RecipientRow
              key={signer.formId}
              signerIndex={index}
              signer={signer}
              isSequential={false}
              isInputDisabled={false}
              canBeModified={canSignerBeModified(signer)}
              isRemoveDisabled={isRemoveDisabled}
              dragHandleProps={null}
              {...sharedRowProps}
            />
          ))}
        </div>
      ) : (
        <>
          <DragDropContext onBeforeCapture={onBeforeCapture} onDragEnd={onDragEnd}>
            <Droppable droppableId="recipient-steps" type="STEP" isCombineEnabled>
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="flex w-full flex-col">
                  {steps.map((step, stepIndex) => {
                    const isStepLocked = step.members.some((member) => !canSignerBeModified(member));

                    return (
                      <div key={`step-fragment-${step.members[0].formId}`}>
                        <RecipientStepGap gapIndex={stepIndex} draggingType={draggingType} />

                        <Draggable
                          draggableId={`step-${stepIndex}`}
                          index={stepIndex}
                          isDragDisabled={isSubmitting || isStepLocked}
                        >
                          {(draggableProvided, draggableSnapshot) => (
                            <RecipientStepCard
                              stepIndex={stepIndex}
                              step={step}
                              draggableProvided={draggableProvided}
                              draggableSnapshot={draggableSnapshot}
                              draggingType={draggingType}
                              isStepLocked={isStepLocked}
                              isRemoveDisabled={isRemoveDisabled}
                              flatIndexByFormId={flatIndexByFormId}
                              canSignerBeModified={canSignerBeModified}
                              isSubmitting={isSubmitting}
                              onUngroup={handleUngroup}
                              rowProps={sharedRowProps}
                            />
                          )}
                        </Draggable>
                      </div>
                    );
                  })}

                  <RecipientStepGap gapIndex={steps.length} draggingType={draggingType} />

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {ccRecipients.map((signer) => (
            <div key={signer.formId} className="my-1 rounded-lg border px-3 py-1">
              <RecipientRow
                signerIndex={flatIndexByFormId.get(signer.formId) ?? -1}
                signer={signer}
                isSequential={true}
                isInputDisabled={false}
                canBeModified={canSignerBeModified(signer)}
                isRemoveDisabled={isRemoveDisabled}
                dragHandleProps={null}
                {...sharedRowProps}
              />
            </div>
          ))}
        </>
      )}
    </div>
  );
};
