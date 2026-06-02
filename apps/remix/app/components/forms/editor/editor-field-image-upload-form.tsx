import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { EditorGenericLabelField, EditorGenericTextAlignField } from './editor-field-generic-field-forms';

const ZImageUploadFormSchema = z.object({
  label: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
});

type TImageUploadFormSchema = z.infer<typeof ZImageUploadFormSchema>;

type EditorFieldImageUploadFormProps = {
  label: string | null;
  textAlign: string | undefined;
  onLabelChange: (value: string) => void;
  onTextAlignChange: (value: string) => void;
};

export const EditorFieldImageUploadForm = ({
  label,
  textAlign,
  onLabelChange,
  onTextAlignChange,
}: EditorFieldImageUploadFormProps) => {
  const form = useForm<TImageUploadFormSchema>({
    resolver: zodResolver(ZImageUploadFormSchema),
    mode: 'onChange',
    defaultValues: {
      label: label || '',
      textAlign: textAlign as 'left' | 'center' | 'right' | undefined,
    },
  });

  const { control } = form;

  useEffect(() => {
    const subscription = form.watch((value) => {
      onLabelChange(value.label || '');
      if (value.textAlign) {
        onTextAlignChange(value.textAlign);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onLabelChange, onTextAlignChange]);

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorGenericLabelField formControl={control} />
          <EditorGenericTextAlignField formControl={control} />
        </fieldset>
      </form>
    </Form>
  );
};
