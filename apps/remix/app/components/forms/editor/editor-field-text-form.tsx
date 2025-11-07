import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  type TTextFieldMeta as TextFieldMeta,
} from '@documenso/lib/types/field-meta';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Textarea } from '@documenso/ui/primitives/textarea';

import {
  EditorGenericFontSizeField,
  EditorGenericReadOnlyField,
  EditorGenericRequiredField,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZTextFieldFormSchema = z
  .object({
    label: z.string().optional(),
    placeholder: z.string().optional(),
    text: z.string().optional(),
    characterLimit: z.coerce.number().min(0).optional(),
    fontSize: z.coerce.number().min(8).max(96).optional(),
    textAlign: z.enum(['left', 'center', 'right']).optional(),
    required: z.boolean().optional(),
    readOnly: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // A read-only field must have text
      return !data.readOnly || (data.text && data.text.length > 0);
    },
    {
      message: 'A read-only field must have text',
      path: ['text'],
    },
  );

type TTextFieldFormSchema = z.infer<typeof ZTextFieldFormSchema>;

type EditorFieldTextFormProps = {
  value: TextFieldMeta | undefined;
  onValueChange: (value: TextFieldMeta) => void;
};

export const EditorFieldTextForm = ({
  value = {
    type: 'text',
  },
  onValueChange,
}: EditorFieldTextFormProps) => {
  const { t } = useLingui();

  const form = useForm<TTextFieldFormSchema>({
    resolver: zodResolver(ZTextFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: value.label || '',
      placeholder: value.placeholder || '',
      text: value.text || '',
      characterLimit: value.characterLimit || 0,
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign || 'left',
      required: value.required || false,
      readOnly: value.readOnly || false,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZTextFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'text',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericFontSizeField className="w-full" formControl={form.control} />

            <EditorGenericTextAlignField className="w-full" formControl={form.control} />
          </div>

          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Label</Trans>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t`Field label`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="placeholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Placeholder</Trans>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t`Field placeholder`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Add text</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    className="h-auto"
                    placeholder={t`Add text to the field`}
                    {...field}
                    onChange={(e) => {
                      const values = form.getValues();
                      const characterLimit = values.characterLimit || 0;
                      let textValue = e.target.value;

                      if (characterLimit > 0 && textValue.length > characterLimit) {
                        textValue = textValue.slice(0, characterLimit);
                      }

                      e.target.value = textValue;
                      field.onChange(e);
                    }}
                    rows={1}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="characterLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Character Limit</Trans>
                </FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    className="bg-background"
                    placeholder={t`Field character limit`}
                    {...field}
                    onChange={(e) => {
                      field.onChange(e);

                      const values = form.getValues();
                      const characterLimit = parseInt(e.target.value, 10) || 0;

                      const textValue = values.text || '';

                      if (characterLimit > 0 && textValue.length > characterLimit) {
                        form.setValue('text', textValue.slice(0, characterLimit));
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="mt-1">
            <EditorGenericRequiredField formControl={form.control} />
          </div>

          <EditorGenericReadOnlyField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
