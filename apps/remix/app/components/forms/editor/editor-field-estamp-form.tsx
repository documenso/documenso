import { useEffect } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';

import { type TEstampFieldMeta, ZEstampFieldMeta } from '@documenso/lib/types/field-meta';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';

const ZEstampFieldMetaSchema = ZEstampFieldMeta.pick({
  fromPlaceholder: true,
  readOnly: true,
}).refine(
  (data) => {
    // A read-only field must have text
    return !data.readOnly;
  },
  {
    message: 'A read-only field must have text',
    path: ['text'],
  },
);

type TTextFieldFormSchema = z.infer<typeof ZEstampFieldMetaSchema>;

type EditorFieldEstampFormProps = {
  value: TEstampFieldMeta | undefined;
  onValueChange: (value: TEstampFieldMeta) => void;
};

export const EditorFieldEstampForm = ({
  value = {
    type: 'estamp',
    fromPlaceholder: '0',
  },
  onValueChange,
}: EditorFieldEstampFormProps) => {
  const { t } = useLingui();

  const form = useForm<TTextFieldFormSchema>({
    resolver: zodResolver(ZEstampFieldMetaSchema),
    mode: 'onChange',
    defaultValues: {
      fromPlaceholder: value.fromPlaceholder || '0',
      readOnly: value.readOnly || false,
    },
  });

  const { control } = form;

  const formValues = useWatch({
    control,
  });

  // Dupecode/Inefficient: Done because native isValid won't work for our usecase.
  useEffect(() => {
    const validatedFormValues = ZEstampFieldMetaSchema.safeParse(formValues);

    if (formValues.readOnly && !formValues.fromPlaceholder) {
      void form.trigger('fromPlaceholder');
    }

    if (validatedFormValues.success) {
      onValueChange({
        type: 'estamp',
        ...validatedFormValues.data,
      });
    }
  }, [formValues]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <FormField
            control={form.control}
            name="fromPlaceholder"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>From Placeholder</Trans>
                </FormLabel>
                <FormControl>
                  <Input data-testid="field-form-label" placeholder={t`Field From`} {...field} />
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
