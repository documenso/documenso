import { DEFAULT_CONTENT_HIGHLIGHT_COLOR } from '@documenso/lib/types/envelope-content-meta';
import {
  type TContentHighlightFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import { EditorContentColorField, EditorContentOpacityField } from './editor-content-generic-field-forms';

export const EditorContentHighlightForm = () => {
  const { form, isReady } = useContentSettingsForm<TContentHighlightFormSchema>();

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
