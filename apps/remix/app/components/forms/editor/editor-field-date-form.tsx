import {
  type TDateFieldMeta as DateFieldMeta,
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DATE_META_DEFAULT_VALUES,
  FIELD_DEFAULT_GENERIC_ALIGN,
  ZDateFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { EditorGenericFontSizeField, EditorGenericTextAlignField } from './editor-field-generic-field-forms';

const ZDateFieldFormSchema = ZDateFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  overflow: true,
});

type TDateFieldFormSchema = z.infer<typeof ZDateFieldFormSchema>;

type EditorFieldDateFormProps = {
  value: z.input<typeof ZDateFieldMeta> | undefined;
  onValueChange: (value: DateFieldMeta) => void;
};

export const EditorFieldDateForm = ({
  value = {
    type: 'date',
  },
  onValueChange,
}: EditorFieldDateFormProps) => {
  const form = useForm<TDateFieldFormSchema>({
    resolver: zodResolver(ZDateFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      overflow: value.overflow || FIELD_DATE_META_DEFAULT_VALUES.overflow,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZDateFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'date',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <EditorGenericTextAlignField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
