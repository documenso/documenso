import type { TLocalContent } from '@documenso/lib/client-only/hooks/use-editor-contents';
import { useCurrentEnvelopeEditor } from '@documenso/lib/client-only/providers/envelope-editor-provider';
import {
  CONTENT_LINE_META_DEFAULT_VALUES,
  CONTENT_MAX_STROKE_WIDTH,
  CONTENT_MIN_STROKE_WIDTH,
  CONTENT_RECTANGLE_META_DEFAULT_VALUES,
  DEFAULT_CONTENT_FONT_SIZE,
  DEFAULT_CONTENT_HIGHLIGHT_COLOR,
  DEFAULT_CONTENT_STROKE_COLOR,
  DEFAULT_CONTENT_TEXT_COLOR,
  EnvelopeContentType,
  type TEnvelopeContentMetaOutput,
} from '@documenso/lib/types/envelope-content-meta';
import { FIELD_DEFAULT_GENERIC_ALIGN, FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN } from '@documenso/lib/types/field-meta';
import { ColorPicker } from '@documenso/ui/primitives/color-picker';
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
import { getContentImageInputId } from '~/components/forms/editor/editor-content-image-settings';
import { DEFAULT_ENABLED_FILL_COLOR } from '~/components/forms/editor/editor-content-shape-form';

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
 * The full set of settings remains in the sidebar. Renders nothing for types
 * without quick actions.
 */
export const EnvelopeCanvasContentActions = ({ content }: EnvelopeCanvasContentActionsProps) => {
  const { t } = useLingui();
  const { editorContents } = useCurrentEnvelopeEditor();

  /**
   * Merge a style change onto the latest meta, since the pickers fire many
   * changes in quick succession.
   */
  const updateMeta = (patch: Partial<TEnvelopeContentMetaOutput>) => {
    const latest = editorContents.getContentByFormId(content.formId) ?? content;

    editorContents.updateContentByFormId(content.formId, {
      // The patch only ever carries keys valid for the content's own type.
      contentMeta: { ...latest.contentMeta, ...patch } as TEnvelopeContentMetaOutput,
    });
  };

  const actions = match(content.contentMeta)
    .with({ type: EnvelopeContentType.TEXT }, (meta) => (
      <>
        <ColorAction
          title={t`Text color`}
          value={meta.color ?? DEFAULT_CONTENT_TEXT_COLOR}
          onChange={(color) => updateMeta({ color })}
        />

        <FontSizeAction
          value={meta.fontSize ?? DEFAULT_CONTENT_FONT_SIZE}
          onChange={(fontSize) => updateMeta({ fontSize })}
        />

        <ChoiceAction
          title={t`Text align`}
          value={meta.textAlign ?? FIELD_DEFAULT_GENERIC_ALIGN}
          options={[
            { value: 'left', icon: AlignLeftIcon, label: t`Left` },
            { value: 'center', icon: AlignCenterIcon, label: t`Center` },
            { value: 'right', icon: AlignRightIcon, label: t`Right` },
          ]}
          onChange={(textAlign) => updateMeta({ textAlign })}
        />

        <ChoiceAction
          title={t`Vertical align`}
          value={meta.verticalAlign ?? FIELD_DEFAULT_GENERIC_VERTICAL_ALIGN}
          options={[
            { value: 'top', icon: AlignVerticalJustifyStartIcon, label: t`Top` },
            { value: 'middle', icon: AlignVerticalJustifyCenterIcon, label: t`Middle` },
            { value: 'bottom', icon: AlignVerticalJustifyEndIcon, label: t`Bottom` },
          ]}
          onChange={(verticalAlign) => updateMeta({ verticalAlign })}
        />
      </>
    ))
    .with({ type: EnvelopeContentType.LINE }, (meta) => (
      <>
        <ColorAction
          title={t`Line color`}
          value={meta.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR}
          onChange={(strokeColor) => updateMeta({ strokeColor })}
        />

        <StrokeWidthAction
          value={meta.strokeWidth ?? CONTENT_LINE_META_DEFAULT_VALUES.strokeWidth ?? 1}
          onChange={(strokeWidth) => updateMeta({ strokeWidth })}
        />
      </>
    ))
    .with({ type: EnvelopeContentType.SHAPE }, (meta) => (
      <>
        <ColorAction
          title={t`Border color`}
          value={meta.strokeColor ?? DEFAULT_CONTENT_STROKE_COLOR}
          onChange={(strokeColor) => updateMeta({ strokeColor })}
        />

        <ColorAction
          title={meta.fillColor ? t`Fill color` : t`Add fill`}
          value={meta.fillColor}
          defaultValue={DEFAULT_ENABLED_FILL_COLOR}
          onChange={(fillColor) => updateMeta({ fillColor })}
        />

        <StrokeWidthAction
          value={meta.strokeWidth ?? CONTENT_RECTANGLE_META_DEFAULT_VALUES.strokeWidth ?? 1}
          onChange={(strokeWidth) => updateMeta({ strokeWidth })}
        />
      </>
    ))
    .with({ type: EnvelopeContentType.HIGHLIGHT }, (meta) => (
      <ColorAction
        title={t`Highlight color`}
        value={meta.color ?? DEFAULT_CONTENT_HIGHLIGHT_COLOR}
        onChange={(color) => updateMeta({ color })}
      />
    ))
    .with({ type: EnvelopeContentType.IMAGE }, () => (
      <EnvelopeCanvasActionButton
        title={content.dataContentId ? t`Replace image` : t`Upload image`}
        icon={ImageUpIcon}
        // Opens the picker owned by the settings panel, which is mounted
        // whenever a single content is selected.
        onClick={() => document.getElementById(getContentImageInputId(content.formId))?.click()}
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

type ColorActionProps = {
  title: string;

  /**
   * The current color, or undefined when none is set (e.g. no fill).
   */
  value: string | undefined;

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
            {!value && (
              <span className="absolute inset-0 rotate-45 border-destructive border-t" style={{ top: '50%' }} />
            )}
          </span>
        </button>
      }
    />
  );
};

/**
 * The font size range for text contents, matching the settings form.
 */
const CONTENT_MIN_FONT_SIZE = 8;
const CONTENT_MAX_FONT_SIZE = 96;

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
