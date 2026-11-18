import { DEFAULT_CONTENT_STROKE_COLOR } from '@documenso/lib/types/envelope-content-meta';
import {
  type TContentLineFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import {
  EditorContentColorField,
  EditorContentStrokeStyleField,
  EditorContentStrokeWidthField,
} from './editor-content-generic-field-forms';

export const EditorContentLineForm = () => {
  const { form, isReady } = useContentSettingsForm<TContentLineFormSchema>();

  if (!isReady) {
    return null;
  }

  return (
    <div>
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
    </div>
  );
};
