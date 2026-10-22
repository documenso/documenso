import {
  DEFAULT_FIELD_FONT_SIZE,
  DEFAULT_HANDWRITING_INITIALS_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  type TInitialsFieldMeta as InitialsFieldMeta,
  resolveFieldFontSize,
  ZInitialsFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { EditorGenericFontSizeField, EditorGenericTextAlignField } from './editor-field-generic-field-forms';

const ZInitialsFieldFormSchema = ZInitialsFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  fontFamily: true,
});

type TInitialsFieldFormSchema = z.infer<typeof ZInitialsFieldFormSchema>;

type EditorFieldInitialsFormProps = {
  value: InitialsFieldMeta | undefined;
  onValueChange: (value: InitialsFieldMeta) => void;
};

export const EditorFieldInitialsForm = ({
  value = {
    type: 'initials',
  },
  onValueChange,
}: EditorFieldInitialsFormProps) => {
  const { t } = useLingui();

  const form = useForm<TInitialsFieldFormSchema>({
    resolver: zodResolver(ZInitialsFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: resolveFieldFontSize(value),
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      fontFamily: value.fontFamily ?? 'sans-serif',
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZInitialsFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'initials',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <FormField
            control={form.control}
            name="fontFamily"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Font Style</Trans>
                </FormLabel>
                <FormControl>
                  <Select
                    value={field.value}
                    onValueChange={(fontFamily) => {
                      const fontSize = form.getValues('fontSize');

                      if (fontFamily === 'handwriting' && fontSize === DEFAULT_FIELD_FONT_SIZE) {
                        form.setValue('fontSize', DEFAULT_HANDWRITING_INITIALS_FONT_SIZE);
                      }

                      if (fontFamily === 'sans-serif' && fontSize === DEFAULT_HANDWRITING_INITIALS_FONT_SIZE) {
                        form.setValue('fontSize', DEFAULT_FIELD_FONT_SIZE);
                      }

                      field.onChange(fontFamily);
                    }}
                  >
                    <SelectTrigger data-testid="field-form-fontFamily">
                      <SelectValue placeholder={t`Select font style`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sans-serif">
                        <Trans>Sans-Serif</Trans>
                      </SelectItem>
                      <SelectItem value="handwriting">
                        <Trans>Handwriting</Trans>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <EditorGenericTextAlignField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
