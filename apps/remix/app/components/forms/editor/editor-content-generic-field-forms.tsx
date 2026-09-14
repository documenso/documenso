import { useLatestRef } from '@documenso/lib/client-only/hooks/use-latest-ref';
import {
  CONTENT_MAX_STROKE_WIDTH,
  CONTENT_MIN_STROKE_WIDTH,
  DEFAULT_CONTENT_TEXT_COLOR,
} from '@documenso/lib/types/envelope-content-meta';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@documenso/ui/primitives/select';
import { Slider } from '@documenso/ui/primitives/slider';
import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';
import type { Control, FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import type { ZodType } from 'zod';

// Can't seem to get the non-any type to work with correct types.
// Eg Control<{ fontSize?: number } doesn't seem to work when there are required items.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormControlType = Control<any>;

type UseContentFormBindingOptions<TForm extends FieldValues, TMeta> = {
  form: UseFormReturn<TForm>;

  /**
   * Validates the whole form. Edits are only written while the form is valid.
   */
  schema: ZodType<Partial<TForm>>;

  /**
   * The content meta the form edits.
   */
  value: TMeta;
  onValueChange: (value: TMeta) => void;

  /**
   * Fields which can also be changed outside the form (e.g. colors from the
   * canvas action bar) and must follow the meta while the form stays mounted.
   */
  syncedValues?: { [K in Path<TForm>]?: PathValue<TForm, K> };
};

/**
 * Bind a content settings form to its content meta.
 *
 * - On mount the meta is normalized with the form's defaults, as before.
 * - A user edit writes only the edited field, merged onto the latest meta. The
 *   form's other fields are never spread back, since they can be a render
 *   behind the meta when it is also edited elsewhere (e.g. while dragging a
 *   color picker on the canvas action bar), which would otherwise echo stale
 *   values into the meta and ping-pong between two values forever.
 * - Synced fields follow the meta; those updates are applied with the
 *   subscription muted so they are not mistaken for user edits.
 */
export const useContentFormBinding = <TForm extends FieldValues, TMeta extends object>({
  form,
  schema,
  value,
  onValueChange,
  syncedValues = {},
}: UseContentFormBindingOptions<TForm, TMeta>) => {
  const valueRef = useLatestRef(value);
  const onValueChangeRef = useLatestRef(onValueChange);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const parsed = schema.safeParse(form.getValues());

    if (parsed.success) {
      onValueChangeRef.current({ ...valueRef.current, ...parsed.data });
    }
  }, []);

  useEffect(() => {
    // `watch` callbacks fire synchronously inside the change that caused them,
    // which is what makes muting our own sync reliable.
    const subscription = form.watch((formValues, { name }) => {
      if (isSyncingRef.current || !name) {
        return;
      }

      const parsed = schema.safeParse(formValues);

      if (!parsed.success) {
        return;
      }

      onValueChangeRef.current({ ...valueRef.current, [name]: parsed.data[name] });
    });

    return () => subscription.unsubscribe();
  }, [form, schema]);

  useEffect(() => {
    isSyncingRef.current = true;

    try {
      for (const key of Object.keys(syncedValues) as Path<TForm>[]) {
        const syncedValue = syncedValues[key];

        if (form.getValues(key) !== syncedValue) {
          form.setValue(key, syncedValue as PathValue<TForm, Path<TForm>>, {
            shouldDirty: false,
            shouldValidate: false,
          });
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [...Object.values(syncedValues)]);
};

type GenericContentFieldProps = {
  formControl: FormControlType;
  className?: string;
};

export const EditorContentColorField = ({
  formControl,
  className,
  name = 'color',
  label,
  defaultColor = DEFAULT_CONTENT_TEXT_COLOR,
}: GenericContentFieldProps & {
  name?: string;
  label?: React.ReactNode;
  defaultColor?: string;
}) => {
  return (
    <FormField
      control={formControl}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>{label ?? <Trans>Color</Trans>}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-x-3">
              <ColorPicker
                data-testid={`content-form-${name}`}
                value={field.value ?? ''}
                defaultValue={defaultColor}
                onChange={(color) => field.onChange(color)}
              />

              <span className="font-mono text-muted-foreground text-xs uppercase">{field.value ?? defaultColor}</span>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const EditorContentStrokeWidthField = ({ formControl, className }: GenericContentFieldProps) => {
  const { t } = useLingui();

  return (
    <FormField
      control={formControl}
      name="strokeWidth"
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            <Trans>Thickness</Trans>
          </FormLabel>
          <FormControl>
            <Input
              data-testid="content-form-strokeWidth"
              type="number"
              min={CONTENT_MIN_STROKE_WIDTH}
              max={CONTENT_MAX_STROKE_WIDTH}
              step={0.5}
              className="bg-background"
              placeholder={t`Thickness`}
              {...field}
              onChange={(e) => {
                field.onChange(Number(e.target.value));
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const EditorContentStrokeStyleField = ({ formControl, className }: GenericContentFieldProps) => {
  const { t } = useLingui();

  return (
    <FormField
      control={formControl}
      name="strokeStyle"
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            <Trans>Style</Trans>
          </FormLabel>
          <FormControl>
            <Select {...field} onValueChange={field.onChange}>
              <SelectTrigger data-testid="content-form-strokeStyle">
                <SelectValue placeholder={t`Select style`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">
                  <Trans>Solid</Trans>
                </SelectItem>
                <SelectItem value="dashed">
                  <Trans>Dashed</Trans>
                </SelectItem>
                <SelectItem value="dotted">
                  <Trans>Dotted</Trans>
                </SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

/**
 * An opacity slider. The form value is a fraction (0-1) while the slider and
 * label display a percentage.
 */
export const EditorContentOpacityField = ({
  formControl,
  className,
  name = 'opacity',
  label,
}: GenericContentFieldProps & {
  name?: string;
  label?: React.ReactNode;
}) => {
  return (
    <FormField
      control={formControl}
      name={name}
      render={({ field }) => {
        const percentage = Math.round((field.value ?? 1) * 100);

        return (
          <FormItem className={className}>
            <FormLabel className="flex items-center justify-between">
              {label ?? <Trans>Opacity</Trans>}
              <span className="font-mono text-muted-foreground tabular-nums">{percentage}%</span>
            </FormLabel>
            <FormControl>
              <Slider
                data-testid={`content-form-${name}`}
                className="py-2"
                min={0}
                max={100}
                step={1}
                value={[percentage]}
                onValueChange={([value]) => field.onChange(value / 100)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
};
