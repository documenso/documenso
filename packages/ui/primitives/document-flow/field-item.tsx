'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import { CopyPlus, Settings2, Trash } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';
import { match } from 'ts-pattern';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { TFieldMetaSchema } from '@documenso/lib/types/field-meta';
import { ZCheckboxFieldMeta, ZRadioFieldMeta } from '@documenso/lib/types/field-meta';

import { useSignerColors } from '../../lib/signer-colors';
import { cn } from '../../lib/utils';
import { CheckboxField } from './advanced-fields/checkbox';
import { RadioField } from './advanced-fields/radio';
import { FieldIcon } from './field-icon';
import type { TDocumentFlowFormSchema } from './types';

type Field = TDocumentFlowFormSchema['fields'][0];

const fontCaveat = Caveat({
  weight: ['500'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-caveat',
});

export type FieldItemProps = {
  field: Field;
  passive?: boolean;
  disabled?: boolean;
  minHeight?: number;
  minWidth?: number;
  onResize?: (_node: HTMLElement) => void;
  onMove?: (_node: HTMLElement) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onAdvancedSettings?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  recipientIndex?: number;
  hideRecipients?: boolean;
  hasErrors?: boolean;
};

export const FieldItem = ({
  field,
  passive,
  disabled,
  minHeight,
  minWidth,
  onResize,
  onMove,
  onRemove,
  onDuplicate,
  onFocus,
  onBlur,
  onAdvancedSettings,
  recipientIndex = 0,
  hideRecipients = false,
  hasErrors,
}: FieldItemProps) => {
  const [active, setActive] = useState(false);
  const [coords, setCoords] = useState({
    pageX: 0,
    pageY: 0,
    pageHeight: 0,
    pageWidth: 0,
  });
  const [settingsActive, setSettingsActive] = useState(false);
  const $el = useRef(null);

  const signerStyles = useSignerColors(recipientIndex);

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

  const fixedSize = checkBoxHasValues || radioHasValues;

  return createPortal(
    <Rnd
      key={coords.pageX + coords.pageY + coords.pageHeight + coords.pageWidth}
      className={cn('group z-20', {
        'pointer-events-none': passive,
        'pointer-events-none cursor-not-allowed opacity-75': disabled,
        'z-10': !active || disabled,
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
      onDragStart={() => setActive(true)}
      onResizeStart={() => setActive(true)}
      enableResizing={!fixedSize}
      onResizeStop={(_e, _d, ref) => {
        setActive(false);
        onResize?.(ref);
      }}
      onDragStop={(_e, d) => {
        setActive(false);
        onMove?.(d.node);
      }}
    >
      <div
        className={cn(
          'relative flex h-full w-full items-center justify-center bg-white',
          !hasErrors && signerStyles.default.base,
          !hasErrors && signerStyles.default.fieldItem,
          {
            'rounded-lg border border-red-400 bg-red-400/20 shadow-[0_0_0_5px_theme(colors.red.500/10%),0_0_0_2px_theme(colors.red.500/40%),0_0_0_0.5px_theme(colors.red.500)]':
              hasErrors,
          },
          !fixedSize && '[container-type:size]',
        )}
        data-error={hasErrors ? 'true' : undefined}
        onClick={() => {
          setSettingsActive((prev) => !prev);
          onFocus?.();
        }}
        ref={$el}
        data-field-id={field.nativeId}
      >
        {match(field.type)
          .with('CHECKBOX', () => <CheckboxField field={field} />)
          .with('RADIO', () => <RadioField field={field} />)
          .otherwise(() => (
            <FieldIcon
              fieldMeta={field.fieldMeta}
              type={field.type}
              signerEmail={field.signerEmail}
              fontCaveatClassName={fontCaveat.className}
            />
          ))}

        {!hideRecipients && (
          <div className="absolute -right-5 top-0 z-20 hidden h-full w-5 items-center justify-center group-hover:flex">
            <div
              className={cn(
                'flex h-5 w-5 flex-col items-center justify-center rounded-r-md text-[0.5rem] font-bold text-white',
                signerStyles.default.fieldItemInitials,
                {
                  '!opacity-50': disabled || passive,
                },
              )}
            >
              {(field.signerEmail?.charAt(0)?.toUpperCase() ?? '') +
                (field.signerEmail?.charAt(1)?.toUpperCase() ?? '')}
            </div>
          </div>
        )}
      </div>

      {!disabled && settingsActive && (
        <div className="mt-1 flex justify-center">
          <div className="dark:bg-background group flex items-center justify-evenly gap-x-1 rounded-md border bg-gray-900 p-0.5">
            {advancedField && (
              <button
                className="dark:text-muted-foreground/50 dark:hover:text-muted-foreground dark:hover:bg-foreground/10 rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
                onClick={onAdvancedSettings}
                onTouchEnd={onAdvancedSettings}
              >
                <Settings2 className="h-3 w-3" />
              </button>
            )}

            <button
              className="dark:text-muted-foreground/50 dark:hover:text-muted-foreground dark:hover:bg-foreground/10 rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
              onClick={onDuplicate}
              onTouchEnd={onDuplicate}
            >
              <CopyPlus className="h-3 w-3" />
            </button>

            <button
              className="dark:text-muted-foreground/50 dark:hover:text-muted-foreground dark:hover:bg-foreground/10 rounded-sm p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-gray-100"
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
