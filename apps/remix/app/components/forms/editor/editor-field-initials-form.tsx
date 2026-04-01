import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  type TInitialsFieldMeta as InitialsFieldMeta,
  ZInitialsFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form } from '@documenso/ui/primitives/form/form';

import {
  EditorGenericFontSizeField,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZInitialsFieldFormSchema = ZInitialsFieldMeta.pick({
  fontSize: true,
  textAlign: true,
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
  const form = useForm<TInitialsFieldFormSchema>({
    resolver: zodResolver(ZInitialsFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
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

          <EditorGenericTextAlignField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
