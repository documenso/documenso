import {
  CONTENT_TEXT_META_DEFAULT_VALUES,
  DEFAULT_CONTENT_TEXT,
  DEFAULT_CONTENT_TEXT_COLOR,
  type TContentTextMeta,
  ZContentTextMeta,
} from '@documenso/lib/types/envelope-content-meta';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans, useLingui } from '@lingui/react/macro';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { EditorContentColorField, useContentFormBinding } from './editor-content-generic-field-forms';
import {
  EditorGenericFontSizeField,
  EditorGenericLetterSpacingField,
  EditorGenericLineHeightField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from './editor-field-generic-field-forms';

/**
 * Only the presentational settings are editable here. Geometry (page, position
 * and size) is managed on the canvas.
 */
const ZContentTextFormSchema = ZContentTextMeta.pick({
  fontSize: true,
  textAlign: true,
  verticalAlign: true,
  lineHeight: true,
  letterSpacing: true,
  color: true,
}).extend({
  // Text contents always render their text, so it cannot be empty.
  text: z.string().min(1),
});

type TContentTextFormSchema = z.infer<typeof ZContentTextFormSchema>;

type EditorContentTextFormProps = {
  value: TContentTextMeta;
  onValueChange: (value: TContentTextMeta) => void;
};

export const EditorContentTextForm = ({ value, onValueChange }: EditorContentTextFormProps) => {
  const { t } = useLingui();

  const form = useForm<TContentTextFormSchema>({
    resolver: zodResolver(ZContentTextFormSchema),
    mode: 'onChange',
    defaultValues: {
      text: value.text || DEFAULT_CONTENT_TEXT,
      fontSize: value.fontSize ?? CONTENT_TEXT_META_DEFAULT_VALUES.fontSize,
      textAlign: value.textAlign ?? CONTENT_TEXT_META_DEFAULT_VALUES.textAlign,
      verticalAlign: value.verticalAlign ?? CONTENT_TEXT_META_DEFAULT_VALUES.verticalAlign,
      lineHeight: value.lineHeight ?? CONTENT_TEXT_META_DEFAULT_VALUES.lineHeight,
      letterSpacing: value.letterSpacing ?? CONTENT_TEXT_META_DEFAULT_VALUES.letterSpacing,
      color: value.color ?? DEFAULT_CONTENT_TEXT_COLOR,
    },
  });

  useContentFormBinding({
    form,
    schema: ZContentTextFormSchema,
    value,
    onValueChange,
    syncedValues: {
      color: value.color ?? DEFAULT_CONTENT_TEXT_COLOR,
      fontSize: value.fontSize ?? CONTENT_TEXT_META_DEFAULT_VALUES.fontSize,
      textAlign: value.textAlign ?? CONTENT_TEXT_META_DEFAULT_VALUES.textAlign,
      verticalAlign: value.verticalAlign ?? CONTENT_TEXT_META_DEFAULT_VALUES.verticalAlign,
    },
  });

  return (
    <Form {...form}>
      <form>
        <fieldset className="flex flex-col gap-2">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  <Trans>Text</Trans>
                </FormLabel>
                <FormControl>
                  <Textarea
                    data-testid="content-form-text"
                    className="h-auto"
                    placeholder={t`Add text to the document`}
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericFontSizeField className="w-full" formControl={form.control} />

            <EditorContentColorField className="w-full" formControl={form.control} />
          </div>

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericTextAlignField className="w-full" formControl={form.control} />

            <EditorGenericVerticalAlignField className="w-full" formControl={form.control} />
          </div>

          <div className="flex w-full flex-row gap-x-4">
            <EditorGenericLineHeightField className="w-full" formControl={form.control} />

            <EditorGenericLetterSpacingField className="w-full" formControl={form.control} />
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
