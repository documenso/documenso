import { useEffect, useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { PlusIcon, TrashIcon } from 'lucide-react';
import { type FieldError, useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useDebouncedValue } from '@documenso/lib/client-only/hooks/use-debounced-value';
import { nanoid } from '@documenso/lib/universal/id';
import { trpc } from '@documenso/trpc/react';
import { RecipientAutoCompleteInput } from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import type { RecipientAutoCompleteOption } from '@documenso/ui/components/recipient/recipient-autocomplete-input';
import { RecipientRoleSelect } from '@documenso/ui/components/recipient/recipient-role-select';
import { cn } from '@documenso/ui/lib/utils';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { FormErrorMessage } from '@documenso/ui/primitives/form/form-error-message';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@documenso/ui/primitives/tooltip';

import type { RecipientForCreation } from '~/utils/detect-document-recipients';

const ZSuggestedRecipientSchema = z.object({
  formId: z.string().min(1),
  name: z
    .string()
    .min(1, { message: msg`Name is required`.id })
    .max(255),
  email: z
    .string()
    .min(1, { message: msg`Email is required`.id })
    .email({ message: msg`Invalid email`.id })
    .max(254),
  role: z.nativeEnum(RecipientRole),
});

const ZSuggestedRecipientsFormSchema = z.object({
  recipients: z
    .array(ZSuggestedRecipientSchema)
    .min(1, { message: msg`Please add at least one recipient`.id }),
});

type TSuggestedRecipientsFormSchema = z.infer<typeof ZSuggestedRecipientsFormSchema>;

export type SuggestedRecipientsFormProps = {
  recipients: RecipientForCreation[] | null;
  onCancel: () => void;
  onSubmit: (recipients: RecipientForCreation[]) => Promise<void> | void;
  onAutoAddFields?: (recipients: RecipientForCreation[]) => Promise<void> | void;
  isProcessing?: boolean;
};

export const SuggestedRecipientsForm = ({
  recipients,
  onCancel,
  onSubmit,
  onAutoAddFields,
  isProcessing = false,
}: SuggestedRecipientsFormProps) => {
  const { t } = useLingui();

  const [recipientSearchQuery, setRecipientSearchQuery] = useState('');

  const debouncedRecipientSearchQuery = useDebouncedValue(recipientSearchQuery, 500);

  const { data: recipientSuggestionsData, isLoading } = trpc.recipient.suggestions.find.useQuery(
    {
      query: debouncedRecipientSearchQuery,
    },
    {
      enabled: debouncedRecipientSearchQuery.length > 1,
    },
  );

  const recipientSuggestions = recipientSuggestionsData?.results || [];

  const defaultRecipients = useMemo(() => {
    if (recipients && recipients.length > 0) {
      const sorted = [...recipients].sort((a, b) => {
        const orderA = a.signingOrder ?? 0;
        const orderB = b.signingOrder ?? 0;

        return orderA - orderB;
      });

      return sorted.map((recipient) => ({
        formId: nanoid(),
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
      }));
    }

    return [
      {
        formId: nanoid(),
        name: '',
        email: '',
        role: RecipientRole.SIGNER,
      },
    ];
  }, [recipients]);

  const form = useForm<TSuggestedRecipientsFormSchema>({
    resolver: zodResolver(ZSuggestedRecipientsFormSchema),
    defaultValues: {
      recipients: defaultRecipients,
    },
  });
  const {
    formState: { isSubmitting },
  } = form;

  useEffect(() => {
    form.reset({
      recipients: defaultRecipients,
    });
  }, [defaultRecipients, form]);

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'recipients',
  });

  const handleRecipientAutoCompleteSelect = (
    index: number,
    suggestion: RecipientAutoCompleteOption,
  ) => {
    form.setValue(`recipients.${index}.email`, suggestion.email);
    form.setValue(`recipients.${index}.name`, suggestion.name ?? suggestion.email);
  };

  const handleAddSigner = () => {
    append({
      formId: nanoid(),
      name: '',
      email: '',
      role: RecipientRole.SIGNER,
    });
  };

  const handleRemoveSigner = (index: number) => {
    remove(index);
  };

  const handleSubmit = form.handleSubmit(async (values) => {
    const normalizedRecipients: RecipientForCreation[] = values.recipients.map(
      (recipient, index) => ({
        name: recipient.name.trim(),
        email: recipient.email.trim(),
        role: recipient.role,
        signingOrder: index + 1,
      }),
    );

    try {
      await onSubmit(normalizedRecipients);
    } catch (error) {
      // Log for debugging
      console.error('Failed to submit recipients:', error);
      // Form level errors are surfaced via toasts in the parent. Keep the dialog open.
    }
  });

  const handleAutoAddFields = form.handleSubmit(async (values) => {
    if (!onAutoAddFields) {
      return;
    }

    const normalizedRecipients: RecipientForCreation[] = values.recipients.map(
      (recipient, index) => ({
        name: recipient.name.trim(),
        email: recipient.email.trim(),
        role: recipient.role,
        signingOrder: index + 1,
      }),
    );

    try {
      await onAutoAddFields(normalizedRecipients);
    } catch (error) {
      // Log for debugging
      console.error('Failed to auto-add fields:', error);
      // Form level errors are surfaced via toasts in the parent. Keep the dialog open.
    }
  });

  const getRecipientsRootError = (
    error: typeof form.formState.errors.recipients,
  ): FieldError | undefined => {
    if (typeof error !== 'object' || !error || !('root' in error)) {
      return undefined;
    }

    const candidate = (error as { root?: FieldError }).root;
    return typeof candidate === 'object' ? candidate : undefined;
  };

  const recipientsRootError = getRecipientsRootError(form.formState.errors.recipients);

  return (
    <Form {...form}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-4 md:flex-row md:items-center md:gap-x-2"
            >
              <FormField
                control={form.control}
                name={`recipients.${index}.email`}
                render={({ field: emailField }) => (
                  <FormItem
                    className={cn('relative w-full', {
                      'mb-6':
                        form.formState.errors.recipients?.[index] &&
                        !form.formState.errors.recipients[index]?.email,
                    })}
                  >
                    {index === 0 && (
                      <FormLabel required>
                        <Trans>Email</Trans>
                      </FormLabel>
                    )}
                    <FormControl>
                      <RecipientAutoCompleteInput
                        type="email"
                        placeholder={t`Email`}
                        value={emailField.value}
                        options={recipientSuggestions}
                        onSelect={(suggestion) =>
                          handleRecipientAutoCompleteSelect(index, suggestion)
                        }
                        onSearchQueryChange={(query) => {
                          emailField.onChange(query);
                          setRecipientSearchQuery(query);
                        }}
                        loading={isLoading}
                        disabled={isSubmitting}
                        maxLength={254}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`recipients.${index}.name`}
                render={({ field: nameField }) => (
                  <FormItem
                    className={cn('w-full', {
                      'mb-6':
                        form.formState.errors.recipients?.[index] &&
                        !form.formState.errors.recipients[index]?.name,
                    })}
                  >
                    {index === 0 && (
                      <FormLabel>
                        <Trans>Name</Trans>
                      </FormLabel>
                    )}
                    <FormControl>
                      <RecipientAutoCompleteInput
                        type="text"
                        placeholder={t`Name`}
                        value={nameField.value}
                        options={recipientSuggestions}
                        onSelect={(suggestion) =>
                          handleRecipientAutoCompleteSelect(index, suggestion)
                        }
                        onSearchQueryChange={(query) => {
                          nameField.onChange(query);
                          setRecipientSearchQuery(query);
                        }}
                        loading={isLoading}
                        disabled={isSubmitting}
                        maxLength={255}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`recipients.${index}.role`}
                render={({ field: roleField }) => (
                  <FormItem
                    className={cn('mt-2 w-full md:mt-auto md:w-fit', {
                      'mb-6':
                        form.formState.errors.recipients?.[index] &&
                        !form.formState.errors.recipients[index]?.role,
                    })}
                  >
                    {index === 0 && (
                      <FormLabel>
                        <Trans>Role</Trans>
                      </FormLabel>
                    )}
                    <FormControl>
                      <RecipientRoleSelect
                        value={roleField.value}
                        onValueChange={roleField.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                variant="ghost"
                className={cn('mt-2 w-full px-2 md:mt-auto md:w-auto', {
                  'mb-6': form.formState.errors.recipients?.[index],
                })}
                onClick={() => handleRemoveSigner(index)}
                disabled={isSubmitting || fields.length === 1}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <FormErrorMessage className="mt-2" error={recipientsRootError} />

          <div className="flex">
            <Button
              type="button"
              variant="outline"
              onClick={handleAddSigner}
              className="w-full md:w-auto"
              disabled={isSubmitting}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              <Trans>Add signer</Trans>
            </Button>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={isSubmitting || isProcessing}
          >
            <Trans>Cancel</Trans>
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button type="submit" disabled={isSubmitting || isProcessing}>
              <Trans>Use recipients</Trans>
            </Button>

            {onAutoAddFields && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        type="button"
                        onClick={handleAutoAddFields}
                        disabled={
                          isSubmitting ||
                          isProcessing ||
                          fields.length === 0 ||
                          !form.formState.isValid
                        }
                      >
                        {isProcessing ? (
                          <Trans>Processing...</Trans>
                        ) : (
                          <Trans>Auto add fields</Trans>
                        )}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {(fields.length === 0 || !form.formState.isValid) && (
                    <TooltipContent>
                      <Trans>Please add at least one valid recipient to auto-detect fields</Trans>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </DialogFooter>
      </form>
    </Form>
  );
};
