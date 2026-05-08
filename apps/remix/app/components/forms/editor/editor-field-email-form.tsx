import {
  DEFAULT_FIELD_FONT_SIZE,
  type TEmailFieldMeta as EmailFieldMeta,
  FIELD_DEFAULT_GENERIC_ALIGN,
  FIELD_EMAIL_META_DEFAULT_VALUES,
  ZEmailFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { EditorGenericFontSizeField, EditorGenericTextAlignField } from './editor-field-generic-field-forms';

const ZEmailFieldFormSchema = ZEmailFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  overflow: true,
});

type TEmailFieldFormSchema = z.infer<typeof ZEmailFieldFormSchema>;

type EditorFieldEmailFormProps = {
  value: z.input<typeof ZEmailFieldMeta> | undefined;
  onValueChange: (value: EmailFieldMeta) => void;
};

export const EditorFieldEmailForm = ({
  value = {
    type: 'email',
  },
  onValueChange,
}: EditorFieldEmailFormProps) => {
  const form = useForm<TEmailFieldFormSchema>({
    resolver: zodResolver(ZEmailFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      overflow: value.overflow || FIELD_EMAIL_META_DEFAULT_VALUES.overflow,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZEmailFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'email',
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
