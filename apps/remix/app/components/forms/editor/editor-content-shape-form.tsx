import {
  DEFAULT_CONTENT_STROKE_COLOR,
  EnvelopeContentShapeType,
  EnvelopeContentType,
} from '@documenso/lib/types/envelope-content-meta';
import { FormControl, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Switch } from '@documenso/ui/primitives/switch';
import { Trans } from '@lingui/react/macro';
import { useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';
import {
  type TContentShapeFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import {
  EditorContentColorField,
  EditorContentOpacityField,
  EditorContentStrokeStyleField,
  EditorContentStrokeWidthField,
} from './editor-content-generic-field-forms';

/**
 * The fill color used when the fill is first enabled.
 *
 * Todo: Contents
 */
export const DEFAULT_ENABLED_FILL_COLOR = '#e5e7eb';

/**
 * Settings form for shape contents, bound to the selected content's settings
 * form, with the fields for the content's shape. Only the presentational
 * settings are editable here; geometry (page, position and size) is managed
 * on the canvas.
 */
export const EditorContentShapeForm = () => {
  const { form, content, isReady } = useContentSettingsForm<TContentShapeFormSchema>();

  const fillColor = useWatch({ control: form.control, name: 'fillColor' });

  const hasFill = Boolean(fillColor);

  const onFillToggle = (enabled: boolean) => {
    // The fill is represented purely by the fill color, so toggling sets it
    // or clears it to `null`.
    form.setValue('fillColor', enabled ? DEFAULT_ENABLED_FILL_COLOR : null, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  // Mount the inputs only once the form holds this content's values.
  if (!isReady || content?.contentMeta.type !== EnvelopeContentType.SHAPE) {
    return null;
  }

  return (
    <div>
      {match(content.contentMeta.shape)
        .with(EnvelopeContentShapeType.RECTANGLE, () => (
          <fieldset className="flex flex-col gap-2">
            <div className="flex w-full flex-row gap-x-4">
              <EditorContentStrokeWidthField className="w-full" formControl={form.control} />

              <EditorContentStrokeStyleField className="w-full" formControl={form.control} />
            </div>

            <EditorContentColorField
              formControl={form.control}
              name="strokeColor"
              label={<Trans>Border Color</Trans>}
              defaultColor={DEFAULT_CONTENT_STROKE_COLOR}
            />

            <FormItem className="mt-1 flex flex-row items-center justify-between">
              <FormLabel>
                <Trans>Fill</Trans>
              </FormLabel>
              <FormControl>
                <Switch data-testid="content-form-fill" checked={hasFill} onCheckedChange={onFillToggle} />
              </FormControl>
            </FormItem>

            {hasFill && (
              <>
                <EditorContentColorField
                  formControl={form.control}
                  name="fillColor"
                  label={<Trans>Fill Color</Trans>}
                  defaultColor={DEFAULT_ENABLED_FILL_COLOR}
                />

                <EditorContentOpacityField
                  formControl={form.control}
                  name="fillOpacity"
                  label={<Trans>Fill Opacity</Trans>}
                />
              </>
            )}
          </fieldset>
        ))
        .exhaustive()}
    </div>
  );
};
