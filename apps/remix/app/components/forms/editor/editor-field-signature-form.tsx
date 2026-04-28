import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { DEFAULT_SIGNATURE_TEXT_FONT_SIZE } from '@documenso/lib/constants/pdf';
import {
  FIELD_SIGNATURE_META_DEFAULT_VALUES,
  type TSignatureFieldMeta,
  ZSignatureFieldMeta,
} from '@documenso/lib/types/field-meta';
import { Form } from '@documenso/ui/primitives/form/form';

import { EditorGenericFontSizeField } from './editor-field-generic-field-forms';

const ZSignatureFieldFormSchema = ZSignatureFieldMeta.pick({
  fontSize: true,
  overflow: true,
});

type TSignatureFieldFormSchema = z.infer<typeof ZSignatureFieldFormSchema>;

type EditorFieldSignatureFormProps = {
  value: z.input<typeof ZSignatureFieldMeta> | undefined;
  onValueChange: (value: TSignatureFieldMeta) => void;
};

export const EditorFieldSignatureForm = ({
  value = {
    type: 'signature',
  },
  onValueChange,
}: EditorFieldSignatureFormProps) => {
  const form = useForm<TSignatureFieldFormSchema>({
    resolver: zodResolver(ZSignatureFieldFormSchema),
    mode: 'onChange',
    defaultValues: {
      overflow: value.overflow || FIELD_SIGNATURE_META_DEFAULT_VALUES.overflow,
      fontSize: value.fontSize || DEFAULT_SIGNATURE_TEXT_FONT_SIZE,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZSignatureFieldFormSchema.safeParse(formValues);

    if (validatedFormValues.success) {
      onValueChange({
        type: 'signature',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <div>
            <EditorGenericFontSizeField formControl={form.control} />
            <p className="mt-0.5 text-xs text-muted-foreground">
              <Trans>The typed signature font size</Trans>
            </p>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
