import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { FieldType } from '@prisma/client';
import { CopyPlus, Settings2, SquareStack, Trash } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { ZCheckboxFieldMeta, ZRadioFieldMeta } from '@documenso/lib/types/field-meta';

import { useRecipientColors } from '../../lib/recipient-colors';
import { cn } from '../../lib/utils';
import { FieldContent } from './field-content';
import type { TDocumentFlowFormSchema } from './types';

type Field = TDocumentFlowFormSchema['fields'][0];

export type FieldItemProps = {
  field: Field;
  fieldClassName?: string;
  passive?: boolean;
  disabled?: boolean;
  minHeight?: number;
  minWidth?: number;
  defaultHeight?: number;
  defaultWidth?: number;
  onResize?: (_node: HTMLElement) => void;
  onMove?: (_node: HTMLElement) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onDuplicateAllPages?: () => void;
  onAdvancedSettings?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  recipientIndex?: number;
  hasErrors?: boolean;
  active?: boolean;
  onFieldActivate?: () => void;
  onFieldDeactivate?: () => void;
};

/**
 * The item when editing fields??
 */
export const FieldItem = ({
  fieldClassName,
  field,
  passive,
  disabled,
  minHeight,
  minWidth,
  defaultHeight,
  defaultWidth,
  onResize,
  onMove,
  onRemove,
  onDuplicate,
  onDuplicateAllPages,
  onAdvancedSettings,
  onFocus,
  onBlur,
  recipientIndex = 0,
  hasErrors,
  active,
  onFieldActivate,
  onFieldDeactivate,
}: FieldItemProps) => {
  const { _ } = useLingui();

  const [coords, setCoords] = useState({
    pageX: 0,
    pageY: 0,
    pageHeight: defaultHeight || 0,
    pageWidth: defaultWidth || 0,
  });
  const [settingsActive, setSettingsActive] = useState(false);
  const $el = useRef(null);

  const signerStyles = useRecipientColors(recipientIndex);

  const advancedField = [
    'NUMBER',
    'RADIO',
    'CHECKBOX',
    'DROPDOWN',
    'TEXT',
    'INITIALS',
    'EMAIL',
    'DATE',
    'NAME',
  ].includes(field.type);

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`,
    );

    if (!$page) {
      return;
    }

    const { height, width } = $page.getBoundingClientRect();

    const top = $page.getBoundingClientRect().top + window.scrollY;
    const left = $page.getBoundingClientRect().left + window.scrollX;

    // X and Y are percentages of the page's height and width
    const pageX = (field.pageX / 100) * width + left;
    const pageY = (field.pageY / 100) * height + top;

    const pageHeight = (field.pageHeight / 100) * height;
    const pageWidth = (field.pageWidth / 100) * width;

    setCoords({
      pageX: pageX,
      pageY: pageY,
      pageHeight: pageHeight,
      pageWidth: pageWidth,
    });
  }, [field.pageHeight, field.pageNumber, field.pageWidth, field.pageX, field.pageY]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  useEffect(() => {
    const onResize = () => {
      calculateCoords();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateCoords]);

  useEffect(() => {
    const onClickOutsideOfField = (event: MouseEvent) => {
      const isOutsideOfField = $el.current && !event.composedPath().includes($el.current);

      setSettingsActive((active) => {
        if (active && isOutsideOfField) {
          return false;
        }

        return active;
      });

      if (isOutsideOfField) {
        setSettingsActive(false);
        onFieldDeactivate?.();
        onBlur?.();
      }
    };

    document.body.addEventListener('click', onClickOutsideOfField);

    return () => {
      document.body.removeEventListener('click', onClickOutsideOfField);
    };
  }, [onBlur]);

  const hasFieldMetaValues = (
    fieldType: string,
    fieldMeta: TFieldMetaSchema,
    parser: typeof ZCheckboxFieldMeta | typeof ZRadioFieldMeta,
  ) => {
    if (field.type !== fieldType || !fieldMeta) {
      return false;
    }

    const parsedMeta = parser?.parse(fieldMeta);
    return parsedMeta && parsedMeta.values && parsedMeta.values.length > 0;
  };

  const checkBoxHasValues = useMemo(
    () => hasFieldMetaValues('CHECKBOX', field.fieldMeta, ZCheckboxFieldMeta),
    [field.fieldMeta],
  );

  const radioHasValues = useMemo(
    () => hasFieldMetaValues('RADIO', field.fieldMeta, ZRadioFieldMeta),
    [field.fieldMeta],
  );

  const hasCheckedValues = (fieldMeta: TFieldMetaSchema, type: FieldType) => {
    if (!fieldMeta || (type !== FieldType.RADIO && type !== FieldType.CHECKBOX)) {
      return false;
    }

    if (type === FieldType.RADIO) {
      const parsed = ZRadioFieldMeta.parse(fieldMeta);
      return parsed.values?.some((value) => value.checked) ?? false;
    }

    if (type === FieldType.CHECKBOX) {
      const parsed = ZCheckboxFieldMeta.parse(fieldMeta);
      return parsed.values?.some((value) => value.checked) ?? false;
    }

    return false;
  };

  const fieldHasCheckedValues = useMemo(
    () => hasCheckedValues(field.fieldMeta, field.type),
    [field.fieldMeta, field.type],
  );

  const fixedSize = checkBoxHasValues || radioHasValues;

  return createPortal(
    <Rnd
      key={coords.pageX + coords.pageY + coords.pageHeight + coords.pageWidth}
      className={cn('dark-mode-disabled group', {
        'pointer-events-none': passive,
        'pointer-events-none cursor-not-allowed opacity-75': disabled,
        'z-50': active && !disabled,
        'z-20': !active && !disabled,
        'z-10': disabled,
      })}
      minHeight={fixedSize ? '' : minHeight || 'auto'}
      minWidth={fixedSize ? '' : minWidth || 'auto'}
      default={{
        x: coords.pageX,
        y: coords.pageY,
        height: fixedSize ? '' : coords.pageHeight,
        width: fixedSize ? '' : coords.pageWidth,
      }}
      bounds={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`}
      onDragStart={() => onFieldActivate?.()}
      onResizeStart={() => onFieldActivate?.()}
      enableResizing={!fixedSize}
      resizeHandleStyles={{
        bottom: { bottom: -8, cursor: 'ns-resize' },
        top: { top: -8, cursor: 'ns-resize' },
        left: { cursor: 'ew-resize' },
        right: { cursor: 'ew-resize' },
      }}
      onResizeStop={(_e, _d, ref) => {
        onFieldDeactivate?.();
        onResize?.(ref);
      }}
      onDragStop={(_e, d) => {
        onFieldDeactivate?.();
        onMove?.(d.node);
      }}
    >
      {(field.type === FieldType.RADIO || field.type === FieldType.CHECKBOX) &&
        field.fieldMeta?.label && (
          <div
            className={cn(
              'absolute -top-16 left-0 right-0 rounded-md p-2 text-center text-xs text-gray-700',
              {
                'bg-foreground/5 border-primary border': !fieldHasCheckedValues,
                'bg-documenso-200 border-primary border': fieldHasCheckedValues,
              },
            )}
          >
            {field.fieldMeta.label}
          </div>
        )}

      <div
        className={cn(
          'group/field-item relative flex h-full w-full items-center justify-center rounded-[2px] bg-white/90 px-2 ring-2 transition-colors',
          !hasErrors && signerStyles.base,
          !hasErrors && signerStyles.fieldItem,
          fieldClassName,
          {
            'rounded-[2px] border bg-red-400/20 shadow-[0_0_0_5px_theme(colors.red.500/10%),0_0_0_2px_theme(colors.red.500/40%),0_0_0_0.5px_theme(colors.red.500)] ring-red-400':
              hasErrors,
          },
          !fixedSize && '[container-type:size]',
        )}
        data-error={hasErrors ? 'true' : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setSettingsActive((prev) => !prev);
          onFieldActivate?.();
          onFocus?.();
        }}
        ref={$el}
        data-field-id={field.nativeId}
      >
        <FieldContent field={field} />

        {/* On hover, display recipient initials on side of field.  */}
        <div className="absolute -right-5 top-0 z-20 hidden h-full w-5 items-center justify-center group-hover:flex">
          <div
            className={cn(
              'flex h-5 w-5 flex-col items-center justify-center rounded-r-md text-[0.5rem] font-bold text-white opacity-0 transition duration-200 group-hover/field-item:opacity-100',
              signerStyles.fieldItemInitials,
              {
                '!opacity-50': disabled || passive,
              },
            )}
          >
            {(field.signerEmail?.charAt(0)?.toUpperCase() ?? '') +
              (field.signerEmail?.charAt(1)?.toUpperCase() ?? '')}
          </div>
        </div>
      </div>

      {!disabled && settingsActive && (
        <div className="absolute z-[60] mt-1 flex w-full items-center justify-center">
          <div className="group flex items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5">
            {advancedField && (
              <button
                title={_(msg`Advanced settings`)}
                className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
                onClick={onAdvancedSettings}
                onTouchEnd={onAdvancedSettings}
              >
                <Settings2 className="h-3 w-3" />
              </button>
            )}

            <button
              title={_(msg`Duplicate`)}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={onDuplicate}
              onTouchEnd={onDuplicate}
            >
              <CopyPlus className="h-3 w-3" />
            </button>

            <button
              title={_(msg`Duplicate on all pages`)}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={onDuplicateAllPages}
              onTouchEnd={onDuplicateAllPages}
            >
              <SquareStack className="h-3 w-3" />
            </button>

            <button
              title={_(msg`Remove`)}
              className="rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={onRemove}
              onTouchEnd={onRemove}
            >
              <Trash className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </Rnd>,
    document.body,
  );
};
