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
import type { Control } from 'react-hook-form';

// Can't seem to get the non-any type to work with correct types.
// Eg Control<{ fontSize?: number } doesn't seem to work when there are required items.
// biome-ignore lint/suspicious/noExplicitAny: See above
type FormControlType = Control<any>;

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
  name = 'fillOpacity',
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
