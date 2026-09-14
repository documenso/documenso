import {
  CONTENT_LINE_META_DEFAULT_VALUES,
  DEFAULT_CONTENT_STROKE_COLOR,
  type TContentLineMeta,
  ZContentLineMeta,
} from '@documenso/lib/types/envelope-content-meta';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorContentColorField,
  EditorContentStrokeStyleField,
  EditorContentStrokeWidthField,
  useContentFormBinding,
} from './editor-content-generic-field-forms';

/**
 * Only the presentational settings are editable here. Geometry (page and
 * endpoints) is managed on the canvas.
 */
const ZContentLineFormSchema = ZContentLineMeta.pick({
  strokeWidth: true,
  strokeColor: true,
  strokeStyle: true,
});

type TContentLineFormSchema = z.infer<typeof ZContentLineFormSchema>;

type EditorContentLineFormProps = {
  value: TContentLineMeta;
  onValueChange: (value: TContentLineMeta) => void;
};

export const EditorContentLineForm = ({ value, onValueChange }: EditorContentLineFormProps) => {
  const form = useForm<TContentLineFormSchema>({
    resolver: zodResolver(ZContentLineFormSchema),
    mode: 'onChange',
    defaultValues: {
      strokeWidth: value.strokeWidth ?? CONTENT_LINE_META_DEFAULT_VALUES.strokeWidth,
      strokeColor: value.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
      strokeStyle: value.strokeStyle ?? CONTENT_LINE_META_DEFAULT_VALUES.strokeStyle,
    },
  });

  useContentFormBinding({
    form,
    schema: ZContentLineFormSchema,
    value,
    onValueChange,
    syncedValues: {
      strokeWidth: value.strokeWidth ?? CONTENT_LINE_META_DEFAULT_VALUES.strokeWidth,
      strokeColor: value.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
    },
  });

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <div className="flex w-full flex-row gap-x-4">
            <EditorContentStrokeWidthField className="w-full" formControl={form.control} />

            <EditorContentStrokeStyleField className="w-full" formControl={form.control} />
          </div>

          <EditorContentColorField
            formControl={form.control}
            name="strokeColor"
            defaultColor={DEFAULT_CONTENT_STROKE_COLOR}
          />
        </fieldset>
      </form>
    </Form>
  );
};
