import { useCallback, useRef } from 'react';

import type { DropResult, SensorAPI } from '@hello-pangea/dnd';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { DocumentSigningOrder, RecipientRole } from '@prisma/client';
import { motion } from 'framer-motion';
import { GripVertical, HelpCircle, Plus, Trash } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { Control } from 'react-hook-form';
import { useFieldArray, useFormContext, useFormState } from 'react-hook-form';

import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { Checkbox } from '@documenso/ui/primitives/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@documenso/ui/primitives/tooltip';

import { useConfigureDocument } from './configure-document-context';
import type { TConfigureEmbedFormSchema } from './configure-document-view.types';

// Define a type for signer items
type SignerItem = TConfigureEmbedFormSchema['signers'][number];

export interface ConfigureDocumentRecipientsProps {
  control: Control<TConfigureEmbedFormSchema>;
  isSubmitting: boolean;
}

export const ConfigureDocumentRecipients = ({
  control,
  isSubmitting,
}: ConfigureDocumentRecipientsProps) => {
  const { _ } = useLingui();
  const { isTemplate } = useConfigureDocument();

  const $sensorApi = useRef<SensorAPI | null>(null);

  const {
    fields: signers,
    append: appendSigner,
    remove: removeSigner,
    replace,
    move,
  } = useFieldArray({
    control,
    name: 'signers',
  });

  const { getValues, watch, setValue } = useFormContext<TConfigureEmbedFormSchema>();

  const signingOrder = watch('meta.signingOrder');

  const { errors } = useFormState({
    control,
  });

  const onAddSigner = useCallback(() => {
    const recipientSigningOrder =
      signers.length > 0 ? (signers[signers.length - 1]?.signingOrder || 0) + 1 : 1;

    appendSigner({
      formId: nanoid(8),
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
      signingOrder:
        signingOrder === DocumentSigningOrder.SEQUENTIAL ? recipientSigningOrder : undefined,
    });
  }, [appendSigner, signers]);

  const isSigningOrderEnabled = signingOrder === DocumentSigningOrder.SEQUENTIAL;

  const handleSigningOrderChange = useCallback(
    (index: number, newOrderString: string) => {
      const trimmedOrderString = newOrderString.trim();
      if (!trimmedOrderString) {
        return;
      }

      const newOrder = Number(trimmedOrderString);
      if (!Number.isInteger(newOrder) || newOrder < 1) {
        return;
      }

      // Get current form values to preserve unsaved input data
      const currentSigners = getValues('signers') || [...signers];
      const signer = currentSigners[index];

      // Remove signer from current position and insert at new position
      const remainingSigners = currentSigners.filter((_: unknown, idx: number) => idx !== index);
      const newPosition = Math.min(Math.max(0, newOrder - 1), currentSigners.length - 1);
      remainingSigners.splice(newPosition, 0, signer);

      // Update signing order for each item
      const updatedSigners = remainingSigners.map((s: SignerItem, idx: number) => ({
        ...s,
        signingOrder: signingOrder === DocumentSigningOrder.SEQUENTIAL ? idx + 1 : undefined,
      }));

      // Update the form
      replace(updatedSigners);
    },
    [signers, replace, getValues],
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      // Use the move function from useFieldArray which preserves input values
      move(result.source.index, result.destination.index);

      // Update signing orders after move
      const currentSigners = getValues('signers');
      const updatedSigners = currentSigners.map((signer: SignerItem, index: number) => ({
        ...signer,
        signingOrder: signingOrder === DocumentSigningOrder.SEQUENTIAL ? index + 1 : undefined,
      }));

      // Update the form with new ordering
      replace(updatedSigners);
    },
    [move, replace, getValues],
  );

  const onSigningOrderChange = (signingOrder: DocumentSigningOrder) => {
    setValue('meta.signingOrder', signingOrder);

    if (signingOrder === DocumentSigningOrder.SEQUENTIAL) {
      signers.forEach((_signer, index) => {
        setValue(`signers.${index}.signingOrder`, index + 1);
      });
    }
  };

  return (
    <div>
      <h3 className="text-foreground mb-1 text-lg font-medium">
        <Trans>Recipients</Trans>
      </h3>

      <p className="text-muted-foreground mb-6 text-sm">
        <Trans>Add signers and configure signing preferences</Trans>
      </p>

      <FormField
        control={control}
        name="meta.signingOrder"
        render={({ field }) => (
          <FormItem className="mb-6 flex flex-row items-center space-x-2 space-y-0">
            <FormControl>
              <Checkbox
                {...field}
                id="signingOrder"
                checked={field.value === DocumentSigningOrder.SEQUENTIAL}
                onCheckedChange={(checked) =>
                  onSigningOrderChange(
                    checked ? DocumentSigningOrder.SEQUENTIAL : DocumentSigningOrder.PARALLEL,
                  )
                }
                disabled={isSubmitting}
              />
            </FormControl>
            <FormLabel
              htmlFor="signingOrder"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              <Trans>Enable signing order</Trans>
            </FormLabel>
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="meta.allowDictateNextSigner"
        render={({ field: { value, ...field } }) => (
          <FormItem className="mb-6 flex flex-row items-center space-x-2 space-y-0">
            <FormControl>
              <Checkbox
                {...field}
                id="allowDictateNextSigner"
                checked={value}
                onCheckedChange={field.onChange}
                disabled={isSubmitting || !isSigningOrderEnabled}
              />
            </FormControl>

            <div className="flex items-center">
              <FormLabel
                htmlFor="allowDictateNextSigner"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                <Trans>Allow signers to dictate next signer</Trans>
              </FormLabel>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-muted-foreground ml-1 cursor-help">
                    <HelpCircle className="h-3.5 w-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-80 p-4">
                  <p>
                    <Trans>
                      When enabled, signers can choose who should sign next in the sequence instead
                      of following the predefined order.
                    </Trans>
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </FormItem>
        )}
      />

      <DragDropContext
        onDragEnd={onDragEnd}
        sensors={[
          (api: SensorAPI) => {
            $sensorApi.current = api;
          },
        ]}
      >
        <Droppable droppableId="signers">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {signers.map((signer, index) => (
                <Draggable
                  key={signer.id}
                  draggableId={signer.id}
                  index={index}
                  isDragDisabled={!isSigningOrderEnabled || isSubmitting || signer.disabled}
                >
                  {(provided, snapshot) => (
                    <fieldset
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      disabled={signer.disabled}
                      className={cn('py-1', {
                        'bg-widget-foreground pointer-events-none rounded-md pt-2':
                          snapshot.isDragging,
                      })}
                    >
                      <motion.div
                        className={cn('flex items-end gap-2 pb-2', {
                          'border-destructive/50': errors?.signers?.[index],
                        })}
                      >
                        {isSigningOrderEnabled && (
                          <FormField
                            control={control}
                            name={`signers.${index}.signingOrder`}
                            render={({ field }) => (
                              <FormItem
                                className={cn('flex w-16 flex-none items-center gap-x-1', {
                                  'mb-6':
                                    errors?.signers?.[index] &&
                                    !errors?.signers?.[index]?.signingOrder,
                                })}
                              >
                                <GripVertical className="h-5 w-5 flex-shrink-0 opacity-40" />
                                <FormControl>
                                  <Input
                                    type="number"
                                    max={signers.length}
                                    min={1}
                                    className="w-full text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                    {...field}
                                    disabled={isSubmitting || snapshot.isDragging}
                                    onChange={(e) => {
                                      field.onChange(e);
                                    }}
                                    onBlur={(e) => {
                                      field.onBlur();
                                      handleSigningOrderChange(index, e.target.value);
                                    }}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}

                        <FormField
                          control={control}
                          name={`signers.${index}.name`}
                          render={({ field }) => (
                            <FormItem
                              className={cn('flex-1', {
                                'mb-6': errors?.signers?.[index] && !errors?.signers?.[index]?.name,
                              })}
                            >
                              <FormLabel className="sr-only">
                                <Trans>Name</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  placeholder={_(msg`Name`)}
                                  className="w-full"
                                  {...field}
                                  disabled={isSubmitting || snapshot.isDragging}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name={`signers.${index}.email`}
                          render={({ field }) => (
                            <FormItem
                              className={cn('flex-1', {
                                'mb-6':
                                  errors?.signers?.[index] && !errors?.signers?.[index]?.email,
                              })}
                            >
                              <FormLabel className="sr-only">
                                <Trans>Email</Trans>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  placeholder={_(msg`Email`)}
                                  className="w-full"
                                  {...field}
                                  disabled={isSubmitting || snapshot.isDragging}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={control}
                          name={`signers.${index}.role`}
                          render={({ field }) => (
                            <FormItem
                              className={cn('flex-none', {
                                'mb-6': errors?.signers?.[index] && !errors?.signers?.[index]?.role,
                              })}
                            >
                              <FormLabel className="sr-only">
                                <Trans>Role</Trans>
                              </FormLabel>
                              <FormControl>
                                <RecipientRoleSelect
                                  {...field}
                                  isAssistantEnabled={isSigningOrderEnabled}
                                  onValueChange={field.onChange}
                                  disabled={isSubmitting || snapshot.isDragging || signer.disabled}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <Button
                          type="button"
                          variant="ghost"
                          disabled={
                            isSubmitting ||
                            signers.length === 1 ||
                            snapshot.isDragging ||
                            signer.disabled
                          }
                          onClick={() => removeSigner(index)}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    </fieldset>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-auto"
          disabled={isSubmitting}
          onClick={onAddSigner}
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          <Trans>Add Signer</Trans>
        </Button>
      </div>
    </div>
  );
};
