import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  type TNameFieldMeta as NameFieldMeta,
  ZNameFieldMeta,
} from '@documenso/lib/types/field-meta';
import type { FieldFontOption } from '@documenso/lib/universal/field-fonts';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorGenericFontFamilyField,
  EditorGenericFontSizeField,
  EditorGenericFontStyleFields,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZNameFieldFormSchema = ZNameFieldMeta.pick({
  fontSize: true,
  fontFamily: true,
  fontWeight: true,
  fontStyle: true,
  textAlign: true,
});

type TNameFieldFormSchema = z.infer<typeof ZNameFieldFormSchema>;

type EditorFieldNameFormProps = {
  value: NameFieldMeta | undefined;
  onValueChange: (value: NameFieldMeta) => void;
  fontOptions?: FieldFontOption[];
};

export const EditorFieldNameForm = ({
  value = {
    type: 'name',
  },
  onValueChange,
  fontOptions,
}: EditorFieldNameFormProps) => {
  const form = useForm<TNameFieldFormSchema>({
    resolver: zodResolver(ZNameFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      fontFamily: value.fontFamily || '',
      fontWeight: value.fontWeight || 'normal',
      fontStyle: value.fontStyle || 'normal',
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZNameFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'name',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericFontSizeField formControl={form.control} />

          <EditorGenericFontFamilyField formControl={form.control} fontOptions={fontOptions} />

          <EditorGenericFontStyleFields formControl={form.control} />

          <EditorGenericTextAlignField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
