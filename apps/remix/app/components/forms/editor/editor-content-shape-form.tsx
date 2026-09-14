import {
  CONTENT_RECTANGLE_META_DEFAULT_VALUES,
  ContentShapeType,
  DEFAULT_CONTENT_STROKE_COLOR,
  type TContentShapeMeta,
  ZContentShapeMeta,
} from '@documenso/lib/types/envelope-content-meta';
import { Form, FormControl, FormItem, FormLabel } from '@documenso/ui/primitives/form/form';
import { Switch } from '@documenso/ui/primitives/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { useForm, useWatch } from 'react-hook-form';
import { match } from 'ts-pattern';
import type { z } from 'zod';

import {
  EditorContentColorField,
  EditorContentOpacityField,
  EditorContentStrokeStyleField,
  EditorContentStrokeWidthField,
  useContentFormBinding,
} from './editor-content-generic-field-forms';

/**
 * The fill color used when the fill is first enabled.
 */
export const DEFAULT_ENABLED_FILL_COLOR = '#e5e7eb';

/**
 * Only the presentational settings are editable here. Geometry (page, position
 * and size) is managed on the canvas.
 */
const ZContentShapeFormSchema = ZContentShapeMeta.pick({
  strokeWidth: true,
  strokeColor: true,
  strokeStyle: true,
  fillColor: true,
  fillOpacity: true,
});

type TContentShapeFormSchema = z.infer<typeof ZContentShapeFormSchema>;

type EditorContentShapeFormProps = {
  value: TContentShapeMeta;
  onValueChange: (value: TContentShapeMeta) => void;
};

/**
 * Settings form for shape contents, with the fields for the content's shape.
 */
export const EditorContentShapeForm = ({ value, onValueChange }: EditorContentShapeFormProps) => {
  const form = useForm<TContentShapeFormSchema>({
    resolver: zodResolver(ZContentShapeFormSchema),
    mode: 'onChange',
    defaultValues: {
      strokeWidth: value.strokeWidth ?? CONTENT_RECTANGLE_META_DEFAULT_VALUES.strokeWidth,
      strokeColor: value.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
      strokeStyle: value.strokeStyle ?? CONTENT_RECTANGLE_META_DEFAULT_VALUES.strokeStyle,
      fillColor: value.fillColor,
      fillOpacity: value.fillOpacity ?? CONTENT_RECTANGLE_META_DEFAULT_VALUES.fillOpacity,
    },
  });

  const { control } = form;

  useContentFormBinding({
    form,
    schema: ZContentShapeFormSchema,
    value,
    onValueChange,
    syncedValues: {
      strokeWidth: value.strokeWidth ?? CONTENT_RECTANGLE_META_DEFAULT_VALUES.strokeWidth,
      strokeColor: value.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR,
      fillColor: value.fillColor,
    },
  });

  const fillColor = useWatch({ control, name: 'fillColor' });

  const hasFill = Boolean(fillColor);

  const onFillToggle = (enabled: boolean) => {
    // The fill is represented purely by the presence of a fill color, so
    // toggling sets or clears it.
    form.setValue('fillColor', enabled ? DEFAULT_ENABLED_FILL_COLOR : undefined, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <Form {...form}>
      <form>
        {match(value.shape)
          .with(ContentShapeType.RECTANGLE, () => (
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
      </form>
    </Form>
  );
};
