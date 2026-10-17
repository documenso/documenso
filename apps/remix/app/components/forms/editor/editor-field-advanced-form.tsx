import { generateFieldGroupId } from '@documenso/lib/utils/field-groups';
import {
  FieldGroupAutoCompleteInput,
  type FieldGroupAutoCompleteOption,
} from '@documenso/ui/components/field/field-group-autocomplete-input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@documenso/ui/primitives/collapsible';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { msg } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { ChevronDownIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

export type EditorFieldAdvancedFormValue = {
  groupId: string | null;
  externalId: string | null;
};

type EditorFieldAdvancedFormProps = {
  value: EditorFieldAdvancedFormValue;
  onValueChange: (value: EditorFieldAdvancedFormValue) => void;
  /**
   * Whether the field type supports groups. Hides the group input when false.
   */
  isGroupable: boolean;
  /**
   * Existing groups the field is allowed to join.
   */
  groupOptions?: FieldGroupAutoCompleteOption[];
  /**
   * Group IDs the field cannot join, because they are used by fields of a different type
   * or recipient.
   */
  conflictingGroupIds?: string[];
  /**
   * Every group ID currently in use, so generated IDs never collide.
   */
  allGroupIds?: string[];
};

export const EditorFieldAdvancedForm = ({
  value,
  onValueChange,
  isGroupable,
  groupOptions = [],
  conflictingGroupIds = [],
  allGroupIds = [],
}: EditorFieldAdvancedFormProps) => {
  const { t } = useLingui();

  // Open by default if a value is set so the user can see it.
  const [isOpen, setIsOpen] = useState(Boolean(value.externalId || value.groupId));

  const ZEditorFieldAdvancedFormSchema = useMemo(
    () =>
      z.object({
        groupId: z
          .string()
          .max(255, { message: msg`Group ID must be 255 characters or less`.id })
          .refine((groupId) => !conflictingGroupIds.includes(groupId), {
            message: msg`This group ID is used by fields of a different type or recipient`.id,
          }),
        externalId: z.string().max(255),
      }),
    [conflictingGroupIds],
  );

  type TEditorFieldAdvancedFormSchema = z.infer<typeof ZEditorFieldAdvancedFormSchema>;

  const form = useForm<TEditorFieldAdvancedFormSchema>({
    resolver: zodResolver(ZEditorFieldAdvancedFormSchema),
    mode: 'onChange',
    defaultValues: {
      groupId: value.groupId ?? '',
      externalId: value.externalId ?? '',
    },
  });

  const formValues = useWatch({
    control: form.control,
  });

  // Reflect group changes made outside the form, such as the field leaving its group
  // when its type or recipient changes.
  useEffect(() => {
    if (form.getValues('groupId') !== (value.groupId ?? '')) {
      form.setValue('groupId', value.groupId ?? '');
    }
  }, [value.groupId]);

  useEffect(() => {
    const validatedFormValues = ZEditorFieldAdvancedFormSchema.safeParse(formValues);

    if (!validatedFormValues.success) {
      return;
    }

    onValueChange({
      groupId: validatedFormValues.data.groupId.trim() || null,
      externalId: validatedFormValues.data.externalId.trim() || null,
    });
  }, [formValues]);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger
        data-testid="field-form-advanced-trigger"
        className="flex w-full items-center justify-between py-1 text-left font-semibold text-foreground text-sm"
      >
        <Trans>Advanced</Trans>

        <ChevronDownIcon
          className="h-4 w-4 text-muted-foreground transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Form {...form}>
          <form>
            <fieldset className="mt-2 flex flex-col gap-2">
              {isGroupable && (
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <Trans>Group ID</Trans>
                      </FormLabel>
                      <FormControl>
                        <FieldGroupAutoCompleteInput
                          data-testid="field-form-groupId"
                          value={field.value}
                          placeholder={t`Optional group ID`}
                          maxLength={255}
                          options={groupOptions}
                          onGroupIdChange={(groupId) => {
                            field.onChange(groupId);
                            void form.trigger('groupId');
                          }}
                          onCreateGroup={() => generateFieldGroupId(allGroupIds)}
                        />
                      </FormControl>
                      <FormDescription>
                        <Trans>
                          Fields with the same group ID act as one field. They are inserted together and share
                          validation rules.
                        </Trans>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="externalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <Trans>External ID</Trans>
                    </FormLabel>
                    <FormControl>
                      <Input
                        data-testid="field-form-externalId"
                        placeholder={t`Optional external ID`}
                        maxLength={255}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      <Trans>An identifier for your own systems. Not used by Documenso.</Trans>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </fieldset>
          </form>
        </Form>
      </CollapsibleContent>
    </Collapsible>
  );
};
