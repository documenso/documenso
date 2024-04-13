'use client';

import { useCallback, useEffect, useState } from 'react';

import { Trash } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
import { Checkbox } from '../checkbox';
import type { TDocumentFlowFormSchema } from './types';
import { FRIENDLY_FIELD_TYPE } from './types';
import { FieldType } from '.prisma/client';

type Field = TDocumentFlowFormSchema['fields'][0];

export type FieldItemProps = {
  field: Field;
  passive?: boolean;
  disabled?: boolean;
  minHeight?: number;
  minWidth?: number;
  onResize?: (_node: HTMLElement) => void;
  onMove?: (_node: HTMLElement) => void;
  onRemove?: () => void;
};

export const FieldItem = ({
  field,
  passive,
  disabled,
  minHeight: _minHeight,
  minWidth: _minWidth,
  onResize,
  onMove,
  onRemove,
}: FieldItemProps) => {
  const [active, setActive] = useState(false);
  const [coords, setCoords] = useState({
    pageX: 0,
    pageY: 0,
    pageHeight: 0,
    pageWidth: 0,
  });

  const isCheckboxField = field.type === FieldType.CHECKBOX;

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

  return createPortal(
    <Rnd
      key={coords.pageX + coords.pageY + coords.pageHeight + coords.pageWidth}
      className={cn('z-20', {
        'pointer-events-none': passive,
        'pointer-events-none opacity-75': disabled,
        'z-10': !active || disabled,
      })}
      // minHeight={minHeight}
      // minWidth={minWidth}
      default={{
        x: coords.pageX,
        y: coords.pageY,
        height: isCheckboxField ? 32 : coords.pageHeight,
        width: isCheckboxField ? 32 : coords.pageWidth,
      }}
      bounds={`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.pageNumber}"]`}
      onDragStart={() => setActive(true)}
      onResizeStart={() => setActive(true)}
      onResizeStop={(_e, _d, ref) => {
        setActive(false);
        onResize?.(ref);
      }}
      onDragStop={(_e, d) => {
        setActive(false);
        onMove?.(d.node);
      }}
    >
      {!disabled && (
        <button
          className={cn(
            'text-muted-foreground/50 hover:text-muted-foreground/80 bg-background absolute -right-2 -top-2 z-20 flex  items-center justify-center rounded-full border',
            {
              'h-8 w-8': !isCheckboxField,
              'h-6 w-6': isCheckboxField,
            },
          )}
          onClick={() => onRemove?.()}
          onTouchEnd={() => onRemove?.()}
        >
          <Trash className="h-4 w-4" />
        </button>
      )}

      {!isCheckboxField && (
        <Card
          className={cn('bg-field-card/80 h-full w-full backdrop-blur-[1px]', {
            'border-field-card-border': !disabled,
            'border-field-card-border/80': active,
          })}
        >
          <CardContent
            className={cn(
              'text-field-card-foreground flex h-full w-full flex-col items-center justify-center p-2',
              {
                'text-field-card-foreground/50': disabled,
              },
            )}
          >
            {FRIENDLY_FIELD_TYPE[field.type]}

            <p className="w-full truncate text-center text-xs">{field.signerEmail}</p>
          </CardContent>
        </Card>
      )}

      {isCheckboxField && (
        <Checkbox
          className={cn(
            'bg-field-card/80 h-8 w-8 border-2 backdrop-blur-[1px]',
            'shadow-[0_0_0_4px_theme(colors.gray.100/70%),0_0_0_1px_theme(colors.gray.100/70%),0_0_0_0.5px_theme(colors.primary.DEFAULT/70%)]',
            {
              'border-field-card-border': !disabled,
              'border-field-card-border/80': active,
            },
          )}
        />
      )}
    </Rnd>,
    document.body,
  );
};
