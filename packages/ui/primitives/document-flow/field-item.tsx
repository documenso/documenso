'use client';

import { useCallback, useEffect, useState } from 'react';

import { Trash } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { cn } from '@documenso/ui/lib/utils';
import { Card, CardContent } from '@documenso/ui/primitives/card';

import { FRIENDLY_FIELD_TYPE, TDocumentFlowFormSchema } from './types';

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
        height: coords.pageHeight,
        width: coords.pageWidth,
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
          className="text-muted-foreground/50 hover:text-muted-foreground/80 bg-background absolute -right-2 -top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full border"
          onClick={() => onRemove?.()}
        >
          <Trash className="h-4 w-4" />
        </button>
      )}

      <Card
        className={cn('bg-background h-full w-full', {
          'border-primary': !disabled,
          'border-primary/80': active,
        })}
      >
        <CardContent
          className={cn(
            'text-foreground flex h-full w-full flex-col items-center justify-center p-2',
            {
              'text-muted-foreground/50': disabled,
            },
          )}
        >
          {FRIENDLY_FIELD_TYPE[field.type]}

          <p className="text-muted-foreground/50 w-full truncate text-center text-xs">
            {field.signerEmail}
          </p>
        </CardContent>
      </Card>
    </Rnd>,
    document.body,
  );
};
