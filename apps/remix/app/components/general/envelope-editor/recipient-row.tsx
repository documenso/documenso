import type { TEditorRecipientsFormSchema } from '@documenso/lib/client-only/hooks/use-editor-recipients';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import { useCurrentOrganisation } from '@documenso/lib/client-only/providers/organisation';
import { isCcRecipient } from '@documenso/lib/utils/recipients';
import { RecipientActionAuthSelect } from '@documenso/ui/components/recipient/recipient-action-auth-select';
import {
  RecipientAutoCompleteInput,
  type RecipientAutoCompleteOption,
} from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { FormControl, FormField, FormItem, FormMessage } from '@documenso/ui/primitives/form/form';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { useLingui } from '@lingui/react/macro';
import { EnvelopeType, type RecipientRole } from '@prisma/client';
import { GripVerticalIcon, TrashIcon } from 'lucide-react';
import { memo } from 'react';
import { useFormContext } from 'react-hook-form';

type TEditorSigner = TEditorRecipientsFormSchema['signers'][number];

export type RecipientRowProps = {
  signerIndex: number;
  signer: TEditorSigner;
  isSequential: boolean;
  isInputDisabled: boolean;
  canBeModified: boolean;
  isRemoveDisabled: boolean;
  showAdvancedSettings: boolean;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  recipientSuggestions: RecipientAutoCompleteOption[];
  isLoadingSuggestions: boolean;
  onRoleChange: (signerIndex: number, role: RecipientRole) => void;
  onRemove: (signerIndex: number) => void;
  onAutoCompleteSelect: (signerIndex: number, suggestion: RecipientAutoCompleteOption) => void;
  onSearchQueryChange: (query: string) => void;
};

const RecipientRowInner = ({
  signerIndex,
  signer,
  isSequential,
  isInputDisabled,
  canBeModified,
  isRemoveDisabled,
  showAdvancedSettings,
  dragHandleProps,
  recipientSuggestions,
  isLoadingSuggestions,
  onRoleChange,
  onRemove,
  onAutoCompleteSelect,
  onSearchQueryChange,
}: RecipientRowProps) => {
  const { t } = useLingui();

  const { envelope, editorConfig } = useCurrentEnvelopeEditor();
  const organisation = useCurrentOrganisation();

  const form = useFormContext<TEditorRecipientsFormSchema>();

  const { isSubmitting } = form.formState;

  const isDirectRecipient =
    envelope.type === EnvelopeType.TEMPLATE &&
    envelope.directLink !== null &&
    signer.id === envelope.directLink.directTemplateRecipientId;

  const isFieldDisabled = isInputDisabled || isSubmitting || !canBeModified;

  const rowErrors = form.formState.errors.signers?.[signerIndex];

  return (
    <fieldset data-native-id={signer.id} disabled={isSubmitting || !canBeModified} className="py-1">
      <div className="flex flex-row items-center gap-x-2">
        {isSequential && !isCcRecipient(signer) && (
          <span
            {...(dragHandleProps ?? {})}
            data-testid="recipient-row-drag-handle"
            className={cn(
              'mt-auto -ml-1.5 flex h-10 w-8 flex-shrink-0 cursor-grab items-center justify-center rounded-md hover:bg-foreground/5 active:cursor-grabbing',
              {
                'mb-6': rowErrors,
                'cursor-default hover:bg-transparent': !dragHandleProps,
              },
            )}
          >
            <GripVerticalIcon
              className={cn('h-5 w-5 flex-shrink-0 opacity-40', {
                'opacity-10': !dragHandleProps,
              })}
            />
          </span>
        )}

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.email`}
          render={({ field }) => (
            <FormItem
              className={cn('relative w-full', {
                'mb-6': rowErrors && !rowErrors.email,
              })}
            >
              <FormControl>
                <RecipientAutoCompleteInput
                  type="email"
                  placeholder={t`Email`}
                  value={field.value}
                  disabled={isFieldDisabled || isDirectRecipient}
                  options={recipientSuggestions}
                  onSelect={(suggestion) => onAutoCompleteSelect(signerIndex, suggestion)}
                  onSearchQueryChange={(query) => {
                    field.onChange(query);
                    onSearchQueryChange(query);
                  }}
                  loading={isLoadingSuggestions}
                  data-testid="signer-email-input"
                  maxLength={254}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.name`}
          render={({ field }) => (
            <FormItem
              className={cn('w-full', {
                'mb-6': rowErrors && !rowErrors.name,
              })}
            >
              <FormControl>
                <RecipientAutoCompleteInput
                  type="text"
                  placeholder={t`Recipient ${signerIndex + 1}`}
                  {...field}
                  disabled={isFieldDisabled || isDirectRecipient}
                  options={recipientSuggestions}
                  onSelect={(suggestion) => onAutoCompleteSelect(signerIndex, suggestion)}
                  onSearchQueryChange={(query) => {
                    field.onChange(query);
                    onSearchQueryChange(query);
                  }}
                  loading={isLoadingSuggestions}
                  maxLength={255}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`signers.${signerIndex}.role`}
          render={({ field }) => (
            <FormItem
              className={cn('mt-auto w-fit', {
                'mb-6': rowErrors && !rowErrors.role,
              })}
            >
              <FormControl>
                <RecipientRoleSelect
                  {...field}
                  hideAssistantRole={!editorConfig.recipients?.allowAssistantRole}
                  hideCCerRole={!editorConfig.recipients?.allowCCerRole}
                  hideViewerRole={!editorConfig.recipients?.allowViewerRole}
                  hideApproverRole={!editorConfig.recipients?.allowApproverRole}
                  isAssistantEnabled={isSequential}
                  onValueChange={(value) => {
                    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    onRoleChange(signerIndex, value as RecipientRole);
                  }}
                  disabled={isFieldDisabled}
                />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          variant="ghost"
          className={cn('mt-auto px-2', {
            'mb-6': rowErrors,
          })}
          data-testid="remove-signer-button"
          disabled={isFieldDisabled || isRemoveDisabled || isDirectRecipient}
          onClick={() => onRemove(signerIndex)}
        >
          <TrashIcon className="h-4 w-4" />
        </Button>
      </div>

      {showAdvancedSettings && organisation.organisationClaim.flags.cfr21 && (
        <FormField
          control={form.control}
          name={`signers.${signerIndex}.actionAuth`}
          render={({ field }) => (
            <FormItem
              className={cn('mt-2 w-full', {
                'mb-6': rowErrors && !rowErrors.actionAuth,
                'pl-6': isSequential,
              })}
            >
              <FormControl>
                <RecipientActionAuthSelect {...field} onValueChange={field.onChange} disabled={isFieldDisabled} />
              </FormControl>

              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </fieldset>
  );
};

/**
 * Memoized: rows contain heavy inputs (autocomplete, role select) and would
 * otherwise re-render on every drag state change, making drags feel sluggish.
 * All callback props are stable (useCallback in the list) and `signer` object
 * identities only change when form values actually change.
 */
export const RecipientRow = memo(RecipientRowInner);
