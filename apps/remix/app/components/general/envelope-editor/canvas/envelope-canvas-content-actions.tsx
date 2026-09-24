import type { TLocalContent } from '@documenso/lib/client-only/hooks/use-editor-contents';
import {
  CONTENT_MAX_FONT_SIZE,
  CONTENT_MAX_STROKE_WIDTH,
  CONTENT_MIN_FONT_SIZE,
  CONTENT_MIN_STROKE_WIDTH,
  DEFAULT_CONTENT_FONT_SIZE,
  DEFAULT_CONTENT_HIGHLIGHT_COLOR,
  DEFAULT_CONTENT_STROKE_COLOR,
  DEFAULT_CONTENT_STROKE_WIDTH,
  DEFAULT_CONTENT_TEXT_ALIGN,
  DEFAULT_CONTENT_TEXT_COLOR,
  DEFAULT_CONTENT_VERTICAL_ALIGN,
  EnvelopeContentType,
} from '@documenso/lib/types/envelope-content-meta';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
import { FormField } from '@documenso/ui/primitives/form/form';
import { Popover, PopoverContent, PopoverTrigger } from '@documenso/ui/primitives/popover';
import { Slider } from '@documenso/ui/primitives/slider';
import { Trans, useLingui } from '@lingui/react/macro';
import type { LucideIcon } from 'lucide-react';
import {
  ALargeSmallIcon,
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  AlignVerticalJustifyCenterIcon,
  AlignVerticalJustifyEndIcon,
  AlignVerticalJustifyStartIcon,
  ImageUpIcon,
} from 'lucide-react';
import { match } from 'ts-pattern';
import { DEFAULT_ENABLED_FILL_COLOR } from '~/components/forms/editor/editor-content-shape-form';
import { ContentImageUploadDialog } from '~/components/general/envelope-editor/content-image-upload-dialog';
import {
  type TContentHighlightFormSchema,
  type TContentLineFormSchema,
  type TContentShapeFormSchema,
  type TContentTextFormSchema,
  useContentSettingsForm,
} from '~/components/general/envelope-editor/content-settings-form-provider';

import { EnvelopeCanvasActionButton, EnvelopeCanvasActionDivider } from './envelope-canvas-action-bar';

type EnvelopeCanvasContentActionsProps = {
  /**
   * The single selected content.
   */
  content: TLocalContent;
};

/**
 * The type specific quick actions for a single selected content, shown at the
 * start of the content action bar: the frequently adjusted styles (colors,
 * stroke width) and the image upload for image contents.
 *
 * The style actions are fields of the selected content's settings form, the
 * same form the sidebar edits, so the two never disagree. The full set of
 * settings remains in the sidebar. Renders nothing for types without quick
 * actions.
 */
export const EnvelopeCanvasContentActions = ({ content }: EnvelopeCanvasContentActionsProps) => {
  const { t } = useLingui();

  const { content: formContent, isReady } = useContentSettingsForm();

  // The canvas selection and the settings form follow each other, but guard
  // against a render in between so a stale selection never edits another
  // content's form, and wait for the form to hold this content's values.
  if (formContent?.formId !== content.formId || !isReady) {
    return null;
  }

  const actions = match(content.contentMeta)
    .with({ type: EnvelopeContentType.TEXT }, () => <TextContentActions />)
    .with({ type: EnvelopeContentType.LINE }, () => <LineContentActions />)
    .with({ type: EnvelopeContentType.SHAPE }, () => <ShapeContentActions />)
    .with({ type: EnvelopeContentType.HIGHLIGHT }, () => <HighlightContentActions />)
    .with({ type: EnvelopeContentType.IMAGE }, () => (
      <EnvelopeCanvasActionButton
        title={content.dataContentId ? t`Replace image` : t`Upload image`}
        icon={ImageUpIcon}
        onClick={() => void ContentImageUploadDialog.call({ formId: content.formId })}
      />
    ))
    .exhaustive();

  return (
    <>
      {actions}
      <EnvelopeCanvasActionDivider />
    </>
  );
};

const TextContentActions = () => {
  const { t } = useLingui();
  const { form } = useContentSettingsForm<TContentTextFormSchema>();

  return (
    <>
      <FormField
        control={form.control}
        name="color"
        render={({ field }) => (
          <ColorAction
            title={t`Text color`}
            value={field.value ?? DEFAULT_CONTENT_TEXT_COLOR}
            onChange={field.onChange}
          />
        )}
      />

      <FormField
        control={form.control}
        name="fontSize"
        render={({ field }) => (
          <FontSizeAction value={field.value ?? DEFAULT_CONTENT_FONT_SIZE} onChange={field.onChange} />
        )}
      />

      <FormField
        control={form.control}
        name="textAlign"
        render={({ field }) => (
          <ChoiceAction
            title={t`Text align`}
            value={field.value ?? DEFAULT_CONTENT_TEXT_ALIGN}
            options={[
              { value: 'left', icon: AlignLeftIcon, label: t`Left` },
              { value: 'center', icon: AlignCenterIcon, label: t`Center` },
              { value: 'right', icon: AlignRightIcon, label: t`Right` },
            ]}
            onChange={field.onChange}
          />
        )}
      />

      <FormField
        control={form.control}
        name="verticalAlign"
        render={({ field }) => (
          <ChoiceAction
            title={t`Vertical align`}
            value={field.value ?? DEFAULT_CONTENT_VERTICAL_ALIGN}
            options={[
              { value: 'top', icon: AlignVerticalJustifyStartIcon, label: t`Top` },
              { value: 'middle', icon: AlignVerticalJustifyCenterIcon, label: t`Middle` },
              { value: 'bottom', icon: AlignVerticalJustifyEndIcon, label: t`Bottom` },
            ]}
            onChange={field.onChange}
          />
        )}
      />
    </>
  );
};

const LineContentActions = () => {
  const { t } = useLingui();
  const { form } = useContentSettingsForm<TContentLineFormSchema>();

  return (
    <>
      <FormField
        control={form.control}
        name="strokeColor"
        render={({ field }) => (
          <ColorAction
            title={t`Line color`}
            value={field.value ?? DEFAULT_CONTENT_STROKE_COLOR}
            onChange={field.onChange}
          />
        )}
      />

      <FormField
        control={form.control}
        name="strokeWidth"
        render={({ field }) => (
          <StrokeWidthAction value={field.value ?? DEFAULT_CONTENT_STROKE_WIDTH} onChange={field.onChange} />
        )}
      />
    </>
  );
};

const ShapeContentActions = () => {
  const { t } = useLingui();
  const { form } = useContentSettingsForm<TContentShapeFormSchema>();

  return (
    <>
      <FormField
        control={form.control}
        name="strokeColor"
        render={({ field }) => (
          <ColorAction
            title={t`Border color`}
            value={field.value ?? DEFAULT_CONTENT_STROKE_COLOR}
            onChange={field.onChange}
          />
        )}
      />

      <FormField
        control={form.control}
        name="fillColor"
        render={({ field }) => (
          <ColorAction
            title={field.value ? t`Fill color` : t`Add fill`}
            value={field.value}
            defaultValue={DEFAULT_ENABLED_FILL_COLOR}
            onChange={field.onChange}
          />
        )}
      />

      <FormField
        control={form.control}
        name="strokeWidth"
        render={({ field }) => (
          <StrokeWidthAction value={field.value ?? DEFAULT_CONTENT_STROKE_WIDTH} onChange={field.onChange} />
        )}
      />
    </>
  );
};

const HighlightContentActions = () => {
  const { t } = useLingui();
  const { form } = useContentSettingsForm<TContentHighlightFormSchema>();

  return (
    <FormField
      control={form.control}
      name="color"
      render={({ field }) => (
        <ColorAction
          title={t`Highlight color`}
          value={field.value ?? DEFAULT_CONTENT_HIGHLIGHT_COLOR}
          onChange={field.onChange}
        />
      )}
    />
  );
};

type ColorActionProps = {
  title: string;

  /**
   * The current color, or null when none is set (e.g. no fill).
   */
  value: string | null;

  /**
   * The color the picker starts from when none is set.
   */
  defaultValue?: string;

  onChange: (color: string) => void;
};

/**
 * A swatch button which opens a color picker. An unset color shows a struck
 * through swatch.
 */
const ColorAction = ({ title, value, defaultValue, onChange }: ColorActionProps) => {
  return (
    <ColorPicker
      value={value ?? ''}
      defaultValue={defaultValue}
      onChange={onChange}
      trigger={
        <button type="button" title={title} className="rounded-md p-1.5 transition-colors hover:bg-muted">
          <span
            className="relative block h-3.5 w-3.5 overflow-hidden rounded-full ring-1 ring-black/20 ring-inset dark:ring-white/30"
            style={{ backgroundColor: value ?? 'transparent' }}
          >
            {!value && <span className="absolute -inset-x-1 top-1/2 h-px -translate-y-1/2 rotate-45 bg-destructive" />}
          </span>
        </button>
      }
    />
  );
};

type FontSizeActionProps = {
  value: number;
  onChange: (fontSize: number) => void;
};

/**
 * A button showing the current font size which opens a slider.
 */
const FontSizeAction = ({ value, onChange }: FontSizeActionProps) => {
  const { t } = useLingui();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t`Font size`}
          className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <ALargeSmallIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-3" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            <Trans>Font size</Trans>
          </span>
          <span className="tabular-nums">{value}</span>
        </div>

        <Slider
          value={[value]}
          min={CONTENT_MIN_FONT_SIZE}
          max={CONTENT_MAX_FONT_SIZE}
          step={1}
          onValueChange={([fontSize]) => onChange(fontSize)}
        />
      </PopoverContent>
    </Popover>
  );
};

type ChoiceActionProps<T extends string> = {
  title: string;
  value: T;
  options: { value: T; icon: LucideIcon; label: string }[];
  onChange: (value: T) => void;
};

/**
 * A button showing the icon of the current choice which opens the other
 * choices, e.g. text alignment.
 */
const ChoiceAction = <T extends string>({ title, value, options, onChange }: ChoiceActionProps<T>) => {
  const current = options.find((option) => option.value === value) ?? options[0];
  const CurrentIcon = current.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={title}
          className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          <CurrentIcon className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="flex w-auto gap-0.5 p-1" onOpenAutoFocus={(event) => event.preventDefault()}>
        {options.map((option) => {
          const OptionIcon = option.icon;

          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              aria-pressed={option.value === value}
              onClick={() => onChange(option.value)}
              className="rounded-md p-1.5 text-foreground/70 transition-colors hover:bg-muted hover:text-foreground aria-pressed:bg-muted aria-pressed:text-foreground"
            >
              <OptionIcon className="h-4 w-4" />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

type StrokeWidthActionProps = {
  value: number;
  onChange: (width: number) => void;
};

/**
 * A button showing the current stroke width which opens a slider.
 */
const StrokeWidthAction = ({ value, onChange }: StrokeWidthActionProps) => {
  const { t } = useLingui();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={t`Thickness`}
          className="flex h-[26px] w-[26px] items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
        >
          {/* A bar whose thickness follows the value, so the current width is still glanceable. */}
          <span className="block w-3.5 rounded-full bg-current" style={{ height: Math.max(1.5, Math.min(value, 6)) }} />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-48 p-3" onOpenAutoFocus={(event) => event.preventDefault()}>
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            <Trans>Thickness</Trans>
          </span>
          <span className="tabular-nums">{value}</span>
        </div>

        <Slider
          value={[value]}
          min={CONTENT_MIN_STROKE_WIDTH}
          max={CONTENT_MAX_STROKE_WIDTH}
          step={0.5}
          onValueChange={([width]) => onChange(width)}
        />
      </PopoverContent>
    </Popover>
  );
};
