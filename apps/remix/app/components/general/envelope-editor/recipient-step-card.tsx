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

export type RecipientStepCardSharedRowProps = Pick<
  RecipientRowProps,
  | 'stepCount'
  | 'showAdvancedSettings'
  | 'recipientSuggestions'
  | 'isLoadingSuggestions'
  | 'onSigningOrderChange'
  | 'onRoleChange'
  | 'onRemove'
  | 'onAutoCompleteSelect'
  | 'onSearchQueryChange'
>;

export type RecipientStepCardProps = {
  stepIndex: number;
  step: RecipientStep<TEditorSigner>;
  draggableProvided: DraggableProvided;
  draggableSnapshot: DraggableStateSnapshot;
  draggingType: DraggingType;
  isStepLocked: boolean;
  isRemoveDisabled: boolean;
  flatIndexByFormId: Map<string, number>;
  canSignerBeModified: (signer: TEditorSigner) => boolean;
  isSubmitting: boolean;
  onUngroup: (stepIndex: number) => void;
  rowProps: RecipientStepCardSharedRowProps;
};

export const RecipientStepCard = ({
  stepIndex,
  step,
  draggableProvided,
  draggableSnapshot,
  draggingType,
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

  return (
    <div
      ref={draggableProvided.innerRef}
      {...draggableProvided.draggableProps}
      className={cn('py-1', {
        'pointer-events-none': draggableSnapshot.isDragging,
      })}
    >
      <Droppable
        droppableId={`step-members-${stepIndex}`}
        type="RECIPIENT"
        isDropDisabled={draggingType !== 'RECIPIENT'}
      >
        {(droppableProvided, droppableSnapshot) => {
          const isJoinTarget = draggingType === 'RECIPIENT' && droppableSnapshot.isDraggingOver;
          const isHighlighted = isCombineTarget || isJoinTarget;

          return (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              data-testid="recipient-step-card"
              className={cn('relative rounded-lg border px-3 pt-2 pb-1', {
                'border-primary/60 bg-primary/5': isGroup,
                'bg-widget-foreground': draggableSnapshot.isDragging,
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
                  <Trans>Release to sign together</Trans>
                </Badge>
              )}

              <div className="flex flex-row items-center gap-x-2">
                <span
                  {...(draggableProvided.dragHandleProps ?? {})}
                  data-testid="step-drag-handle"
                  className={cn({ 'pointer-events-none opacity-30': isStepLocked })}
                >
                  <GripVerticalIcon className="h-4 w-4 opacity-40" />
                </span>

                <Badge variant="neutral" size="small">
                  <Trans>Step {step.order}</Trans>
                </Badge>

                {isGroup && (
                  <>
                    <span className="flex items-center gap-x-1.5 text-muted-foreground text-xs">
                      <Users2Icon className="h-3.5 w-3.5" />
                      <Trans>{step.members.length} signers · any order</Trans>
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
                    isDragDisabled={isSubmitting || !canBeModified}
                  >
                    {(memberProvided, memberSnapshot) => (
                      <div
                        ref={memberProvided.innerRef}
                        {...memberProvided.draggableProps}
                        className={cn({
                          'rounded-md bg-widget-foreground': memberSnapshot.isDragging,
                        })}
                      >
                        <RecipientRow
                          signerIndex={signerIndex}
                          signer={member}
                          isSequential={true}
                          isGrouped={isGroup}
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
    </div>
  );
};
