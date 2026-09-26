import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Textarea } from '@documenso/ui/primitives/textarea';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  type TContentTextFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import { EditorContentColorField } from './editor-content-generic-field-forms';
import {
  EditorGenericFontSizeField,
  EditorGenericLetterSpacingField,
  EditorGenericLineHeightField,
  EditorGenericTextAlignField,
  EditorGenericVerticalAlignField,
} from './editor-field-generic-field-forms';

/**
 * Settings form for text contents, bound to the selected content's settings
 * form. Only the presentational settings are editable here; geometry (page,
 * position and size) is managed on the canvas.
 */
export const EditorContentTextForm = () => {
  const { t } = useLingui();

  const { form, isReady } = useContentSettingsForm<TContentTextFormSchema>();

  // Mount the inputs only once the form holds this content's values.
  if (!isReady) {
    return null;
  }

  return (
    <div>
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
    </div>
  );
};
