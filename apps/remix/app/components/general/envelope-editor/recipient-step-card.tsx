import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import type { RecipientStep } from '@documenso/lib/utils/recipient-groups';
import { cn } from '@documenso/ui/lib/utils';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import type { DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import { Trans } from '@lingui/react/macro';
import { GripVerticalIcon, Users2Icon } from 'lucide-react';

import { RecipientRow, type RecipientRowProps } from './recipient-row';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

export type DraggingType = 'STEP' | 'RECIPIENT' | null;

/**
 * Skips the drop animation. The post-drop state update re-sorts and renumbers
 * the groups anyway, so gliding to the predicted slot first makes every drop
 * feel like it settles twice — snapping hands control to the real re-render
 * immediately instead.
 */
const getDraggableStyle = (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => {
  if (!snapshot.isDropAnimating) {
    return provided.draggableProps.style;
  }

  return {
    ...provided.draggableProps.style,
    transitionDuration: '0.001s',
  };
};

export type RecipientStepCardSharedRowProps = Pick<
  RecipientRowProps,
  | 'showAdvancedSettings'
  | 'recipientSuggestions'
  | 'isLoadingSuggestions'
  | 'onRoleChange'
  | 'onRemove'
  | 'onAutoCompleteSelect'
  | 'onSearchQueryChange'
>;

export type RecipientStepCardProps = {
  stepIndex: number;
  step: RecipientStep<TEditorSigner>;
  isLastStep: boolean;
  draggableProvided: DraggableProvided;
  draggableSnapshot: DraggableStateSnapshot;
  draggingType: DraggingType;
  /**
   * Whether recipients may be combined into signing groups. False on CSC
   * (AES/QES) instances, where every signing recipient must hold a distinct
   * step. Constant for the session, so disabling the drop-zone with it does
   * not violate the "never toggle `isDropDisabled` mid-drag" constraint.
   */
  isGroupingEnabled: boolean;
  isStepLocked: boolean;
  isRemoveDisabled: boolean;
  flatIndexByFormId: Map<string, number>;
  canSignerBeModified: (signer: TEditorSigner) => boolean;
  isSubmitting: boolean;
  onUngroup: (stepIndex: number) => void;
  rowProps: RecipientStepCardSharedRowProps;
};

/**
 * The drop-zone strip rendered above each group card (and below the last one)
 * that receives recipient-row drops. Invisible until a dragged row hovers it,
 * then it shows a full-width green line marking the insertion point.
 *
 * Notes:
 * - It lives INSIDE the step's Draggable so it shifts together with the card
 *   while groups are being reordered — a static strip between draggables
 *   would stay behind while the cards around it are displaced, making group
 *   drags look broken.
 * - Its `droppableId` must stay STABLE while mounted (anchored to a formId,
 *   never a positional index): @hello-pangea/dnd does not support changing
 *   ids on mounted droppables/draggables, which silently breaks them.
 * - `type="RECIPIENT"` already scopes it to recipient-row drags, and
 *   `isDropDisabled` must not be toggled based on the active drag, as
 *   @hello-pangea/dnd snapshots it at drag start (before state updates land).
 * - It must keep a CONSTANT size: droppable geometry is captured when a drag
 *   starts, so resizing during the drag would leave the visible strip and the
 *   actual hit area in different places. Only colors may change mid-drag.
 */
const RecipientStepGap = ({ droppableId }: { droppableId: string }) => (
  <Droppable droppableId={droppableId} type="RECIPIENT">
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        data-testid="recipient-step-gap"
        className={cn('flex h-6 items-center', {
          'gap-active': snapshot.isDraggingOver,
        })}
      >
        <div
          className={cn('h-[3px] w-full rounded-full bg-primary opacity-0 transition-opacity duration-100', {
            'opacity-100': snapshot.isDraggingOver,
          })}
        />
        {provided.placeholder}
      </div>
    )}
  </Droppable>
);

export const RecipientStepCard = ({
  stepIndex,
  step,
  isLastStep,
  draggableProvided,
  draggableSnapshot,
  draggingType,
  isGroupingEnabled,
  isStepLocked,
  isRemoveDisabled,
  flatIndexByFormId,
  canSignerBeModified,
  isSubmitting,
  onUngroup,
  rowProps,
}: RecipientStepCardProps) => {
  const isGroup = step.members.length > 1;
  const isCombineTarget = draggingType === 'STEP' && Boolean(draggableSnapshot.combineTargetFor);

  // All droppable ids are anchored to the first member's formId (never a
  // positional index) so they stay stable while cards are reordered —
  // @hello-pangea/dnd does not support changing ids on mounted elements.
  const stepAnchor = step.members[0].formId;

  return (
    <div
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      style={getDraggableStyle(draggableProvided, draggableSnapshot)}
      className={cn({
        'pointer-events-none': draggableSnapshot.isDragging,
      })}
    >
      <RecipientStepGap droppableId={`gap-${stepAnchor}`} />

      <Droppable droppableId={`step-members-${stepAnchor}`} type="RECIPIENT" isDropDisabled={!isGroupingEnabled}>
        {(droppableProvided, droppableSnapshot) => {
          const isJoinTarget = draggingType === 'RECIPIENT' && droppableSnapshot.isDraggingOver;
          const isHighlighted = isCombineTarget || isJoinTarget;

          return (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              data-testid="recipient-step-card"
              className={cn('relative rounded-lg border bg-background px-3 pt-2 pb-1 transition-shadow', {
                'border-primary/60 bg-primary/5': isGroup,
                'bg-widget-foreground shadow-lg': draggableSnapshot.isDragging,
                'border-primary ring-1 ring-primary': isHighlighted,
              })}
            >
              {isHighlighted && (
                <Badge
                  variant="default"
                  size="small"
                  className="absolute -top-3 right-4 z-10 flex items-center gap-x-1 shadow-sm"
                >
                  <Users2Icon className="h-3 w-3" />
                  <Trans>Release to group</Trans>
                </Badge>
              )}

              <div className="flex flex-row items-center gap-x-1">
                <span
                  {...(draggableProvided.dragHandleProps ?? {})}
                  data-testid="step-drag-handle"
                  className={cn(
                    '-my-1 -ml-1.5 flex h-8 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded-md hover:bg-foreground/5 active:cursor-grabbing',
                    { 'pointer-events-none opacity-30': isStepLocked },
                  )}
                >
                  <GripVerticalIcon className="h-4 w-4 opacity-60" />
                </span>

                <Badge variant={isGroup ? 'default' : 'neutral'} size="small">
                  <Trans>Group {step.order}</Trans>
                </Badge>

                {isGroup && (
                  <>
                    <span className="ml-1 flex items-center gap-x-1.5 text-green-700 text-xs dark:text-green-400">
                      <Users2Icon className="h-3.5 w-3.5" />
                      <Trans>{step.members.length} recipients · any order</Trans>
                    </span>

                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      data-testid="ungroup-step-button"
                      className="ml-auto h-auto p-0 text-xs"
                      disabled={isStepLocked || isSubmitting}
                      onClick={() => onUngroup(stepIndex)}
                    >
                      <Trans>Ungroup</Trans>
                    </Button>
                  </>
                )}
              </div>

              {step.members.map((member, memberIndex) => {
                const signerIndex = flatIndexByFormId.get(member.formId) ?? -1;
                const canBeModified = canSignerBeModified(member);

                return (
                  <Draggable
                    key={member.formId}
                    draggableId={`recipient-${member.formId}`}
                    index={memberIndex}
                    isDragDisabled={isSubmitting || isStepLocked}
                  >
                    {(memberProvided, memberSnapshot) => (
                      <div
                        ref={memberProvided.innerRef}
                        {...memberProvided.draggableProps}
                        style={getDraggableStyle(memberProvided, memberSnapshot)}
                        className={cn({
                          'rounded-md bg-widget-foreground shadow-lg': memberSnapshot.isDragging,
                        })}
                      >
                        <RecipientRow
                          signerIndex={signerIndex}
                          signer={member}
                          isSequential={true}
                          isInputDisabled={memberSnapshot.isDragging || draggableSnapshot.isDragging}
                          canBeModified={canBeModified}
                          isRemoveDisabled={isRemoveDisabled}
                          dragHandleProps={memberProvided.dragHandleProps}
                          {...rowProps}
                        />
                      </div>
                    )}
                  </Draggable>
                );
              })}

              {droppableProvided.placeholder}
            </div>
          );
        }}
      </Droppable>

      {isLastStep && <RecipientStepGap droppableId="gap-end" />}
    </div>
  );
};
