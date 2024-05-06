'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { Caveat } from 'next/font/google';

import {
  CalendarDays,
  CheckSquare,
  ChevronDown,
  Disc,
  Hash,
  Mail,
  Settings2,
  Trash,
  Type,
  User,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import { FieldType } from '@documenso/prisma/client';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../card';
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
  const [settingsActive, setSettingsActive] = useState(false);
  const cardRef = useRef(null);

  const advancedField =
    field.type === 'NUMBER' ||
    field.type === 'RADIO' ||
    field.type === 'CHECKBOX' ||
    field.type === 'DROPDOWN';

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

  const handleOnClick = (event: MouseEvent) => {
    if (settingsActive && cardRef.current && !event.composedPath().includes(cardRef.current)) {
      setSettingsActive(false);
    }
  };

  useEffect(() => {
    document.body.addEventListener('click', handleOnClick);
    return () => {
      document.body.removeEventListener('click', handleOnClick);
    };
  }, [settingsActive]);

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
      <Card
        className={cn('bg-field-card/10 h-full w-full backdrop-blur-[1px]', {
          'border-field-card-border': !disabled,
          'border-field-card-border/80 bg-field-card/80': active || settingsActive,
        })}
        onClick={() => {
          setSettingsActive((prev) => !prev);
        }}
        ref={cardRef}
      >
        <CardContent
          className={cn(
            'text-field-card-foreground group flex h-full w-full flex-col items-center justify-center p-2',
            {
              'text-field-card-foreground/50': disabled,
            },
          )}
        >
          {(() => {
            switch (field.type) {
              case FieldType.EMAIL:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl  font-light">
                    <Mail className="h-5 w-5" /> Email
                  </div>
                );
              case FieldType.NAME:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <User className="h-5 w-5" /> Name
                  </div>
                );
              case FieldType.DATE:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <CalendarDays className="h-5 w-5" /> Date
                  </div>
                );
              case FieldType.TEXT:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <Type className="h-5 w-5" /> Text
                  </div>
                );
              case FieldType.NUMBER:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <Hash className="h-5 w-5" /> Number
                  </div>
                );
              case FieldType.RADIO:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <Disc className="h-5 w-5" /> Radio
                  </div>
                );
              case FieldType.CHECKBOX:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <CheckSquare className="h-5 w-5 font-light" /> Checkbox
                  </div>
                );
              case FieldType.DROPDOWN:
                return (
                  <div className="text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light">
                    <ChevronDown className="h-5 w-5" /> Dropdown
                  </div>
                );
              case 'SIGNATURE':
                return (
                  <div
                    className={cn(
                      'text-field-card-foreground flex items-center justify-center gap-x-1 text-xl font-light',
                      fontCaveat.className,
                    )}
                  >
                    {field.signerEmail}
                  </div>
                );
              default:
                return null;
            }
          })()}

          <p className="bg-documenso-700 absolute -right-11 z-20 hidden h-10 w-14 items-center justify-center rounded-xl font-semibold text-white group-hover:flex">
            {(field.signerEmail?.charAt(0)?.toUpperCase() ?? '') +
              (field.signerEmail?.charAt(1)?.toUpperCase() ?? '')}
          </p>
        </CardContent>
      </Card>

      {!disabled && settingsActive && (
        <div className="mt-1 flex justify-center">
          <div
            className={cn(
              'bg-background group flex items-center justify-evenly rounded-md border',
              {
                'h-8 w-16': advancedField,
                'h-8 w-8': !advancedField,
              },
            )}
          >
            {advancedField && (
              <button
                className="text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/10 rounded-md p-1 transition-colors"
                onClick={() => onRemove?.()}
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}
            <button
              className="text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 rounded-md p-1 transition-colors"
              onClick={() => onRemove?.()}
              onTouchEnd={() => onRemove?.()}
            >
              <Trash className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </Rnd>,
    document.body,
  );
};
