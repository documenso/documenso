import {
  DEFAULT_CONTENT_HIGHLIGHT_COLOR,
  DEFAULT_CONTENT_HIGHLIGHT_OPACITY,
  type TContentHighlightMeta,
  ZContentHighlightMeta,
} from '@documenso/lib/types/envelope-content-meta';
import { Form } from '@documenso/ui/primitives/form/form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import {
  EditorContentColorField,
  EditorContentOpacityField,
  useContentFormBinding,
} from './editor-content-generic-field-forms';

/**
 * Only the presentational settings are editable here. Geometry (page, position
 * and size) is managed on the canvas.
 */
const ZContentHighlightFormSchema = ZContentHighlightMeta.pick({
  color: true,
  opacity: true,
});

type TContentHighlightFormSchema = z.infer<typeof ZContentHighlightFormSchema>;

type EditorContentHighlightFormProps = {
  value: TContentHighlightMeta;
  onValueChange: (value: TContentHighlightMeta) => void;
};

export const EditorContentHighlightForm = ({ value, onValueChange }: EditorContentHighlightFormProps) => {
  const form = useForm<TContentHighlightFormSchema>({
    resolver: zodResolver(ZContentHighlightFormSchema),
    mode: 'onChange',
    defaultValues: {
      color: value.color ?? DEFAULT_CONTENT_HIGHLIGHT_COLOR,
      opacity: value.opacity ?? DEFAULT_CONTENT_HIGHLIGHT_OPACITY,
    },
  });

  useContentFormBinding({
    form,
    schema: ZContentHighlightFormSchema,
    value,
    onValueChange,
    syncedValues: { color: value.color ?? DEFAULT_CONTENT_HIGHLIGHT_COLOR },
  });

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <EditorContentColorField formControl={form.control} defaultColor={DEFAULT_CONTENT_HIGHLIGHT_COLOR} />

          <EditorContentOpacityField formControl={form.control} />
        </fieldset>
      </form>
    </Form>
  );
};
