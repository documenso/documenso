import { DEFAULT_CONTENT_HIGHLIGHT_COLOR } from '@documenso/lib/types/envelope-content-meta';
import {
  type TContentHighlightFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import { EditorContentColorField, EditorContentOpacityField } from './editor-content-generic-field-forms';

/**
 * Settings form for highlight contents, bound to the selected content's
 * settings form. Only the presentational settings are editable here;
 * geometry (page, position and size) is managed on the canvas.
 */
export const EditorContentHighlightForm = () => {
  const { form, isReady } = useContentSettingsForm<TContentHighlightFormSchema>();

  // Mount the inputs only once the form holds this content's values.
  if (!isReady) {
    return null;
  }

  return (
    <div>
      <fieldset className="flex flex-col gap-2">
        <EditorContentColorField formControl={form.control} defaultColor={DEFAULT_CONTENT_HIGHLIGHT_COLOR} />

        <EditorContentOpacityField formControl={form.control} name="fillOpacity" />
      </fieldset>
    </div>
  );
};
