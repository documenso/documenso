import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import {
  DEFAULT_FIELD_FONT_SIZE,
  FIELD_DEFAULT_GENERIC_ALIGN,
  type TInitialsFieldMeta as InitialsFieldMeta,
  ZInitialsFieldMeta,
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

import {
  EditorGenericFontSizeField,
  EditorGenericTextAlignField,
} from './editor-field-generic-field-forms';

const ZInitialsFieldFormSchema = ZInitialsFieldMeta.pick({
  fontSize: true,
  textAlign: true,
  fieldId: true,
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
      fontSize: value.fontSize || DEFAULT_FIELD_FONT_SIZE,
      textAlign: value.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN,
      fieldId: value.fieldId || '',
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

          <FormField
            control={form.control}
            name="fieldId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Field ID</Trans>
                </FormLabel>
                <FormControl>
                  <Input placeholder={t`Unique field identifier`} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </fieldset>
      </form>
    </Form>
  );
};
